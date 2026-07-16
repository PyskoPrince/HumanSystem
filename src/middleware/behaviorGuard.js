const crypto   = require('crypto');
const LoginAttempt = require('../models/LoginAttempt'); // ajusta ruta

/**
 * ─────────────────────────────────────────────────────────────────
 *  BEHAVIOR GUARD — Human System v5.0
 *  Protege contra ataques que imitan comportamiento legítimo:
 *
 *  ✦ Credential stuffing   → muchos passwords distintos, mismo username
 *  ✦ Account enumeration   → sondeo sistemático de usernames
 *  ✦ Slow brute force      → intentos espaciados para evadir rate limit
 *  ✦ Distributed attack    → misma fingerprint, distintas IPs (VPN rotation)
 *  ✦ Session anomaly       → cambio de IP/UA dentro de sesión activa
 * ─────────────────────────────────────────────────────────────────
 */

// ── Genera fingerprint determinista del dispositivo ──────────────
const generateFingerprint = (req) => {
    const raw = [
        req.headers['user-agent']       || 'ua-unknown',
        req.headers['accept-language']  || 'lang-unknown',
        req.headers['accept-encoding']  || 'enc-unknown',
        req.headers['accept']           || 'acc-unknown',
        req.headers['sec-ch-ua']        || '',
        req.headers['sec-ch-ua-platform']|| '',
    ].join('||');
    return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 20);
};

// ── Obtiene IP real incluso detrás de proxies ─────────────────────
const getRealIP = (req) => {
    return (
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.headers['x-real-ip'] ||
        req.ip ||
        req.connection?.remoteAddress ||
        'unknown'
    );
};

// ── Ventanas de tiempo para análisis ─────────────────────────────
const WINDOWS = {
    SHORT:  1  * 60 * 1000,  //  1 minuto
    MEDIUM: 5  * 60 * 1000,  //  5 minutos
    LONG:   15 * 60 * 1000,  // 15 minutos
};

// ── Umbrales de bloqueo ───────────────────────────────────────────
const THRESHOLDS = {
    FAILURES_PER_IP_SHORT:        5,   // 5 fallos/min por IP → bloqueo
    FAILURES_PER_IP_MEDIUM:       10,  // 10 fallos/5min por IP → bloqueo
    FAILURES_BY_FINGERPRINT:      12,  // 12 fallos/5min por dispositivo → bloqueo
    DISTINCT_USERS_ENUMERATION:   4,   // 4 usernames distintos/10min → enumeración
    PER_USER_LOCKOUT:             5,   // 5 fallos sobre mismo usuario → lockout 15min
};

/**
 * Middleware principal — aplica a rutas de autenticación
 */
const behaviorGuard = async (req, res, next) => {
    const ip          = getRealIP(req);
    const fingerprint = generateFingerprint(req);
    const now         = Date.now();

    try {
        const [
            failsByIPShort,
            failsByIPMedium,
            failsByFingerprint,
            distinctTargets,
        ] = await Promise.all([

            // 1. Fallos por IP en ventana corta (velocidad bruta)
            LoginAttempt.countDocuments({
                ip,
                success: false,
                timestamp: { $gte: new Date(now - WINDOWS.SHORT) },
            }),

            // 2. Fallos por IP en ventana media (slow brute)
            LoginAttempt.countDocuments({
                ip,
                success: false,
                timestamp: { $gte: new Date(now - WINDOWS.MEDIUM) },
            }),

            // 3. Fallos por fingerprint (detecta rotación de IP / VPN)
            LoginAttempt.countDocuments({
                fingerprint,
                success: false,
                timestamp: { $gte: new Date(now - WINDOWS.MEDIUM) },
            }),

            // 4. Distintos identificadores desde misma IP (enumeración)
            LoginAttempt.distinct('identifier', {
                ip,
                timestamp: { $gte: new Date(now - WINDOWS.LONG) },
            }),
        ]);

        const enumerationCount = distinctTargets.length;

        // ── Evaluación de amenaza ──────────────────────────────────
        const threat =
            failsByIPShort      >= THRESHOLDS.FAILURES_PER_IP_SHORT       ? 'velocity_ip'       :
            failsByIPMedium     >= THRESHOLDS.FAILURES_PER_IP_MEDIUM      ? 'slow_bruteforce'   :
            failsByFingerprint  >= THRESHOLDS.FAILURES_BY_FINGERPRINT     ? 'fingerprint_storm' :
            enumerationCount    >= THRESHOLDS.DISTINCT_USERS_ENUMERATION  ? 'enumeration'       :
            null;

        if (threat) {
            console.warn(
                `[BEHAVIOR_GUARD] BLOCKED | threat=${threat} ip=${ip} ` +
                `fp=${fingerprint} fails_short=${failsByIPShort} ` +
                `fails_medium=${failsByIPMedium} enum=${enumerationCount}`
            );

            // Registrar el bloqueo mismo como intento fallido
            await LoginAttempt.create({
                ip, fingerprint,
                identifier: '__blocked__',
                success: false,
                userAgent: req.headers['user-agent'],
                reason: `blocked_${threat}`,
            });

            // Respuesta genérica: no revelar razón exacta al atacante
            return res.status(429).json({
                alertTitle:   'Acceso restringido temporalmente',
                alertMessage: 'Por seguridad, espera unos minutos antes de intentar de nuevo.',
                alertIcon:    'warning',
            });
        }

        // Adjuntar datos al request para uso en el controlador
        req.behaviorMeta = { ip, fingerprint };
        next();

    } catch (err) {
        // Si el guard falla, no bloquear al usuario (fail-open)
        console.error('[BEHAVIOR_GUARD] Error interno:', err.message);
        req.behaviorMeta = { ip, fingerprint };
        next();
    }
};

/**
 * Middleware de integridad de sesión activa
 * Detecta hijacking: si IP o fingerprint cambian dentro de la sesión
 */
const sessionIntegrityCheck = (req, res, next) => {
    if (!req.session?.loggedin) return next();

    const currentIP          = getRealIP(req);
    const currentFingerprint = generateFingerprint(req);

    if (!req.session.boundIP) {
        // Primera petición autenticada: vincular sesión a dispositivo
        req.session.boundIP          = currentIP;
        req.session.boundFingerprint = currentFingerprint;
        return next();
    }

    const ipMismatch          = req.session.boundIP !== currentIP;
    const fingerprintMismatch = req.session.boundFingerprint !== currentFingerprint;

    // Fingerprint cambia → fuerte señal de hijacking
    if (fingerprintMismatch) {
        console.warn(
            `[SESSION_INTEGRITY] Anomalía detectada | ` +
            `user=${req.session.humano} ip_cambio=${ipMismatch} fp_cambio=${fingerprintMismatch}`
        );
        req.session.destroy(() => {
            res.clearCookie('connect.sid');
            return res.status(401).json({
                alertTitle:   'Sesión invalidada',
                alertMessage: 'Se detectó actividad inusual. Inicia sesión nuevamente.',
                alertIcon:    'error',
                ruta:         '/login',
            });
        });
        return;
    }

    // IP cambia (posible NAT o móvil): permitir pero actualizar
    if (ipMismatch) {
        req.session.boundIP = currentIP;
    }

    next();
};

module.exports = { behaviorGuard, sessionIntegrityCheck, generateFingerprint, getRealIP };