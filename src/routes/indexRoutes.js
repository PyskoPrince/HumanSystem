const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const crypto = require('crypto');
const bcrypt = require('bcryptjs'); 
const multer = require('multer'); // Necesario para comparar contraseñas
const fetch = require('node-fetch'); 
const { ethers } = require('ethers');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// --- CONFIGURACIÓN DE GOOGLE CLOUD STORAGE ---
const { Storage } = require('@google-cloud/storage');
const storage = new Storage({
    projectId: process.env.GOOGLE_PROJECT_ID, // feisty-album-374404
    credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        // Limpiamos la clave privada para que Google la acepte sin errores
        private_key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined
    }
});

const bucketName = 'humansystem'; // El nombre que confirmaste
const bucket = storage.bucket(bucketName);

const Human = require('../models/User'); // Asegúrate de que la ruta a tu modelo sea correcta
const viewsController = require('../controllers/viewsController');
const authController = require('../controllers/authController');

// --- MIDDLEWARE DE PROTECCIÓN ---
function isAuthenticated(req, res, next) {
    if (req.session.loggedin) {
        return next();
    } else {
        res.redirect('/login');
    }
}

// --- PÁGINAS PRINCIPALES ---
router.get('/', viewsController.renderHome);
router.get('/info', viewsController.renderInfo);

// ✅ RUTA ORIGINAL
router.get('/validation', viewsController.renderValidation);

// ✅ AGREGA ESTAS DOS RUTAS NUEVAS PARA QUE LEA LOS QRs:
router.get('/validation/human', viewsController.renderValidation);
router.get('/validation/card', viewsController.renderValidation);

router.get('/login', authController.renderLogin);
router.get('/register', authController.renderRegister);

// ── Health Check (para Docker HEALTHCHECK y load balancers) ──
router.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage().heapUsed
    });
});

// --- APIs Y ACTUALIZACIONES  ---

// Ruta para iniciar sesión
router.post('/auth', async (req, res) => {
    try {
        const { humano, contraseña } = req.body;
        let user;

        // Búsqueda por tipo de identificador
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
            return res.status(400).json({
                alertTitle: "Error!",
                alertMessage: "Formato de identificador inválido",
                alertIcon: 'error'
            });
        }

        if (!user) {
            return res.status(404).json({
                alertTitle: "Error!",
                alertMessage: "Usuario no encontrado",
                alertIcon: 'error'
            });
        }

        // Verificar la contraseña
        const match = await bcrypt.compare(contraseña, user.datosPersonales.contraseña);
        if (!match) {
            return res.status(401).json({
                alertTitle: "Error!",
                alertMessage: "Credenciales incorrectas",
                alertIcon: 'error'
            });
        }

        await Human.updateOne(
            { _id: user._id },
            { $set: { sesionActiva: true } }
        );

        // Crear la nueva sesión
        req.session.loggedin = true;
        req.session.nombre = user.datosPersonales.nombre;
        req.session.humano = user.humanoID;

        return res.status(200).json({
            alertTitle: "Bienvenido",
            alertMessage: `Hola, ${user.datosPersonales.nombre}`,
            alertIcon: 'success',
            ruta: '/'
        });

    } catch (error) {
        console.error("Error en /auth:", error);
        return res.status(500).json({
            alertTitle: "Error!",
            alertMessage: "Ocurrió un error al intentar iniciar sesión",
            alertIcon: 'error'
        });
    }
});

// Ruta para verificar datos duplicados en el formuario de registro
router.post('/verificarDuplicados', async (req, res) => {
    try {
        const { curp, rfc, correo, telefono } = req.body;
        // Buscar en la base de datos cualquier coincidencia con los datos proporcionados
        const existingHuman = await Human.findOne({
            $or: [
                { 'datosPersonales.curp': curp },
                { 'datosPersonales.rfc': rfc },
                { 'datosPersonales.correo': correo },
                { 'datosPersonales.telefono': telefono }
            ]
        });
        
        // Si se encuentra una coincidencia, retornar error
        if (existingHuman) {
            return res.status(400).json({
                success: false,
                message: "El CURP, RFC, correo o teléfono ya están registrados en el sistema."
            });
        }
        
        // Si no hay coincidencias, retornar éxito
        return res.status(200).json({
            success: true,
            message: "No hay duplicados. Puedes continuar con el registro."
        });
    } catch (error) {
        console.error('Error al verificar duplicados:', error);
        return res.status(500).json({
            success: false,
            message: "Error interno del servidor al verificar duplicados."
        });
    }
});

// Ruta para procesar pago despues de validar la unicidad de los datos personales
router.post('/procesarPago', async (req, res) => {
    const { paymentMethodId } = req.body; // Recibe el paymentMethodId desde el frontend
    try {
        // Crear una intención de pago utilizando el paymentMethodId
        const paymentIntent = await stripe.paymentIntents.create({
            amount: 50000, // Cantidad a cobrar en centavos (500.00 MXN)
            currency: 'mxn',
            payment_method: paymentMethodId, // Usa el paymentMethodId recibido del frontend
            confirm: true, // Confirma el pago inmediatamente
            automatic_payment_methods: {
                enabled: true,
                allow_redirects: 'never' // Deshabilitar métodos de pago que requieren redirección
            }
        });
        
        if (paymentIntent.status === 'succeeded') {
            res.json({ success: true }); // Pago exitoso
        } else {
            res.json({ success: false, message: 'El pago no fue exitoso.' });
        }
    } catch (error) {
        console.error('Error al procesar el pago:', error);
        res.status(500).json({ success: false, message: 'Error al procesar el pago.' });
    }
});

// ── PAGO INLINE: NUEVA TARJETA ───────────────────────────────────────────────
router.post('/crearIntentoPagoTarjeta', isAuthenticated, async (req, res) => {
    try {
        const { tarjetaID } = req.body;
        const paymentIntent = await stripe.paymentIntents.create({
            amount: 50000, // $500.00 MXN
            currency: 'mxn',
            metadata: { tarjetaID, humanoID: req.session.humano }
        });
        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        console.error('Error creando intento de pago tarjeta:', error);
        res.status(500).json({ error: error.message });
    }
});

// ── CONFIRMAR PAGO TARJETA (después de que Stripe confirma) ─────────────────
router.post('/confirmarPagoTarjetaInline', isAuthenticated, async (req, res) => {
    try {
        const { paymentIntentId, tarjetaID } = req.body;

        // Verificar que el pago fue exitoso
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({ success: false, error: 'El pago no fue confirmado.' });
        }

        const human = await Human.findOne({ 'tarjeta.tarjetaID': tarjetaID });
        if (!human) return res.status(404).json({ success: false, error: 'Tarjeta no encontrada.' });

        const nuevoTarjetaID = generateTarjetaID();
        const nuevoEnlace    = generateTarjetaLink(nuevoTarjetaID);
        const qrUrl          = await generateQRCode(nuevoEnlace);

        await Human.findOneAndUpdate(
            { 'tarjeta.tarjetaID': tarjetaID },
            { $set: {
                'tarjeta.tarjetaID': nuevoTarjetaID,
                'tarjeta.LinkTarjeta': nuevoEnlace,
                'tarjeta.qrCodeUrl': qrUrl,
                'tarjeta.estado': 'comprado'
            }}
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error confirmando pago tarjeta:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── PAGO INLINE: CERTIFICADO ADICIONAL ──────────────────────────────────────
router.post('/crearIntentoPagoCertificado', isAuthenticated, async (req, res) => {
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: 5000, // $50.00 MXN
            currency: 'mxn',
            metadata: { humanoID: req.session.humano }
        });
        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        console.error('Error creando intento de pago certificado:', error);
        res.status(500).json({ error: error.message });
    }
});

// ── CONFIRMAR PAGO CERTIFICADO (después de que Stripe confirma) ──────────────
router.post('/confirmarPagoCertificadoInline', isAuthenticated, async (req, res) => {
    try {
        // 1. Ahora recibimos también la 'direccionEnvio' desde el frontend
        const { paymentIntentId, direccionEnvio } = req.body; 
        const humanoID = req.session.humano;

        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({ success: false, error: 'El pago no fue confirmado.' });
        }

        const human = await Human.findOne({ humanoID });
        if (!human) return res.status(404).json({ success: false, error: 'Humano no encontrado.' });

        const nuevaVersion = (human.certificadosAdicionales?.length || 0) + 1;
        const nuevoCert = generateCertificadoLink(humanoID, nuevaVersion);
        const qrCodeUrl = await generateQRCode(nuevoCert.url);

        const nuevoCertificadoInfo = {
            certificadoID: nuevoCert.certificadoID,
            url: nuevoCert.url,
            qrCodeUrl,
            version: nuevaVersion,
            fechaCompra: new Date(),
            estado: 'activo',
            // ✅ AGREGAMOS ESTE CAMPO NUEVO EN EL ESQUEMA AL VUELO
            direccionEnvioFisico: direccionEnvio || human.datosPersonales.direccion 
        };

        await Human.updateOne(
            { humanoID },
            { 
                $push: { certificadosAdicionales: nuevoCertificadoInfo },
                $inc: { totalCertificadosComprados: 1 }
            }
        );

        res.json({ success: true, certificadoID: nuevoCert.certificadoID, version: nuevaVersion });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

const storagem = multer.memoryStorage(); // Almacenamiento en memoria
// Configuración de almacenamiento en memoria para los archivos subidos
const upload = multer({
    storage: storagem,
    limits: { fileSize: 10 * 1024 * 1024 } // Límite de 10 MB para archivos
}).fields([
    { name: 'firmaDigital', maxCount: 1 },
    { name: 'fotoPerfil', maxCount: 1 }
]); 

// Ruta para el registro
router.post('/register', upload, async (req, res) => {
    try {
        // Verificar el cuerpo de la solicitud
        /*console.log("Datos recibidos en req.body:", req.body); */
        const { nombre, direccion, correo, telefono, contrasena1, contrasena2, curp, rfc } = req.body;   
        // Validaciones
        if (contrasena1 !== contrasena2) {
            return res.status(400).json({
                success: false,
                message: "Las contraseñas no coinciden."
            });
        }
        
        if (contrasena1.length < 8 || contrasena1.length > 20) {
            return res.status(400).json({
                success: false,
                message: "La contraseña debe tener entre 8 y 20 caracteres."
            });
        }
        
        const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
        if (!regex.test(contrasena1)) {
            return res.status(400).json({
                success: false,
                message: "La contraseña debe contener al menos una letra mayúscula, una letra minúscula y un número."
            });
        }
        
        const { fotoPerfil, firmaDigital } = req.files;
        if (!fotoPerfil || !firmaDigital) {
            return res.status(400).json({
                success: false,
                message: "Por favor, asegúrate de confirmar tanto la foto de perfil como la firma digital."
            });
        }
        
        // Generar IDs únicos para el humano y la tarjeta
        const humanoID = generateHumanID(nombre);
        const tarjetaID = generateTarjetaID();

        // Generar enlaces únicos con encriptación avanzada (Local o Producción automático)
        const LinkHumano = generateHumanoLink(humanoID);
        const LinkTarjeta = generateTarjetaLink(tarjetaID);

        const certificadoInicial = generateCertificadoLink(humanoID, 1);
        const qrCertificadoInicial = await generateQRCode(certificadoInicial.url);

        console.log('Enlace único generado para humano:', LinkHumano);
        console.log('Enlace único generado para tarjeta:', LinkTarjeta);
        
        // Validar unicidad
        const existingHuman = await Human.findOne({
            $or: [
                { 'datosPersonales.curp': curp },
                { 'datosPersonales.rfc': rfc },
                { 'datosPersonales.correo': correo },
                { 'datosPersonales.telefono': telefono },
                { humanoID: humanoID }
            ]
        });
        
        if (existingHuman) {
            return res.status(400).json({
                success: false,
                alertTitle: "Datos duplicados",
                alertMessage: "El CURP, RFC, correo o teléfono ya están registrados en el sistema.",
                alertIcon: "error",
                showConfirmButton: true,
                timer: false,
                ruta: 'register'
            });
        }
        
        // Acceder a los buffers de los archivos
        const fotoPerfilBuffer = fotoPerfil[0].buffer;
        const firmaDigitalBuffer = firmaDigital[0].buffer;
        
        // Guardar la firma digital en Google Cloud Storage
        const firmaDigitalFileName = `${humanoID}_firma.png`;
        const firmaDigitalFile = bucket.file(firmaDigitalFileName);
        await firmaDigitalFile.save(firmaDigitalBuffer, { contentType: 'image/png' });
        const firmaDigitalUrl = `https://storage.googleapis.com/${bucketName}/${firmaDigitalFileName}`;
        
        // Guardar la foto de perfil en Google Cloud Storage
        const fotoPerfilFileName = `${humanoID}_foto.png`;
        const fotoPerfilFile = bucket.file(fotoPerfilFileName);
        await fotoPerfilFile.save(fotoPerfilBuffer, { contentType: 'image/png' });
        const fotoPerfilUrl = `https://storage.googleapis.com/${bucketName}/${fotoPerfilFileName}`;
        
        // Encriptar la contraseña del usuario
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(contrasena1, salt);
        
        // Generar los códigos QR usando nuestra nueva función con fallback
        const qrUrlHumano = await generateQRCode(LinkHumano);
        const qrUrlTarjeta = await generateQRCode(LinkTarjeta);
        
        console.log("Correo antes de guardar el nuevo objeto en la base de datos:", correo)
        if (!req.body.correo || req.body.correo === null) {
            throw new Error('Correo es requerido y no puede ser nulo');
        }
        
        console.log("Datos del usuario antes de guardar:", {
            nombre,
            direccion,
            correo,
            telefono,
            curp,
            rfc
        });
        
        const datosTarjeta = generarDatosTarjetaDigital(nombre);
        const datosWallet    = generarBilleteraEthereum();  
        
        // Crear un nuevo objeto Human con los datos recopilados
        const newHuman = new Human({
            billeteraHumana: {
                direccionETH:    datosWallet.direccionETH,
                clavePrivadaETH: datosWallet.clavePrivadaETH,
                balanceMXN:      0,
                balanceHUMANCOIN: 100,   // regalo de bienvenida: 100 HumanCoins
                planActivo:      'free',
                fechaCreacion:   new Date()
            },
            transacciones: [],
            totalTransacciones: 0,
            humanoID: humanoID,
            qrCodeUrl: qrUrlHumano,
            firmaDigitalUrl: firmaDigitalUrl,
            fotoPerfilUrl: fotoPerfilUrl,
            LinkHumano: LinkHumano,
            datosPersonales: {
                nombre: nombre,
                direccion: direccion,
                telefono: telefono,
                correo: correo,
                contraseña: hashedPassword,
                curp: curp,
                rfc: rfc,
            },
            tarjeta: {
                tarjetaID: tarjetaID,
                qrCodeUrl: qrUrlTarjeta,
                LinkTarjeta: LinkTarjeta,
                numeroTarjeta: datosTarjeta.numeroTarjeta,
                fechaVencimiento: datosTarjeta.fechaVencimiento,
                titular: datosTarjeta.titular,
                red: datosTarjeta.red
            },
        });
    
        newHuman.certificadosAdicionales = [{
            certificadoID: certificadoInicial.certificadoID,
            url: certificadoInicial.url,
            qrCodeUrl: qrCertificadoInicial,
            version: 1,
            fechaCompra: new Date(),
            estado: 'activo'
        }];
        newHuman.totalCertificadosComprados = 1;
        
        // Guardar el objeto Human en la base de datos
        await newHuman.save();
        
        // Respuesta exitosa
        return res.status(201).json({ 
            success: true,
            message: `El humano ${humanoID} ha sido registrado correctamente.`
        });
    } catch (error) {
        console.error("Error al registrar el usuario:", error);
        return res.status(500).json({
            success: false,
            message: "Hubo un error al registrar el usuario. Por favor, inténtelo de nuevo."
        });
    }
});

// ════════════════════════════════════════════════════════════════════════════
//  MOTOR QR — TRIPLE FALLBACK
//  1º  qrcode-ai.com   (diseño personalizado con template)
//  2º  qr-api.net      (nueva API, 10k/mes gratis)
//  3º  local qrcode    (emergencia, siempre disponible)
// ════════════════════════════════════════════════════════════════════════════

async function generateQRCode(enlaceValidacion) {
    // ── MOTOR 1: qrcode-ai.com ───────────────────────────────────────────────
    try {
        console.log(`[QR-M1] Intentando motor principal QR AI para: ${enlaceValidacion}`);
        const response = await fetch('https://odin.qrcode-ai.com/api/qrcode', {
            method: 'POST',
            headers: {
                'x-api-key': process.env.QR_API_KEY, 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                to: enlaceValidacion,
                type: 'url',
                template: '69d3d3eeacd791551420de54'
            })
        });

        if (!response.ok) throw new Error(`M1 HTTP ${response.status}`);

        const data = await response.json();
        if (data?.qrcode?.url) {
            console.log(`[QR-M1] ✅ Éxito: ${data.qrcode.url}`);
            return data.qrcode.url;
        }
        throw new Error('M1: respuesta sin qrcode.url');

    } catch (err) {
        console.warn(`[QR-M1] ⚠️ Falló: ${err.message} — activando Motor 2 ecample ME QR CODE ...`);
    }

    // ── MOTOR 2: me-qr.com ───────────────────────────────────────────────
    try {
        console.log(`[QR-M2] Intentando motor me-qr (URL directa sin Base64)...`);
        // Cámbiala a:
        const apiKey = process.env.QR_API_KEY_2;
        if (!apiKey) throw new Error('QR_API_KEY_2 no definida en variables de entorno');
        const response = await fetch('https://me-qr.com/api/v2/qr/link/create', {
            method: 'POST',
            headers: {
                'X-AUTH-TOKEN': apiKey,
                'Content-Type': 'application/json',
                'accept': '*/*'
            },
            body: JSON.stringify({
                title: 'QR Generado Automáticamente',
                format: 'png',
                designType: 'base',
                qrFieldsData: {
                    link: enlaceValidacion
                },
                qrOptions: {
                    size: 300,
                    errorCorrectionLevel: 'H',
                    pattern: 'rounded',
                    patternColor: '#1F4E67',  
                    // El gradiente en el cuerpo suele ser compatible
                    patternGradient: {
                        type: 'linear',
                        angle: 45,
                        colors: [
                            { offset: 0, color: '#ff0000' },
                            { offset: 1, color: '#1F4E67' }
                        ]
                    },
                    patternBackground: '#ffffff',
                    cornetsOuter: 'extra-rounded',
                    // Cambiamos 'Gradient' por 'Color' si el motor no lo soporta en las esquinas
                    cornetsOuterColor: '#1F4E67', 
                    cornetsInterior: 'extra-rounded',
                    cornetsInteriorColor: '#1F4E67',
                    logotype: 'https://i.ibb.co/G3XDtMJ/Logoapp.png',
                    logotypeSize: 0.25,
                    logotypeMargin: 4,
                    logotypeHideBackground: true,
                    isLogoRound: true
                },
                qrFrame: {
                    name: 'noFrame', // Si es 'noFrame', no envíes parámetros de color o gradiente
                    backgroundColor: '#ffffff'
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const dataUrl = `data:image/png;base64,${base64}`;

        console.log(`[QR-M2] ✅ Éxito motor 2 me la pelan  dadsadsas sperras`);
        return dataUrl;

    } catch (err) {
        console.warn(`[QR-M2] ⚠️ Falló: ${err.message} — pasando al Motor 3 que es el local...`);
    }

    // ── MOTOR 3: LOCAL (salvavidas) ──────────────────────────────────────────
    try {
        console.log(`[QR-M3] Generando QR local`);
        const qrDataURL = await QRCode.toDataURL(enlaceValidacion, {
            errorCorrectionLevel: 'H',
            width: 300,
            color: {
                dark: '#1F4E67',
                light: '#FFFFFF'
            }
        });
        console.log(`[QR-M3] ✅ QR local nuevo y correctamente`);
        return qrDataURL;

    } catch (fallbackError) {
        console.error('[QR-M3] ❌ CRÍTICO — los 3 motores fallaron:', fallbackError);
        throw new Error('Incapacidad total para generar la matriz QR. Todos los motores fallaron.');
    }
}

// Funcion para generar HumanID
function generateHumanID(nombre) {
    // Dividir el nombre en partes
    let partes = nombre.split(' ');
    // Asignar partes del nombre con validación flexible
    let primerNombre = partes[0] || '';
    let primerApellido = partes[1] || '';
    let segundoApellido = partes[2] || '';
    // Generar una cadena aleatoria
    let randomString = Math.random().toString(36).substring(2, 10);
    // Construir la parte del nombre asegurando que siempre se tenga al menos una parte del nombre
    let namePart = `${primerApellido.substring(0, 2)}${segundoApellido.substring(0, 2)}${primerNombre.substring(0, 2)}`.toUpperCase();
    // Crear el ID humano, garantizando que no sea una cadena vacía
    let humanoID = `HUM-${namePart}${randomString}`.toUpperCase().trim(); // Agregar el prefijo "HUM-"
    if (humanoID === `HUM-${randomString.toUpperCase()}`) {
        humanoID = `HUM-${primerNombre.substring(0, 2)}${randomString}`.toUpperCase().trim();
    }
    return humanoID;
}

// Funcion para generar TarjetaID
function generateTarjetaID() {
    return `TAR-${Math.random().toString(36).substring(2, 10).toUpperCase()}`; // Agregar el prefijo "TAR-"
}

// Genera y encripta el número de tarjeta para almacenamiento
function generarDatosTarjetaDigital(nombre) {
    // ── Red: 50% Visa (4), 50% Mastercard (5) ──
    const red = Math.random() < 0.5 ? 'visa' : 'mastercard';
    const primerDigito = red === 'visa' ? '4' : '5';

    let numero = primerDigito;
    for (let i = 0; i < 15; i++) {
        numero += Math.floor(Math.random() * 10);
    }

    const fecha = new Date();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const año = String(fecha.getFullYear() + 3).slice(-2);

    return {
        numeroTarjeta: encryptID(numero),
        fechaVencimiento: `${mes}/${año}`,
        titular: nombre.toUpperCase(),
        red
    };
}

const getBaseUrl = () => {
    // Esto fuerza a que SIEMPRE use 'https://www.humansystem.mx/validation'
    return `${process.env.BASE_URL}/validation`;
};

// Modifica tus funciones de generación de links en routes.js:
const generateHumanoLink = (humanoID) => {
    // Aquí 'encryptID' debe ser la función AES-256-GCM que configuramos antes
    const encryptedHumanoID = encryptID(humanoID);
    
    // Usamos URLSearchParams para asegurar que el token viaja seguro en la URL
    const queryParams = new URLSearchParams({ token: encryptedHumanoID }).toString();
    return `${getBaseUrl()}/human?${queryParams}`;
};

const generateTarjetaLink = (tarjetaID) => {
    const encryptedTarjetaID = encryptID(tarjetaID);
    const queryParams = new URLSearchParams({ token: encryptedTarjetaID }).toString();
    return `${getBaseUrl()}/card?${queryParams}`;
};

// Función para generar enlace único de certificado adicional
function generateCertificadoLink(humanoID, version) {
    // Creamos un ID único para este certificado (versión + timestamp)
    const certificadoID = `CERT-${humanoID.split('-')[1]}-V${version}-${Date.now().toString(36).toUpperCase()}`;
    const encryptedCertificadoID = encryptID(certificadoID);
    const queryParams = new URLSearchParams({ token: encryptedCertificadoID }).toString();
    return {
        certificadoID: certificadoID,
        url: `${getBaseUrl()}/certificate?${queryParams}`,
        version: version
    };
}

// Ruta para obtener la próxima versión de certificado
router.post('/get-next-certificate-version', isAuthenticated, async (req, res) => {
    try {
        const { humanoID } = req.body;
        const human = await Human.findOne({ humanoID });
        if (!human) {
            return res.json({ nextVersion: 1 });
        }        
        const nextVersion = (human.certificadosAdicionales?.length || 0) + 1;
        res.json({ nextVersion });
    } catch (error) {
        console.error('Error:', error);
        res.json({ nextVersion: 1 });
    }
});

// ── GET CERTIFICADOS ─────────────────────────────────────────────────────────
router.post('/getCertificados', isAuthenticated, async (req, res) => {
    try {
        const humanoID = req.session.humano;

        const human = await Human.findOne(
            { humanoID },
            { certificadosAdicionales: 1 } // Solo traemos el campo necesario
        );

        if (!human) {
            return res.status(404).json({ success: false, certificados: [], message: 'Humano no encontrado' });
        }

        // Ordenamos del más reciente al más antiguo
        const certificados = (human.certificadosAdicionales || [])
            .sort((a, b) => new Date(b.fechaCompra) - new Date(a.fechaCompra));

        return res.json({ success: true, certificados });

    } catch (error) {
        console.error('Error en /getCertificados:', error);
        return res.status(500).json({ success: false, certificados: [], message: 'Error del servidor' });
    }
});

// ── REPORTAR CERTIFICADO ─────────────────────────────────────────────────────
router.post('/reportarCertificado', isAuthenticated, async (req, res) => {
    try {
        const { certificadoID } = req.body;
        const humanoID = req.session.humano;

        if (!certificadoID) {
            return res.status(400).json({ success: false, error: 'certificadoID requerido' });
        }

        // Verificamos que el certificado pertenezca al usuario de la sesión (seguridad)
        const human = await Human.findOne({
            humanoID,
            'certificadosAdicionales.certificadoID': certificadoID
        });

        if (!human) {
            return res.status(404).json({ success: false, error: 'Certificado no encontrado o no pertenece a este usuario' });
        }

        // Verificar que no esté ya reportado
        const cert = human.certificadosAdicionales.find(c => c.certificadoID === certificadoID);
        if (cert && cert.estado === 'reportado') {
            return res.status(400).json({ success: false, error: 'Este certificado ya está reportado' });
        }

        // Actualizar solo el certificado específico dentro del array
        await Human.updateOne(
            { humanoID, 'certificadosAdicionales.certificadoID': certificadoID },
            { $set: { 'certificadosAdicionales.$.estado': 'reportado' } }
        );

        return res.json({ success: true, message: 'Certificado reportado correctamente' });

    } catch (error) {
        console.error('Error en /reportarCertificado:', error);
        return res.status(500).json({ success: false, error: 'Error del servidor' });
    }
});

// Función de Encriptación de Grado Militar (AES-256-GCM)
function encryptID(id) {
    if (typeof id !== 'string' || !id) {
        throw new TypeError('El argumento ID debe ser una cadena no vacía');
    }
    const algorithm = 'aes-256-gcm'; // Actualizado a GCM
    const secretKey = Buffer.from(process.env.ENCRYPTION_KEY, 'hex'); // Debe ser de 32 bytes
    const iv = crypto.randomBytes(16);
    
    if (!secretKey || !iv) {
        throw new Error('La ENCRYPTION_KEY no está definida correctamente.');
    }
    
    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
    let encrypted = cipher.update(id, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Tag de autenticación (evita que modifiquen el token)
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Guardamos IV + AuthTag + TextoEncriptado
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

// Desencriptar Token para Validación (AES-256-GCM)
const decryptID = (encryptedID) => {
    try {
        const secretKey = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
        const parts = encryptedID.split(':');
        
        if (parts.length !== 3) {
            throw new Error('El formato del token cifrado está corrupto o ha sido alterado.');
        }
        
        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encryptedText = parts[2];
        
        const decipher = crypto.createDecipheriv('aes-256-gcm', secretKey, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        // En lugar de crashear el servidor, capturamos el error silenciosamente
        console.error('[ALERTA DE SEGURIDAD] Intento de vulneración o token corrupto:', error.message);
        throw new Error('Error de validación biométrica.');
    }
};

// AHORA, LA RUTA '/generateQRCode' QUEDA ASÍ:
router.post('/generateQRCode', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ success: false, message: "URL no proporcionada." });
        }
        // Simplemente llama a la función de ayuda que ahora es global
        const qrCodeUrl = await generateQRCode(url);
        res.json({ success: true, qrCodeUrl: qrCodeUrl });
        
    } catch (error) {
        console.error("Error al generar el código QR:", error);
        res.status(500).json({ success: false, message: "Error al generar el código QR." });
    }
});

// NUEVA RUTA PARA OBTENER FOTO DE PERFIL DEL USUARIO DINÁMICAMENTE
router.post('/api/get-user-profile-pic', async (req, res) => {
    try {
        console.log('========== [API FOTO PERFIL] INICIO ==========');
        console.log('[1] Body recibido:', req.body);
        
        const { identifier } = req.body;
        let user;
        let searchTerm = identifier.trim();

        console.log('[2] Identificador original:', identifier);
        console.log('[3] SearchTerm después de trim:', searchTerm);
        console.log('[4] Longitud del searchTerm:', searchTerm.length);

        if (!searchTerm || searchTerm.length < 3) {
            console.log('[5] ❌ Identificador demasiado corto');
            return res.json({ success: false, message: "Identificador demasiado corto." });
        }

        // ⭐ MISMA LÓGICA QUE USA TU LOGIN ⭐
        console.log('[6] Detectando tipo de identificador...');
        
        if (searchTerm.startsWith('HUM-')) {
            console.log('[7] ✅ Detectado como HUMANO ID');
            user = await Human.findOne({ humanoID: searchTerm }, 'fotoPerfilUrl');
            console.log('[8] Resultado búsqueda por humanoID:', user ? 'Encontrado' : 'No encontrado');
            if (user) console.log('[8.1] FotoPerfilUrl:', user.fotoPerfilUrl);
        } 
        else if (searchTerm.includes('@')) {
            console.log('[9] ✅ Detectado como CORREO');
            console.log('[9.1] Correo original (mayúsculas):', searchTerm);
            const emailLower = searchTerm.toLowerCase();
            console.log('[9.2] Correo convertido a minúsculas:', emailLower);
            user = await Human.findOne({ 'datosPersonales.correo': emailLower }, 'fotoPerfilUrl');
            console.log('[10] Resultado búsqueda por correo:', user ? 'Encontrado' : 'No encontrado');
            if (user) console.log('[10.1] FotoPerfilUrl:', user.fotoPerfilUrl);
        } 
        else if (searchTerm.length === 18 && /^[A-Z0-9]+$/.test(searchTerm)) {
            console.log('[11] ✅ Detectado como CURP');
            console.log('[11.1] CURP:', searchTerm);
            user = await Human.findOne({ 'datosPersonales.curp': searchTerm }, 'fotoPerfilUrl');
            console.log('[12] Resultado búsqueda por CURP:', user ? 'Encontrado' : 'No encontrado');
            if (user) console.log('[12.1] FotoPerfilUrl:', user.fotoPerfilUrl);
        } 
        else if ((searchTerm.length === 13 || searchTerm.length === 12) && /^[A-Z0-9]+$/.test(searchTerm)) {
            console.log('[13] ✅ Detectado como RFC');
            console.log('[13.1] RFC:', searchTerm);
            user = await Human.findOne({ 'datosPersonales.rfc': searchTerm }, 'fotoPerfilUrl');
            console.log('[14] Resultado búsqueda por RFC:', user ? 'Encontrado' : 'No encontrado');
            if (user) console.log('[14.1] FotoPerfilUrl:', user.fotoPerfilUrl);
        } 
        else if (/^\d+$/.test(searchTerm) && searchTerm.length >= 8 && searchTerm.length <= 10) {
            console.log('[15] ✅ Detectado como TELÉFONO');
            console.log('[15.1] Teléfono:', searchTerm);
            user = await Human.findOne({ 'datosPersonales.telefono': searchTerm }, 'fotoPerfilUrl');
            console.log('[16] Resultado búsqueda por teléfono:', user ? 'Encontrado' : 'No encontrado');
            if (user) console.log('[16.1] FotoPerfilUrl:', user.fotoPerfilUrl);
        }
        else {
            console.log('[17] ❌ Formato no reconocido - No coincide con ningún patrón');
            console.log('[17.1] Longitud:', searchTerm.length);
            console.log('[17.2] Es número?', /^\d+$/.test(searchTerm));
            console.log('[17.3] Tiene @?', searchTerm.includes('@'));
            console.log('[17.4] Empieza con HUM-?', searchTerm.startsWith('HUM-'));
            return res.json({ success: false, message: "Formato de identificador no reconocido." });
        }

        console.log('[18] Verificando resultado final...');
        if (user && user.fotoPerfilUrl) {
            console.log('[19] ✅ ÉXITO - Foto encontrada para el usuario');
            console.log('[19.1] URL de la foto:', user.fotoPerfilUrl);
            return res.json({ success: true, fotoPerfilUrl: user.fotoPerfilUrl });
        } else {
            console.log('[20] ❌ FALLO - No se encontró usuario o no tiene foto');
            console.log('[20.1] Usuario existe?', !!user);
            console.log('[20.2] Tiene foto?', user ? !!user.fotoPerfilUrl : false);
            return res.json({ success: false, message: "Usuario no encontrado o sin foto de perfil." });
        }

    } catch (error) {
        console.error('[ERROR] ❌ Error en /api/get-user-profile-pic:', error);
        console.error('[ERROR] Stack trace:', error.stack);
        return res.status(500).json({ success: false, message: "Error del servidor." });
    }
});

router.post('/verificarEstado', isAuthenticated, async (req, res) => {
    try {
        // Extraemos humanoID del cuerpo de la petición
        const { humanoID } = req.body;

        // Validación de seguridad: si no llega el ID o llega vacío, detenemos el proceso
        if (!humanoID || typeof humanoID !== 'string' || humanoID === '[object Object]') {
            console.error("Error: Se recibió un ID inválido:", humanoID);
            return res.status(400).json({ estado: 'error', message: 'ID de humano no válido' });
        }

        const human = await Human.findOne({ humanoID: humanoID });
        
        if (!human) {
            return res.json({ estado: 'no-encontrado', message: 'Humano no encontrado' });
        }
        
        // Enviamos el estado de la tarjeta
        const tarjetaEstado = human.tarjeta ? human.tarjeta.estado : 'no-encontrado';
        return res.json({ estado: tarjetaEstado });

    } catch (error) {
        console.error("Error al verificar el estado:", error);
        return res.status(500).json({ estado: 'error', message: 'Error interno del servidor' });
    }
});

router.post('/actualizarEstado', isAuthenticated, async (req, res) => {
    const { humanoID } = req.body;
    try {
        const human = await Human.findOneAndUpdate(
            { humanoID }, // Buscar por humanoID
            { $set: { 'tarjeta.estado': 'inactivo' } },
            { new: true }
        );
        if (!human) return res.json({ estado: 'no-encontrado' });
        res.json({ estado: 'inactivo', message: 'Estado actualizado' });
    } catch (error) {
        res.status(500).json({ estado: 'error' });
    }
});

// ══════════════════════════════════════════════════════════════════════
//  VALIDADOR UNIFICADO — Soporta tokens HUM-, TAR- y CERT-
// ══════════════════════════════════════════════════════════════════════
router.post('/validar', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ estado: 'error', message: 'Identificador ausente' });
    }

    try {
        const decryptedID = decryptID(decodeURIComponent(token));

        // ── TOKEN DE HUMANO ────────────────────────────────────────────
        if (decryptedID.startsWith('HUM-')) {
            const human = await Human.findOne({ humanoID: decryptedID });
            if (!human) {
                return res.json({
                    tipo: 'humano',
                    estado: 'no-encontrado'
                });
            }
            // Solo mandamos datos personales si el humano está activo
            const estadoHumano = human.estado || 'activado';
            const datosPublicos = {
                tipo: 'humano',
                estado: estadoHumano,
                humanoID: human.humanoID
            };
            if (estadoHumano === 'activado') {
                datosPublicos.nombre = human.datosPersonales?.nombre || null;
                datosPublicos.fotoPerfilUrl = human.fotoPerfilUrl || null;
            }
            return res.json(datosPublicos);
        }

        // ── TOKEN DE TARJETA ───────────────────────────────────────────
        else if (decryptedID.startsWith('TAR-')) {
            const human = await Human.findOne({ 'tarjeta.tarjetaID': decryptedID });
            if (!human) {
                return res.json({
                    tipo: 'tarjeta',
                    estado: 'no-encontrado'
                });
            }
            return res.json({
                tipo: 'tarjeta',
                estado: human.tarjeta.estado,
                titular: human.tarjeta.titular || null,
                red: human.tarjeta.red || null
            });
        }

        // ── TOKEN DE CERTIFICADO ───────────────────────────────────────
        else if (decryptedID.startsWith('CERT-')) {
            const human = await Human.findOne({
                'certificadosAdicionales.certificadoID': decryptedID
            });
            if (!human) {
                return res.json({
                    tipo: 'certificado',
                    estado: 'no-encontrado'
                });
            }
            const cert = human.certificadosAdicionales.find(
                c => c.certificadoID === decryptedID
            );
            return res.json({
                tipo: 'certificado',
                estado: cert ? cert.estado : 'invalido',
                version: cert?.version || null,
                certificadoID: decryptedID,
                titular: human.datosPersonales?.nombre || null,
                humanoID: human.humanoID
            });
        }

        // ── TOKEN DESCONOCIDO ──────────────────────────────────────────
        else {
            return res.status(403).json({
                estado: 'error',
                message: 'Firma biométrica no reconocida.'
            });
        }

    } catch (error) {
        console.error('[SEGURIDAD] Token inválido o corrupto:', error.message);
        return res.status(403).json({
            estado: 'error',
            message: 'Integridad del token comprometida.'
        });
    }
});

/* // Actualizar estado al reportar la tarjeta como perdida
app.post('/actualizarEstado', async (req, res) => {
    const { humanoID } = req.body;
    try {
        // Actualizar el estado del humano
        const human = await Human.findOneAndUpdate(
            { humanoID },
            { estado: 'inactivo' },
            { new: true } // Devuelve el documento actualizado
        );
        if (!human) {
            return res.json({ estado: 'no-encontrado', message: 'Humano no encontrado' });
        }
        
        // Actualizar el estado de la tarjeta asociada
        const tarjeta = await Tarjeta.findOneAndUpdate(
            { humanoID },
            { estado: 'inactivo' },
            { new: true } // Devuelve el documento actualizado
        );
        if (!tarjeta) {
            return res.json({ estado: 'no-encontrado', message: 'Tarjeta no encontrada' });
        }

        return res.json({ estado: 'inactivo', message: 'Estado actualizado exitosamente' });
    } catch (error) {
        console.error("Error al actualizar el estado:", error);
        return res.json({ estado: 'error', message: 'Error al actualizar el estado' });
    }
}); */

 // Actualizar descripción
router.post('/updateDescripcion', async (req, res) => {
    try {
        const { descripcion } = req.body;
        console.log("Updating descripcion for", req.session.humano);
        console.log("New descripcion:", descripcion); 
        await Human.updateOne({ humanoID: req.session.humano }, { descripcion });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error al actualizar la descripción." });
    }
});

// Actualizar enlaces de redes sociales del perfil humano
router.post('/updateSocialLinks', async (req, res) => {
    try {
        const { socialLinks, contrasena } = req.body;
        console.log('Datos recibidos en el servidor:', req.body); // Añade este log

        const { humano } = req.session;
        if (!req.session.loggedin) {
            return res.status(401).json({ success: false, message: "No autorizado" });
        }

        const user = await Human.findOne({ humanoID: humano });
        if (!user) {
            return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
        }

        const unsetFields = {};
        const updateFields = {};
        let alreadyDeletedLinks = [];  // Enlaces que ya están eliminados

        for (const [key, value] of Object.entries(socialLinks)) {
            if (value === '') {
                // Verificar si el enlace ya está eliminado
                if (!user.socialLinks || !user.socialLinks[key]) {
                    alreadyDeletedLinks.push(key); // Añadir a la lista de enlaces ya eliminados
                } else {
                    unsetFields[`socialLinks.${key}`] = 1; // Marcar para eliminar
                }
            } else {
                updateFields[`socialLinks.${key}`] = value; // Preparar para actualizar
            }
        }

        // Si se detectan enlaces ya eliminados, devolver un mensaje inmediato
        if (alreadyDeletedLinks.length > 0) {
            return res.status(200).json({
                success: false,
                message: `El enlace ${alreadyDeletedLinks[0]} ya está eliminado.`,
                alreadyDeletedLinks
            });
        }

        // Verificación de contraseña solo si se está intentando eliminar un enlace
        if (Object.keys(unsetFields).length > 0) {
            if (!contrasena) {
                return res.status(400).json({ success: false, error: 'Contraseña requerida para eliminar el enlace.' });
            }
            
            const isMatch = await bcrypt.compare(contrasena, user.datosPersonales.contraseña);
            if (!isMatch) {
                return res.status(400).json({ success: false, error: 'Contraseña incorrecta.' });
            }
        }

        // No permitir actualizaciones o eliminaciones si no se detectan cambios
        if (Object.keys(updateFields).length === 0 && Object.keys(unsetFields).length === 0) {
            return res.status(400).json({ success: false, message: 'No se realizaron cambios.' });
        }

        // Realizar la actualización en la base de datos
        const updateResult = await Human.updateOne(
            { humanoID: humano },
            { $set: updateFields, $unset: unsetFields }
        );

        if (updateResult.modifiedCount === 0) {
            return res.status(404).json({ success: false, message: "No se encontraron cambios para actualizar o eliminar." });
        }

        res.json({ success: true });

    } catch (error) {
        console.error("Error al actualizar o eliminar los enlaces de redes sociales:", error);
        res.status(500).json({ success: false, message: "Error al actualizar o eliminar los enlaces de redes sociales.", error: error.message });
    }
});

async function sendVerificationCode(telefono) {
    try {
        // Enviar el código de verificación al número de teléfono
        await twilioClient.verify.v2.services(serviceSid)
            .verifications
            .create({ to: `+521${telefono}`, channel: 'sms' }); // Usar el canal 'sms'

        console.log(`Código de verificación enviado a ${telefono}`);
    } catch (error) {
        console.error('Error enviando el código de verificación:', error);
        throw new Error('No se pudo enviar el código de verificación.');
    }
}

router.post('/updateTelefono', async (req, res) => {
    if (req.session.loggedin) {
        try {
            const { telefono } = req.body;

            if (!/^\d{10}$/.test(telefono)) {
                return res.json({ success: false, error: "El número de teléfono debe tener exactamente 10 dígitos." });
            }

            // Llamar a la función que envía el código de verificación
            await sendVerificationCode(telefono);

            req.session.tempTelefono = telefono; // Guardar teléfono temporalmente

            res.json({ success: true, message: "Código de verificación enviado." });
        } catch (error) {
            console.error("Error al actualizar el teléfono:", error);
            res.json({ success: false, error: error.message });
        }
    } else {
        res.json({ success: false, error: "No autorizado" });
    }
});

router.post('/verifyCode', async (req, res) => {
    if (req.session.loggedin) {
        try {
            const { code } = req.body;
            const telefono = req.session.tempTelefono; // Obtener el teléfono temporal guardado en la sesión

            // Verificar el código de verificación con Twilio
           const verificationCheck = await twilioClient.verify.v2.services(serviceSid)
                .verificationChecks
                .create({ to: `+52${telefono}`, code });

            if (verificationCheck.status === 'approved') {
                // Actualizar el teléfono en la base de datos
                await Human.updateOne({ humanoID: req.session.humano }, { $set: { telefono: telefono } });

                // Limpiar sesión
                req.session.verificationCode = null;
                req.session.tempTelefono = null;

                res.json({ success: true, message: "Teléfono actualizado correctamente." });
            } else {
                res.json({ success: false, error: "Código de verificación incorrecto." });
            }
        } catch (error) {
            console.error("Error al verificar el código:", error);
            res.json({ success: false, error: error.message });
        }
    } else {
        res.json({ success: false, error: "No autorizado" });
    }
});

// Ruta para actualizar el correo
router.post('/updateCorreo', async (req, res) => {
    if (req.session.loggedin) {
        try {
            const { correo } = req.body;
            await Human.updateOne(
                { humanoID: req.session.humano },
                { $set: { 'datosPersonales.correo': correo } }
            );
            res.json({ success: true });
        } catch (error) {
            console.error("Error al actualizar el correo:", error);
            res.json({ success: false, error: error.message });
        }
    } else {
        res.json({ success: false, error: "No autorizado" });
    }
});

router.post('/updateDireccion', async (req, res) => {
    if (req.session.loggedin) {
        try {
            const { direccion, contrasena } = req.body;
            const humanoID = req.session.humano;

            // Buscar al usuario
            const user = await Human.findOne({ humanoID });
            if (!user) {
                return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
            }

            // Verificar si se está intentando eliminar la dirección
            if (direccion === "" && contrasena) {
                // Verificar la contraseña
                const isMatch = await bcrypt.compare(contrasena, user.datosPersonales.contraseña);
                if (!isMatch) {
                    return res.status(400).json({ success: false, error: 'Contraseña incorrecta' });
                }

                // Eliminar la dirección usando $unset
                await Human.updateOne(
                    { humanoID },
                    { $unset: { 'datosPersonales.direccion': 1 } } // Corregido para eliminar correctamente
                );
                return res.json({ success: true, message: 'Dirección eliminada correctamente' });
            }

            // Actualizar la dirección si no se elimina
            if (direccion) { // Solo intenta actualizar si la dirección no está vacía
                await Human.updateOne(
                    { humanoID },
                    { $set: { 'datosPersonales.direccion': direccion } }
                );
                return res.json({ success: true, message: 'Dirección actualizada correctamente' });
            }

            // Si llegas aquí, significa que la operación no es válida
            return res.status(400).json({ success: false, error: 'Operación no válida' });

        } catch (error) {
            console.error("Error al actualizar la dirección:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    } else {
        res.status(401).json({ success: false, error: "No autorizado" });
    }
});

router.post('/updateTarjetaDebito', async (req, res) => {
    if (req.session.loggedin) {
        try {
            const { Tarjetadebito, contrasena } = req.body;
            const humanoID = req.session.humano;

            // Buscar al usuario
            const user = await Human.findOne({ humanoID });
            if (!user) {
                return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
            }

            // Si hay una tarjeta de débito, actualizarla
            if (Tarjetadebito) {
                await Human.updateOne(
                    { humanoID },
                    { $set: { 'datosPersonales.Tarjetadebito': Tarjetadebito } }
                );
                return res.json({ success: true, message: 'Tarjeta de débito actualizada correctamente' });
            }

            // Si llegas aquí, la operación no es válida
            return res.status(400).json({ success: false, error: 'Operación no válida' });

        } catch (error) {
            console.error("Error al actualizar la tarjeta de débito:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    } else {
        res.status(401).json({ success: false, error: "No autorizado" });
    }
});

router.post('/deleteTarjetaDebito', async (req, res) => {
    if (req.session.loggedin) {
        try {
            const { contrasena } = req.body;
            const humanoID = req.session.humano;

            // Buscar al usuario
            const user = await Human.findOne({ humanoID });
            if (!user) {
                return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
            }

            // Verificar la contraseña
            const isMatch = await bcrypt.compare(contrasena, user.datosPersonales.contraseña);
            if (!isMatch) {
                return res.status(400).json({ success: false, error: 'Contraseña incorrecta' });
            }

            // Eliminar la tarjeta de débito usando $unset
            await Human.updateOne(
                { humanoID },
                { $unset: { 'datosPersonales.Tarjetadebito': 1 } }
            );
            return res.json({ success: true, message: 'Tarjeta de débito eliminada correctamente' });

        } catch (error) {
            console.error("Error al eliminar la tarjeta de débito:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    } else {
        res.status(401).json({ success: false, error: "No autorizado" });
    }
});

// ════════════════════════════════════════════════════════════════════════════
//  GENERADOR DE BILLETERA ETHEREUM
// ════════════════════════════════════════════════════════════════════════════
function generarBilleteraEthereum() {
    const wallet = ethers.Wallet.createRandom();
    return {
        direccionETH:    wallet.address,
        clavePrivadaETH: encryptID(wallet.privateKey)  // AES-256-GCM
    };
}

// Función auxiliar para generar ID de transacción
function generarTransaccionID(humanoID) {
    return `TXN-${humanoID.split('-')[1]}-${Date.now().toString(36).toUpperCase()}`;
}

// ── Embedding ligero para Vector Search (sin modelo externo) ──
// Convierte texto a vector de 128 dimensiones basado en hash de caracteres
function textoAVector(texto, dims = 128) {
    const t = (texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const vec = new Array(dims).fill(0);
    for (let i = 0; i < t.length; i++) {
        const idx = (t.charCodeAt(i) * (i + 1)) % dims;
        vec[idx] += 1 / (t.length || 1);
    }
    // Normalizar L2
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map(v => parseFloat((v / norm).toFixed(6)));
}

// ════════════════════════════════════════════════════════════════════════════
//  BILLETERA HUMANA — RUTAS CRUD
// ════════════════════════════════════════════════════════════════════════════

// ── GET: Datos de la billetera ───────────────────────────────────────────────
router.get('/billetera/datos', isAuthenticated, async (req, res) => {
    try {
        const human = await Human.findOne(
            { humanoID: req.session.humano },
            {
                'billeteraHumana.direccionETH': 1,
                'billeteraHumana.balanceMXN': 1,
                'billeteraHumana.balanceUSD': 1,
                'billeteraHumana.balanceETH': 1,
                'billeteraHumana.balanceBTC': 1,
                'billeteraHumana.balanceUSDC': 1,
                'billeteraHumana.balanceHUMANCOIN': 1,
                'billeteraHumana.planActivo': 1,
                'billeteraHumana.identidadVerificada': 1,
                'billeteraHumana.tarjetaVirtualEstado': 1,
                // ⚠️ clavePrivadaETH NUNCA se envía al cliente
            }
        );

        if (!human) return res.status(404).json({ success: false, error: 'Humano no encontrado' });

        res.json({ success: true, billetera: human.billeteraHumana });
    } catch (err) {
        console.error('[BILLETERA] Error al obtener datos:', err);
        res.status(500).json({ success: false, error: 'Error del servidor' });
    }
});

// ── GET: Historial de transacciones (paginado) ────────────────────────────────
router.post('/billetera/historial', isAuthenticated, async (req, res) => {
    try {
        const { pagina = 1, limite = 20, tipo, moneda } = req.body;
        const humanoID = req.session.humano;

        const human = await Human.findOne({ humanoID }, { transacciones: 1 });
        if (!human) return res.status(404).json({ success: false });

        let txns = human.transacciones || [];

        // Filtros opcionales
        if (tipo)   txns = txns.filter(t => t.tipo === tipo);
        if (moneda) txns = txns.filter(t => t.moneda === moneda);

        // Ordenar del más reciente al más antiguo
        txns.sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));

        const total  = txns.length;
        const inicio = (pagina - 1) * limite;
        const paginas = Math.ceil(total / limite);

        res.json({
            success: true,
            transacciones: txns.slice(inicio, inicio + limite),
            total,
            pagina,
            paginas
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── POST: Vector Search — Detectar transacciones similares (anti-duplicado) ──
router.post('/billetera/buscar-similar', isAuthenticated, async (req, res) => {
    try {
        const { descripcion, monto, moneda } = req.body;
        if (!descripcion) return res.json({ success: true, similares: [] });

        const humanoID = req.session.humano;
        const human    = await Human.findOne({ humanoID }, { transacciones: 1 });
        if (!human)    return res.json({ success: true, similares: [] });

        const queryVec  = textoAVector(`${descripcion} ${moneda} ${monto}`);
        const THRESHOLD = 0.82; // similitud coseno mínima

        // Calcular similitud coseno en memoria (fallback si no hay Atlas Vector Search)
        const cosSim = (a, b) => {
            let dot = 0, na = 0, nb = 0;
            for (let i = 0; i < a.length; i++) {
                dot += a[i] * b[i];
                na  += a[i] * a[i];
                nb  += b[i] * b[i];
            }
            return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
        };

        const similares = (human.transacciones || [])
            .filter(t => t.descripcionVec && t.descripcionVec.length > 0)
            .map(t => ({
                ...t.toObject(),
                similitud: cosSim(queryVec, t.descripcionVec)
            }))
            .filter(t => t.similitud >= THRESHOLD)
            .sort((a, b) => b.similitud - a.similitud)
            .slice(0, 5);

        res.json({ success: true, similares });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── POST: Depositar MXN (Stripe PaymentIntent) ────────────────────────────────
router.post('/billetera/depositar', isAuthenticated, async (req, res) => {
    try {
        const { monto, descripcion = 'Depósito a billetera' } = req.body;
        const humanoID = req.session.humano;

        if (!monto || monto < 10) {
            return res.status(400).json({ success: false, error: 'Monto mínimo: $10 MXN' });
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount:   Math.round(monto * 100),
            currency: 'mxn',
            metadata: { humanoID, tipo: 'deposito_billetera', descripcion }
        });

        res.json({ success: true, clientSecret: paymentIntent.client_secret });
    } catch (err) {
        console.error('[BILLETERA] Error al depositar:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── POST: Confirmar depósito (post-Stripe) ────────────────────────────────────
router.post('/billetera/confirmar-deposito', isAuthenticated, async (req, res) => {
    try {
        const { paymentIntentId, descripcion = 'Depósito' } = req.body;
        const humanoID = req.session.humano;

        const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (pi.status !== 'succeeded') {
            return res.status(400).json({ success: false, error: 'Pago no confirmado' });
        }

        const monto = pi.amount / 100;
        const txnID = generarTransaccionID(humanoID);
        const vec   = textoAVector(`${descripcion} MXN ${monto}`);

        const nueva = {
            transaccionID:   txnID,
            tipo:            'deposito',
            moneda:          'MXN',
            monto,
            descripcion,
            descripcionVec:  vec,
            estado:          'completada',
            paymentIntentId: pi.id,
            fechaCompletada: new Date()
        };

        await Human.updateOne(
            { humanoID },
            {
                $inc:  { 'billeteraHumana.balanceMXN': monto, totalTransacciones: 1 },
                $push: { transacciones: nueva }
            }
        );

        res.json({ success: true, transaccionID: txnID, nuevoBalance: null });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── POST: Transferir HumanCoins a otro Humano ─────────────────────────────────
router.post('/billetera/transferir', isAuthenticated, async (req, res) => {
    try {
        const { destinatarioID, monto, moneda = 'HUMANCOIN', descripcion = 'Transferencia' } = req.body;
        const remitenteID = req.session.humano;

        if (remitenteID === destinatarioID) {
            return res.status(400).json({ success: false, error: 'No puedes transferirte a ti mismo' });
        }

        const [remitente, destinatario] = await Promise.all([
            Human.findOne({ humanoID: remitenteID }),
            Human.findOne({ humanoID: destinatarioID })
        ]);

        if (!remitente)   return res.status(404).json({ success: false, error: 'Tu cuenta no existe' });
        if (!destinatario) return res.status(404).json({ success: false, error: 'Destinatario no encontrado' });

        // Verificar saldo
        const campoSaldo = `balanceHUMANCOIN`; // expandible a otras monedas
        const saldoActual = remitente.billeteraHumana?.[campoSaldo] || 0;

        if (saldoActual < monto) {
            return res.status(400).json({ success: false, error: `Saldo insuficiente. Disponible: ${saldoActual}` });
        }

        const now   = new Date();
        const txnID = generarTransaccionID(remitenteID);
        const vec   = textoAVector(`${descripcion} ${moneda} ${monto} ${destinatarioID}`);

        const txnSalida = {
            transaccionID:  txnID + '-S',
            tipo:           'transferencia',
            moneda,
            monto:          -monto,
            descripcion:    `Enviado a ${destinatarioID}: ${descripcion}`,
            descripcionVec: vec,
            destinatario:   destinatarioID,
            estado:         'completada',
            fechaCompletada: now
        };

        const txnEntrada = {
            transaccionID:  txnID + '-E',
            tipo:           'transferencia',
            moneda,
            monto,
            descripcion:    `Recibido de ${remitenteID}: ${descripcion}`,
            descripcionVec: vec,
            destinatario:   remitenteID,
            estado:         'completada',
            fechaCompletada: now
        };

        const campoInc = `billeteraHumana.${campoSaldo}`;

        await Promise.all([
            Human.updateOne({ humanoID: remitenteID },  { $inc: { [campoInc]: -monto, totalTransacciones: 1 }, $push: { transacciones: txnSalida } }),
            Human.updateOne({ humanoID: destinatarioID }, { $inc: { [campoInc]: monto,  totalTransacciones: 1 }, $push: { transacciones: txnEntrada } })
        ]);

        res.json({ success: true, transaccionID: txnID, mensaje: `Transferencia de ${monto} ${moneda} completada` });

    } catch (err) {
        console.error('[BILLETERA] Error al transferir:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── POST: Comprar HumanCoins ──────────────────────────────────────────────────
router.post('/billetera/comprar-humancoin', isAuthenticated, async (req, res) => {
    try {
        const { monto, monedaOrigen = 'MXN' } = req.body;
        const humanoID = req.session.humano;

        // Tasa: 1 HumanCoin = $5 MXN
        const TASA_MXN = 5;
        const humancoinsARecibir = Math.floor(monto / TASA_MXN);

        if (humancoinsARecibir < 1) {
            return res.status(400).json({ success: false, error: 'Monto mínimo: $5 MXN' });
        }

        const human = await Human.findOne({ humanoID });
        if (!human) return res.status(404).json({ success: false, error: 'Humano no encontrado' });

        // Verificar saldo MXN
        if ((human.billeteraHumana?.balanceMXN || 0) < monto) {
            return res.status(400).json({ success: false, error: 'Saldo MXN insuficiente' });
        }

        const txnID = generarTransaccionID(humanoID);
        const vec   = textoAVector(`compra humancoin ${monto} mxn`);

        const nuevaTxn = {
            transaccionID:   txnID,
            tipo:            'compra_humancoin',
            moneda:          'MXN',
            monto:           -monto,
            montoDest:       humancoinsARecibir,
            monedaDest:      'HUMANCOIN',
            tasaCambio:      TASA_MXN,
            descripcion:     `Compra de ${humancoinsARecibir} HumanCoins`,
            descripcionVec:  vec,
            estado:          'completada',
            fechaCompletada: new Date()
        };

        await Human.updateOne(
            { humanoID },
            {
                $inc: {
                    'billeteraHumana.balanceMXN':       -monto,
                    'billeteraHumana.balanceHUMANCOIN': humancoinsARecibir,
                    totalTransacciones: 1
                },
                $push: { transacciones: nuevaTxn }
            }
        );

        res.json({ success: true, humancoinsRecibidos: humancoinsARecibir, transaccionID: txnID });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── POST: Crear intento pago para depósito (Stripe) ──────────────────────────
router.post('/billetera/intento-deposito', isAuthenticated, async (req, res) => {
    try {
        const { monto } = req.body;
        const pi = await stripe.paymentIntents.create({
            amount:   Math.round(monto * 100),
            currency: 'mxn',
            metadata: { humanoID: req.session.humano, tipo: 'deposito' }
        });
        res.json({ success: true, clientSecret: pi.client_secret });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/updateBilleteraCripto', async (req, res) => {
    if (req.session.loggedin) {
        try {
            const { BilleteraCripto, contrasena } = req.body;
            const humanoID = req.session.humano;

            // Buscar al usuario
            const user = await Human.findOne({ humanoID });
            if (!user) {
                return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
            }

            // Si hay una billetera cripto, actualizarla
            if (BilleteraCripto) {
                await Human.updateOne(
                    { humanoID },
                    { $set: { 'datosPersonales.BilleteraCripto': BilleteraCripto } }
                );
                return res.json({ success: true, message: 'Billetera cripto actualizada correctamente' });
            }

            // Si llegas aquí, la operación no es válida
            return res.status(400).json({ success: false, error: 'Operación no válida' });

        } catch (error) {
            console.error("Error al actualizar la billetera cripto:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    } else {
        res.status(401).json({ success: false, error: "No autorizado" });
    }
});

router.post('/deleteBilleteraCripto', async (req, res) => {
    if (req.session.loggedin) {
        try {
            const { contrasena } = req.body;
            const humanoID = req.session.humano;

            // Buscar al usuario
            const user = await Human.findOne({ humanoID });
            if (!user) {
                return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
            }

            // Verificar la contraseña
            const isMatch = await bcrypt.compare(contrasena, user.datosPersonales.contraseña);
            if (!isMatch) {
                return res.status(400).json({ success: false, error: 'Contraseña incorrecta' });
            }

            // Eliminar la billetera cripto usando $unset
            await Human.updateOne(
                { humanoID },
                { $unset: { 'datosPersonales.BilleteraCripto': 1 } }
            );
            return res.json({ success: true, message: 'Billetera cripto eliminada correctamente' });

        } catch (error) {
            console.error("Error al eliminar la billetera cripto:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    } else {
        res.status(401).json({ success: false, error: "No autorizado" });
    }
});

// Ruta para cambiar el estado del botón deslizante
router.post('/toggle', async (req, res) => {
    try {
        const { toggleState } = req.body; // Asegúrate de que el valor viene en el body como un booleano
        const newState = toggleState; // No es necesario convertir de nuevo el valor
        const humanoID = req.session.humano; // Obtener humanoID de la sesión

        console.log(`Actualizando el estado del toggle para humanoID: ${humanoID} a ${newState}`);

        // Verificar si el usuario existe antes de actualizar
        const user = await Human.findOne({ humanoID });
        if (!user) {
            return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
        }

        // Actualizar el estado del toggle en la base de datos
        const updateResult = await Human.updateOne(
            { humanoID },
            { $set: { toggleState: newState } }
        );

        // Comprobar si la actualización se realizó correctamente
       if (updateResult.modifiedCount === 0) {
            return res.status(200).json({ success: true, message: 'El estado ya estaba sincronizado' });
        }

        console.log(`Estado del toggle actualizado correctamente para humanoID: ${humanoID}`);
        res.json({ success: true, message: 'Estado del toggle actualizado correctamente' });

    } catch (error) {
        console.error("Error al actualizar el estado del toggle:", error);
        res.status(500).json({ success: false, error: 'Error al actualizar el estado del toggle' });
    }
});

// Ruta para actualizar la contraseña
router.post('/updatePassword', async (req, res) => {
    try {
        // Extraer datos del cuerpo de la solicitud
        const { contrasenaActual, nuevaContrasena } = req.body;
        // Verificar si el usuario está autenticado
        const humanoID = req.session.humano; // Asegúrate de que el humanoID esté en la sesión
        // Buscar el usuario en la base de datos
        const user = await Human.findOne({ humanoID });
        if (!user) {
            return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
        }
        // Verificar la contraseña actual
        const isMatch = await bcrypt.compare(contrasenaActual, user.datosPersonales.contraseña);
        if (!isMatch) {
            return res.status(400).json({ success: false, error: 'Contraseña actual incorrecta' });
        }
        // Validar la nueva contraseña (opcional, según tus reglas de negocio)
        if (nuevaContrasena.length < 8 || nuevaContrasena.length > 20) {
            return res.status(400).json({ success: false, error: 'La nueva contraseña debe tener entre 8 y 20 caracteres' });
        }
        // Hashear la nueva contraseña
        const nuevaContrasenaHash = await bcrypt.hash(nuevaContrasena, 12);
        // Actualizar la contraseña en la base de datos
        user.datosPersonales.contraseña = nuevaContrasenaHash;
        await user.save();
        // Enviar respuesta de éxito
        res.json({ success: true });
    } catch (error) {
        // Manejar cualquier error y enviar una respuesta de error
        console.error("Error al actualizar la contraseña:", error);
        res.status(500).json({ success: false, error: 'Error del servidor' });
    }
});

router.post('/verificarEstado', async (req, res) => {
    const { tarjetaID } = req.body;
    try {
        const human = await Human.findOne({ 'tarjeta.tarjetaID': tarjetaID });
        if (!human) {
            return res.json({ estado: 'no-encontrado', message: 'Tarjeta no encontrada' });
        }
        const tarjetaEstado = human.tarjeta.estado;
        return res.json({ estado: tarjetaEstado });
    } catch (error) {
        console.error("Error al verificar el estado:", error);
        return res.json({ estado: 'error', message: 'Error al verificar el estado' });
    }
});

router.post('/actualizarEstado', async (req, res) => {
    const { tarjetaID } = req.body;
    try {
        const human = await Human.findOneAndUpdate(
            { 'tarjeta.tarjetaID': tarjetaID },
            { $set: { 'tarjeta.estado': 'inactivo' } }, // Actualiza el estado de la tarjeta
            { new: true } // Devuelve el documento actualizado
        );
        if (!human) {
            return res.json({ estado: 'no-encontrado', message: 'Tarjeta no encontrada' });
        }
        return res.json({ estado: human.tarjeta.estado, message: 'Estado actualizado exitosamente' });
    } catch (error) {
        console.error("Error al actualizar el estado:", error);
        return res.json({ estado: 'error', message: 'Error al actualizar el estado' });
    }
});

router.post('/crearSesionPago', isAuthenticated, async (req, res) => {
    const { amount, tarjetaID } = req.body; // Asegúrate de que `tarjetaID` esté incluido en el cuerpo de la solicitud
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'mxn',
                        product_data: {
                            name: 'Nueva Tarjeta',
                        },
                        unit_amount: amount,
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${process.env.BASE_URL}/confirmarPago?session_id={CHECKOUT_SESSION_ID}&tarjetaID=${tarjetaID}`,
            cancel_url: `${process.env.BASE_URL}/pago-cancelado?estado_pago=cancelado`,
        });

        res.json({ id: session.id });
    } catch (error) {
        console.error('Error al crear la sesión de pago:', error);
        res.status(500).json({ error: 'No se pudo crear la sesión de pago' });
    }
});

router.post('/crearSesionPagoCertificado', async (req, res) => {
    try {
        const { humanoID, monto } = req.body;
        
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'mxn',
                    product_data: {
                        name: 'Certificado Adicional Human System',
                        description: `Certificado de registro humano para ID: ${humanoID}`,
                        images: ['https://storage.googleapis.com/humansystem/Certificado-HS.png']
                    },
                    unit_amount: monto,
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${req.protocol}://${req.get('host')}/certificado-exitoso?humanoID=${humanoID}`,
            cancel_url: `${req.protocol}://${req.get('host')}/certificado-cancelado`,
            metadata: {
                humanoID: humanoID,
                tipo: 'certificado_adicional'
            }
        });
        
        res.json({ id: session.id });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Ruta después de pago exitoso de certificado adicional
router.get('/certificado-exitoso', isAuthenticated, async (req, res) => {
    const { humanoID, session_id } = req.query;
    
    try {
        // Verificar que el pago fue exitoso en Stripe
        if (session_id) {
            const session = await stripe.checkout.sessions.retrieve(session_id);
            if (session.payment_status !== 'paid') {
                throw new Error('El pago no fue exitoso');
            }
        }

        // Buscar al humano
        const human = await Human.findOne({ humanoID: humanoID });
        if (!human) {
            return res.redirect('/?error=humano_no_encontrado');
        }

        // Inicializar array de certificados si no existe
        if (!human.certificadosAdicionales) {
            human.certificadosAdicionales = [];
        }

        // Determinar la versión del nuevo certificado
        const nuevaVersion = human.certificadosAdicionales.length + 1;
        
        // Generar nuevo enlace de certificado
        const nuevoCertificado = generateCertificadoLink(humanoID, nuevaVersion);
        
        // Generar QR para el certificado
        const qrCodeUrl = await generateQRCode(nuevoCertificado.url);
        
        // Guardar el certificado en la base de datos
        human.certificadosAdicionales.push({
            certificadoID: nuevoCertificado.certificadoID,
            url: nuevoCertificado.url,
            qrCodeUrl: qrCodeUrl,
            version: nuevaVersion,
            fechaCompra: new Date(),
            estado: 'activo'
        });
        
        await human.save();
        
        // Redirigir con mensaje de éxito y el ID del nuevo certificado
        return res.redirect(`/?certificado_comprado=true&certificadoID=${nuevoCertificado.certificadoID}&version=${nuevaVersion}`);
        
    } catch (error) {
        console.error('Error en certificado-exitoso:', error);
        return res.redirect('/?error=error_procesar_certificado');
    }
});

// ── VALIDACIÓN QR DE CERTIFICADO (redirige a la misma página de validación) ──
router.get('/validation/certificate', async (req, res) => {
    // La página de validación JS leerá el ?token= de la URL y llamará /validar
    // Simplemente renderizamos la misma vista de validación que para human y card
    try {
        return viewsController.renderValidation(req, res);
    } catch (error) {
        console.error('Error al renderizar validación de certificado:', error);
        return res.status(500).send('Error interno del servidor');
    }
});

router.get('/confirmarPago', isAuthenticated, async (req, res) => {
    const { session_id, tarjetaID } = req.query;
    try {
        const session = await stripe.checkout.sessions.retrieve(session_id);
        if (session.payment_status !== 'paid') {
            throw new Error('El pago no fue exitoso');
        }

        const human = await Human.findOne({ 'tarjeta.tarjetaID': tarjetaID });
        if (!human) {
            return res.redirect('/?estado_pago=cancelado');
        }

        const nuevoTarjetaID = generateTarjetaID();
        const baseUrl = 'https://www.humansystem.mx/validation';
        const nuevoEnlace = generateTarjetaLink(baseUrl, nuevoTarjetaID);

        const qrResponse = await fetch('https://odin.qrcode-ai.com/api/qrcode', {
            method: 'POST',
            headers: {
                'x-api-key': process.env.QR_API_KEY, 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                to: nuevoEnlace,
                template: "69d3d3eeacd791551420de54"
            })
        });

        if (!qrResponse.ok) {
            const errorData = await qrResponse.json();
            throw new Error(`QR Code API Error: ${errorData.message}`);
        }

        const qrData = await qrResponse.json();

        await Human.findOneAndUpdate(
            { 'tarjeta.tarjetaID': tarjetaID },
            {
                $set: {
                    'tarjeta.tarjetaID': nuevoTarjetaID,
                    'tarjeta.LinkTarjeta': nuevoEnlace,
                    'tarjeta.qrCodeUrl': qrData.qrcode.url,
                    'tarjeta.estado': 'comprado'
                }
            }
        );

        return res.redirect('/?estado_pago=exitoso');
    } catch (error) {
        console.error('Error al confirmar el pago:', error);
        res.redirect('/?estado_pago=cancelado');
    }
});

router.get('/pago-cancelado', isAuthenticated, (req, res) => {
    // Puedes agregar lógica para manejar la cancelación aquí si es necesario
    res.redirect(`${process.env.BASE_URL}/pago-cancelado?estado_pago=cancelado`);
});

// Ruta para eliminar el perfil
router.delete('/eliminarPerfil', isAuthenticated, async (req, res) => {
    try {
        const { contrasena } = req.body; // Extraer la contraseña del cuerpo de la solicitud
        if (!contrasena) {
            return res.status(400).json({ success: false, error: 'Contraseña requerida' });
        }

        // Buscar el usuario en la base de datos
        const user = await Human.findOne({ humanoID: req.session.humano });
        if (!user) {
            return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
        }

        // Verificar la contraseña
        const isMatch = await bcrypt.compare(contrasena, user.datosPersonales.contraseña);
        if (!isMatch) {
            return res.status(400).json({ success: false, error: 'Contraseña incorrecta' });
        }

        // Eliminar el perfil
        await Human.findOneAndDelete({ humanoID: req.session.humano });
        req.session.destroy(() => {
            res.json({ success: true });
        });
    } catch (error) {
        console.error("Error al eliminar el perfil:", error);
        res.status(500).json({ success: false, error: 'Error del servidor' });
    }
});

module.exports = router;