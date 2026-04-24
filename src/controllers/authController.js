const Human = require('../models/User'); // Importa el modelo
const bcrypt = require('bcryptjs');

exports.renderLogin = (req, res) => {
    if (req.session.loggedin) return res.redirect('/');
    // Quita el "pages/" de la ruta
    res.render('login', { 
        title: 'Iniciar Sesión', 
        login: false, 
        pageClass: 'page-public page-login' 
    });
};

exports.renderRegister = (req, res) => {
    if (req.session.loggedin) return res.redirect('/');
    // Quita el "pages/" de la ruta
    res.render('register', { 
        title: 'Regístrate', 
        login: false, 
        pageClass: 'page-public page-register' 
    });
};

// 3. Lógica de Login (POST)
exports.loginUser = async (req, res) => {
    try {
        const { humano, contraseña } = req.body;
        let user;

        // Búsqueda multicanal
        if (humano.startsWith('HUM-')) {
            user = await Human.findOne({ humanoID: humano });
        } else if (humano.length === 18) {
            user = await Human.findOne({ 'datosPersonales.curp': humano });
        } else if (humano.length === 13) {
            user = await Human.findOne({ 'datosPersonales.rfc': humano });
        } else if (humano.includes('@')) {
            user = await Human.findOne({ 'datosPersonales.correo': humano });
        } else if (!isNaN(humano)) {
            user = await Human.findOne({ 'datosPersonales.telefono': humano });
        } else {
            return res.status(400).json({ alertTitle: "Error!", alertMessage: "Formato inválido", alertIcon: 'error' });
        }

        if (!user) return res.status(404).json({ alertTitle: "Error!", alertMessage: "Usuario no encontrado", alertIcon: 'error' });

        const match = await bcrypt.compare(contraseña, user.datosPersonales.contraseña);
        if (!match) return res.status(401).json({ alertTitle: "Error!", alertMessage: "Credenciales incorrectas", alertIcon: 'error' });

        // Gestión de sesión
        if (user.sesionActiva) {
            user.sesionActiva = false; 
            await user.save(); 
        }
        user.sesionActiva = true;
        await user.save();

        req.session.loggedin = true;
        req.session.nombre = user.datosPersonales.nombre;
        req.session.humano = user.humanoID;

        return res.status(200).json({ alertTitle: "Bienvenido", alertMessage: `Hola, ${user.datosPersonales.nombre}`, alertIcon: 'success', ruta: '/' });
    } catch (error) {
        console.error("Error en loginUser:", error);
        res.status(500).json({ alertTitle: "Error!", alertMessage: "Error interno del servidor", alertIcon: 'error' });
    }
};
