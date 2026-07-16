const Human        = require('../models/User');
const LoginAttempt = require('../models/LoginAttempt');
const bcrypt       = require('bcryptjs');
const crypto       = require('crypto');

// ── Constantes de lockout por usuario ────────────────────────────
const USER_LOCKOUT_ATTEMPTS = 5;          // fallos antes de lockout
const USER_LOCKOUT_MS       = 15 * 60 * 1000; // 15 minutos

/**
 * Verifica si un usuario específico está bajo lockout
 * Basado en sus intentos fallidos recientes en MongoDB
 */
const isUserLockedOut = async (identifier) => {
    const since = new Date(Date.now() - USER_LOCKOUT_MS);
    const failures = await LoginAttempt.countDocuments({
        identifier: hashIdentifier(identifier),
        success:    false,
        reason:     { $in: ['bad_password', 'not_found', 'locked'] },
        timestamp:  { $gte: since },
    });
    return failures >= USER_LOCKOUT_ATTEMPTS;
};

/**
 * Ofusca el identificador antes de guardarlo (no guardar CURP/RFC en claro)
 */
const hashIdentifier = (identifier) => {
    return crypto.createHash('sha256')
        .update(identifier.toLowerCase().trim())
        .digest('hex')
        .substring(0, 12);
};

/**
 * Registra un intento de login en MongoDB
 */
const logAttempt = async ({ req, identifier, success, reason }) => {
    try {
        await LoginAttempt.create({
            ip:          req.behaviorMeta?.ip          || req.ip,
            fingerprint: req.behaviorMeta?.fingerprint || 'unknown',
            identifier:  hashIdentifier(identifier),
            success,
            userAgent:   req.headers['user-agent'],
            reason,
            sessionId:   req.sessionID,
        });
    } catch (err) {
        console.error('[AUTH] Error logging attempt:', err.message);
    }
};

// ─────────────────────────────────────────────────────────────────
//  RENDER VIEWS
// ─────────────────────────────────────────────────────────────────

exports.renderLogin = (req, res) => {
    if (req.session.loggedin) return res.redirect('/');
    res.render('login', {
        title:     'Iniciar Sesión',
        login:     false,
        pageClass: 'page-public page-login',
    });
};

exports.renderRegister = (req, res) => {
    if (req.session.loggedin) return res.redirect('/');
    res.render('register', {
        title:     'Regístrate',
        login:     false,
        pageClass: 'page-public page-register',
    });
};

// ─────────────────────────────────────────────────────────────────
//  LOGIN — con protección comportamental completa
// ─────────────────────────────────────────────────────────────────

exports.loginUser = async (req, res) => {
    const { humano, contraseña } = req.body;

    // Validación básica de entrada
    if (!humano || !contraseña) {
        return res.status(400).json({
            alertTitle:   'Error',
            alertMessage: 'Completa todos los campos.',
            alertIcon:    'error',
        });
    }

    const identifier = String(humano).trim();

    try {
        // ── 1. Verificar lockout por usuario antes de tocar la DB ─
        const locked = await isUserLockedOut(identifier);
        if (locked) {
            await logAttempt({ req, identifier, success: false, reason: 'locked' });
            // Respuesta ambigua: no confirmar si el usuario existe
            return res.status(401).json({
                alertTitle:   'Acceso bloqueado',
                alertMessage: 'Demasiados intentos fallidos. Espera 15 minutos.',
                alertIcon:    'warning',
            });
        }

        // ── 2. Búsqueda multicanal ────────────────────────────────
        let user = null;
        if (identifier.startsWith('HUM-')) {
            user = await Human.findOne({ humanoID: identifier });
        } else if (identifier.length === 18) {
            user = await Human.findOne({ 'datosPersonales.curp': identifier.toUpperCase() });
        } else if (identifier.length === 13) {
            user = await Human.findOne({ 'datosPersonales.rfc': identifier.toUpperCase() });
        } else if (identifier.includes('@')) {
            user = await Human.findOne({ 'datosPersonales.correo': identifier.toLowerCase() });
        } else if (/^\d{10}$/.test(identifier)) {
            user = await Human.findOne({ 'datosPersonales.telefono': identifier });
        } else {
            return res.status(400).json({
                alertTitle:   'Formato inválido',
                alertMessage: 'Ingresa un identificador válido.',
                alertIcon:    'error',
            });
        }

        // ── 3. Usuario no encontrado ──────────────────────────────
        // Ejecutar bcrypt igual para prevenir timing attacks
        const dummyHash = '$2b$12$invalidhashtopreventtimingattack000000000000000000000000';
        if (!user) {
            await bcrypt.compare(contraseña, dummyHash);
            await logAttempt({ req, identifier, success: false, reason: 'not_found' });
            return res.status(401).json({
                alertTitle:   'Credenciales incorrectas',
                alertMessage: 'Verifica tu identificador y contraseña.',
                alertIcon:    'error',
            });
        }

        // ── 4. Verificar contraseña ───────────────────────────────
        const match = await bcrypt.compare(contraseña, user.datosPersonales.contraseña);
        if (!match) {
            await logAttempt({ req, identifier, success: false, reason: 'bad_password' });
            return res.status(401).json({
                alertTitle:   'Credenciales incorrectas',
                alertMessage: 'Verifica tu identificador y contraseña.',
                alertIcon:    'error',
            });
        }

        // ── 5. Login exitoso: gestión de sesión única ─────────────
        if (user.sesionActiva) {
            user.sesionActiva = false;
            await user.save();
        }
        user.sesionActiva = true;
        await user.save();

        req.session.loggedin = true;
        req.session.nombre   = user.datosPersonales.nombre;
        req.session.humano   = user.humanoID;

        await logAttempt({ req, identifier, success: true, reason: 'success' });

        return res.status(200).json({
            alertTitle:   'Bienvenido',
            alertMessage: `Hola, ${user.datosPersonales.nombre}`,
            alertIcon:    'success',
            ruta:         '/',
        });

    } catch (error) {
        console.error('[AUTH] Error en loginUser:', error);
        res.status(500).json({
            alertTitle:   'Error del servidor',
            alertMessage: 'Intenta nuevamente en unos momentos.',
            alertIcon:    'error',
        });
    }
};