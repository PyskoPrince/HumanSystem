const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController'); // Importamos el controlador

// Definimos las rutas usando las funciones del controlador
router.get('/login', authController.renderLogin);
router.get('/register', authController.renderRegister);

// Importante: Usamos '/' porque en app.js ya definiste app.use('/auth', authRoutes)
router.post('/', authController.loginUser);

module.exports = router;