const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const cors = require('cors');

const connectDB = require('./config/database');
const indexRoutes = require('./routes/indexRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();

connectDB();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); 

// --- 4. MIDDLEWARE GLOBAL ---
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
                "use.fontawesome.com"
            ],
            styleSrc: [
                "'self'",
                "'unsafe-inline'",
                "cdn.jsdelivr.net",
                "fonts.googleapis.com",
                "cdnjs.cloudflare.com",
                "use.fontawesome.com"
            ],
            // ✅ AGREGADO: Permitir imágenes de Google Cloud
            imgSrc: ["'self'", "data:", "https:", "http:", "https://storage.googleapis.com"],
            
            // ✅ AGREGADO: Permitir conexiones de datos (Fetch) a Google Cloud
            connectSrc: [
                "'self'",
                "https://api.stripe.com",
                "https://maps.googleapis.com",
                "https://cdn.jsdelivr.net",
                "https://cdnjs.cloudflare.com",
                "https://code.jquery.com",
                "https://storage.googleapis.com"
            ],
            fontSrc: [
                "'self'", 
                "fonts.gstatic.com", 
                "cdnjs.cloudflare.com", 
                "use.fontawesome.com", 
                "data:"
            ],
            scriptSrcAttr: ["'unsafe-inline'"],
            // ✅ AGREGADO: Permitir que los videos de Google Cloud se vean en marcos (frames)
            frameSrc: ["'self'", "js.stripe.com", "https://storage.googleapis.com"],
            // ✅ AGREGADO: Permitir workers de Google Cloud (necesario para algunos scripts premium)
            workerSrc: ["'self'", "blob:", "https://storage.googleapis.com"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: null,
        },
    },
}));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'))); 

app.use(session({
    secret: process.env.SESSION_SECRET || 'secreto_temporal',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax'
    }
}));

app.use('/', indexRoutes);
app.use('/auth', authRoutes);

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});

app.use((req, res) => {
    res.status(404).send("Error 404: Página no encontrada"); 
});

const PORT = process.env.PORT || 7777; 

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor v5.0 corriendo en puerto ${PORT}`);
});

module.exports = app;