const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express    = require('express');
const session    = require('express-session');
const MongoStore = require('connect-mongo');
const helmet     = require('helmet');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');

const connectDB    = require('./config/database');
const indexRoutes  = require('./routes/indexRoutes');
const authRoutes   = require('./routes/authRoutes');

const {
    behaviorGuard,
    sessionIntegrityCheck,
} = require('./middleware/behaviorGuard');

const app = express();

// ─────────────────────────────────────────────────────────────────
//  1. BASE DE DATOS
// ─────────────────────────────────────────────────────────────────
connectDB();

// ─────────────────────────────────────────────────────────────────
//  2. MOTOR DE VISTAS
// ─────────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─────────────────────────────────────────────────────────────────
//  3. PROXY TRUST (necesario para obtener IP real en producción)
// ─────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

// ─────────────────────────────────────────────────────────────────
//  4. HELMET — Headers de seguridad HTTP
// ─────────────────────────────────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                "'unsafe-eval'",
                "cdn.jsdelivr.net",
                "cdnjs.cloudflare.com",
                "unpkg.com",
                "js.stripe.com",
                "code.jquery.com",
                "use.fontawesome.com",
            ],
            styleSrc: [
                "'self'",
                "'unsafe-inline'",
                "cdn.jsdelivr.net",
                "fonts.googleapis.com",
                "cdnjs.cloudflare.com",
                "use.fontawesome.com",
            ],
            imgSrc: [
                "'self'",
                "data:",
                "https:",
                "http:",
                "https://storage.googleapis.com",
            ],
            connectSrc: [
                "'self'",
                "https://api.stripe.com",
                "https://maps.googleapis.com",
                "https://cdn.jsdelivr.net",
                "https://cdnjs.cloudflare.com",
                "https://code.jquery.com",
                "https://storage.googleapis.com",
            ],
            fontSrc: [
                "'self'",
                "fonts.gstatic.com",
                "cdnjs.cloudflare.com",
                "use.fontawesome.com",
                "data:",
            ],
            scriptSrcAttr: ["'unsafe-inline'"],
            frameSrc:      ["'self'", "js.stripe.com", "https://storage.googleapis.com"],
            mediaSrc:      ["'self'", "https://storage.googleapis.com"],
            workerSrc:     ["'self'", "blob:", "https://storage.googleapis.com"],
            objectSrc:     ["'none'"],
            upgradeInsecureRequests: null,
        },
    },
    // Previene clickjacking
    frameguard:        { action: 'sameorigin' },
    // Previene MIME sniffing
    noSniff:           true,
    // HSTS solo en producción
    strictTransportSecurity: process.env.NODE_ENV === 'production'
        ? { maxAge: 31536000, includeSubDomains: true }
        : false,
    // Ocultar que usamos Express
    hidePoweredBy:     true,
}));

// ─────────────────────────────────────────────────────────────────
//  5. CORS
// ─────────────────────────────────────────────────────────────────
app.use(cors({
    origin:      process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
}));

// ─────────────────────────────────────────────────────────────────
//  6. RATE LIMITING — Capas múltiples
// ─────────────────────────────────────────────────────────────────

// Global: 200 req/15min por IP (protección general)
const globalLimiter = rateLimit({
    windowMs:         15 * 60 * 1000,
    max:              200,
    standardHeaders:  true,
    legacyHeaders:    false,
    message: {
        alertTitle:   'Demasiadas solicitudes',
        alertMessage: 'Intenta nuevamente en 15 minutos.',
        alertIcon:    'warning',
    },
});

// Auth: 20 req/15min por IP (pre-behaviorGuard)
const authLimiter = rateLimit({
    windowMs:         15 * 60 * 1000,
    max:              20,
    standardHeaders:  true,
    legacyHeaders:    false,
    skipSuccessfulRequests: true, // No contar logins exitosos
    message: {
        alertTitle:   'Límite de intentos alcanzado',
        alertMessage: 'Espera 15 minutos antes de continuar.',
        alertIcon:    'warning',
    },
});

// API sensible: 10 req/min (endpoints de datos críticos)
const strictLimiter = rateLimit({
    windowMs:        60 * 1000,
    max:             10,
    standardHeaders: true,
    legacyHeaders:   false,
    message: {
        alertTitle:   'Acceso limitado',
        alertMessage: 'Demasiadas solicitudes. Intenta en un momento.',
        alertIcon:    'warning',
    },
});

app.use(globalLimiter);

// ─────────────────────────────────────────────────────────────────
//  7. PARSERS Y ESTÁTICOS
// ─────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────────────────────────────
//  8. SESIONES CON MONGODB STORE
// ─────────────────────────────────────────────────────────────────
app.use(session({
    secret:           process.env.SESSION_SECRET || 'secreto_temporal_cambiar_en_prod',
    resave:           false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl:        process.env.MONGO_URI,
        ttl:             24 * 60 * 60,   // Sesión expira en 24h
        autoRemove:      'native',        // MongoDB limpia automáticamente
        touchAfter:      3600,            // Re-guardar sesión solo si ha pasado 1h
    }),
    cookie: {
        secure:   process.env.NODE_ENV === 'production',
        httpOnly: true,         // Inaccesible desde JavaScript del cliente
        sameSite: 'lax',        // Protección CSRF básica
        maxAge:   24 * 60 * 60 * 1000,  // 24 horas
    },
    name: 'hs.sid', // No usar nombre por defecto 'connect.sid'
}));

// ─────────────────────────────────────────────────────────────────
//  9. MIDDLEWARE DE INTEGRIDAD DE SESIÓN (en todas las rutas)
// ─────────────────────────────────────────────────────────────────
app.use(sessionIntegrityCheck);

// ─────────────────────────────────────────────────────────────────
//  10. RUTAS
// ─────────────────────────────────────────────────────────────────

// Rutas de autenticación: rate limit + behavior guard en cadena
app.use('/auth', authLimiter, behaviorGuard, authRoutes);

// Rutas generales
app.use('/', indexRoutes);

// Endpoints de alta sensibilidad (wallet, certificados, kill switch)
// app.use('/api/wallet',        strictLimiter, walletRoutes);
// app.use('/api/certificates',  strictLimiter, certificateRoutes);
// Rutas en Express
app.get('/', (req, res) => {
    res.render('index', { 
        login: false, 
        currentPage: 'home', 
        title: 'Human System | Soberanía Digital' 
    });
});

app.get('/tecnologia', (req, res) => {
    res.render('tecnologia', { 
        login: false, 
        currentPage: 'tecnologia', 
        title: 'Tecnología y Seguridad' 
    });
});
// ─────────────────────────────────────────────────────────────────
//  11. LOGOUT
// ─────────────────────────────────────────────────────────────────
app.get('/logout', (req, res) => {
    const humano = req.session.humano;
    req.session.destroy(async () => {
        res.clearCookie('hs.sid');
        // Marcar sesión como inactiva en la DB
        if (humano) {
            try {
                const Human = require('./models/User');
                await Human.findOneAndUpdate(
                    { humanoID: humano },
                    { $set: { sesionActiva: false } }
                );
            } catch (e) {
                console.error('[LOGOUT] Error actualizando sesión:', e.message);
            }
        }
        res.redirect('/login');
    });
});

// ─────────────────────────────────────────────────────────────────
//  12. MANEJO DE ERRORES
// ─────────────────────────────────────────────────────────────────

// 404
app.use((req, res) => {
    res.status(404).render('404', { title: 'Página no encontrada', login: false })
        || res.status(404).send('Error 404: Página no encontrada');
});

// Error general
app.use((err, req, res, next) => {
    console.error('[APP] Error no controlado:', err.message);
    res.status(500).json({
        alertTitle:   'Error del servidor',
        alertMessage: 'Ocurrió un error interno. Intenta más tarde.',
        alertIcon:    'error',
    });
});

// ─────────────────────────────────────────────────────────────────
//  13. ARRANQUE
// ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 7777;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Human System v5.0 corriendo en puerto ${PORT}`);
    console.log(`🛡  Behavior Guard: ACTIVO`);
    console.log(`🍃 Session Store:   MongoDB Atlas`);
    console.log(`🔒 Entorno:         ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;