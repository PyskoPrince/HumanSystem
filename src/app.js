const path = require('path');
// 1. CARGAMOS LAS VARIABLES DE ENTORNO PRIMERO (Usando ruta absoluta)
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const cors = require('cors');

// Importar configuración de DB y rutas
const connectDB = require('./config/database');
const indexRoutes = require('./routes/indexRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();

// 2. CONECTAR A BASE DE DATOS
connectDB();

// --- 3. CONFIGURACIONES ---
app.set('view engine', 'ejs');
// Las vistas están en la misma carpeta src/views
app.set('views', path.join(__dirname, 'views')); 

// --- 4. MIDDLEWARE GLOBAL ---
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            // LISTA DE SCRIPTS PERMITIDOS (JS)
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                "'unsafe-eval'",
                "cdn.jsdelivr.net",
                "cdnjs.cloudflare.com",
                "unpkg.com",
                "js.stripe.com",
                "code.jquery.com",      // <--- IMPORTANTE: jQuery estaba bloqueado
                "use.fontawesome.com"   // <--- IMPORTANTE: Iconos viejos
            ],
            // LISTA DE ESTILOS PERMITIDOS (CSS)
            styleSrc: [
                "'self'",
                "'unsafe-inline'",
                "cdn.jsdelivr.net",
                "fonts.googleapis.com",
                "cdnjs.cloudflare.com", // <--- IMPORTANTE: Animate.css y Croppie vienen de aquí
                "use.fontawesome.com"
            ],
            // IMÁGENES PERMITIDAS
            imgSrc: ["'self'", "data:", "https:", "http:"],
            // CONEXIONES DE DATOS PERMITIDAS (AJAX / FETCH)
            connectSrc: [
                "'self'",
                "https://api.stripe.com",
                "https://maps.googleapis.com",
                "https://cdn.jsdelivr.net",     // Para que no salgan errores de .map
                "https://cdnjs.cloudflare.com", // Para que no salgan errores de .map
                "https://code.jquery.com"
            ],
            // FUENTES (Tipografía e Iconos)
            fontSrc: [
                "'self'", 
                "fonts.gstatic.com", 
                "cdnjs.cloudflare.com", 
                "use.fontawesome.com", 
                "data:" // A veces FontAwesome carga fuentes como data:uri
            ],
            scriptSrcAttr: ["'unsafe-inline'"],
            frameSrc: ["'self'", "js.stripe.com"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: null,
        },
    },
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'))); 

// Configuración de Sesión
app.use(session({
    secret: process.env.SESSION_SECRET || 'secreto_temporal',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: { secure: false } // Cambiar a true cuando instales SSL en producción
}));

// --- 5. RUTAS ---
app.use('/', indexRoutes);
app.use('/auth', authRoutes);


// ✅ Asegúrate de que esté en este orden en tu app.js
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid'); // Limpia la cookie de sesión
        res.redirect('/login');
    });
});

// --- 6. MANEJO DE ERRORES (404) ---
app.use((req, res) => {
    // Si no tienes una vista 404, redirige o manda texto simple por ahora
    res.status(404).send("Error 404: Página no encontrada"); 
});


// --- 7. INICIAR SERVIDOR ---
const PORT = process.env.PORT || 7777;
app.listen(PORT, () => {
    console.log(`🚀 Servidor v5.0 corriendo en puerto ${PORT}`);
});

module.exports = app;