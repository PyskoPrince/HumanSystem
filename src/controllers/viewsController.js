const Human = require('../models/User');
const crypto = require('crypto');

const decryptID = (encryptedID) => {
    try {
        const secretKey = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
        const parts = encryptedID.split(':');
        
        if (parts.length !== 3) throw new Error('Token corrupto');
        
        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encryptedText = parts[2];
        
        const decipher = crypto.createDecipheriv('aes-256-gcm', secretKey, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        console.error('[SEGURIDAD] Error al desencriptar tarjeta:', error.message);
        return null;
    }
};

exports.renderHome = async (req, res) => {
    if (req.session && req.session.loggedin) {
        try {
            const user = await Human.findOne({ humanoID: req.session.humano });
            
            if (!user) {
                req.session.destroy();
                return res.redirect('/login');
            }

            let numeroTarjetaMostrar = '**** **** **** ****'; 
            let fechaVencimientoMostrar = 'XX/XX';
            let titularMostrar = user.datosPersonales.nombre.toUpperCase();

            if (user.tarjeta && user.tarjeta.numeroTarjeta) {
                const numeroDesencriptado = decryptID(user.tarjeta.numeroTarjeta);
                if (numeroDesencriptado) {
                    numeroTarjetaMostrar = numeroDesencriptado.match(/.{1,4}/g).join(' ');
                }
                fechaVencimientoMostrar = user.tarjeta.fechaVencimiento || fechaVencimientoMostrar;
                titularMostrar = user.tarjeta.titular || titularMostrar;
            }

            // CORRECCIÓN: Se declara 'bh' para evitar el error "bh is not defined". 
            // Por favor, verifica si los datos vienen de 'user.bh' u otra propiedad.
            const bh = user.bh || {};

            return res.render('index', { 
                title: 'Dashboard - Human System',
                login: true,
                humanoID: user.humanoID,
                nombre: user.datosPersonales.nombre,
                telefono: user.datosPersonales.telefono,
                correo: user.datosPersonales.correo,
                direccion: user.datosPersonales.direccion || '',
                fotoPerfilUrl: user.fotoPerfilUrl || '/img/default-avatar.png',
                qrCodeHumano: user.qrCodeUrl || '',
                descripcion: user.descripcion || '',
                socialLinks: user.socialLinks || {},
                qrCodeTarjeta: user.tarjeta?.qrCodeUrl || '',
                tarjetaID: user.tarjeta?.tarjetaID || '',
                toggleState: user.toggleState || false,
                firmaDigitalUrl: user.firmaDigitalUrl || '',  
                Tarjetadebito: user.datosPersonales?.Tarjetadebito || '', 
                BilleteraCripto: user.datosPersonales?.BilleteraCripto || '',
                redTarjeta: user.tarjeta?.red || 'visa', 
                numeroTarjeta: numeroTarjetaMostrar,
                fechaVencimiento: fechaVencimientoMostrar,  
                titularTarjeta: titularMostrar,
                billeteraETH: bh.direccionETH || null,
                billeteraMXN: (bh.balanceMXN || 0).toFixed(2),
                billeteraHUMANCOIN: bh.balanceHUMANCOIN || 0,
                billeteraETHbal: (bh.balanceETH || 0).toFixed(6),
                billeteraUSDC: (bh.balanceUSDC || 0).toFixed(2),
                planBilletera: bh.planActivo || 'free',
                identidadVerificada: bh.identidadVerificada || false,
                tarjetaVirtualEstado: bh.tarjetaVirtualEstado || 'no_emitida'
            });
        } catch (error) {
            console.error("Error al cargar Dashboard:", error);
            return res.redirect('/info');
        }
    }
    res.redirect('/info');
};

exports.renderInfo = (req, res) => {
    res.render('info', { 
        title: 'Información', 
        login: !!(req.session && req.session.loggedin),
        pageClass: 'page-info'
    });
};

exports.renderValidation = (req, res) => {
    res.render('validation', { 
        title: 'Validación', 
        login: !!(req.session && req.session.loggedin)
    });
};