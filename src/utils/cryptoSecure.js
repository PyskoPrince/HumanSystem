const crypto = require('crypto');

// ¡CRÍTICO! Esta clave debe ir en tu .env. 
// Genera una de 32 bytes así en tu consola: require('crypto').randomBytes(32).toString('hex')
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex'); // 32 bytes
const IV_LENGTH = 16; 

const cifrarToken = (texto) => {
    // Generar un Vector de Inicialización (IV) aleatorio para cada token
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    
    let encrypted = cipher.update(texto, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Tag de autenticación para garantizar que el token no fue alterado
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Formato: IV:AuthTag:EncryptedText
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

const descifrarToken = (tokenCifrado) => {
    try {
        const partes = tokenCifrado.split(':');
        if (partes.length !== 3) throw new Error('Token corrupto');

        const iv = Buffer.from(partes[0], 'hex');
        const authTag = Buffer.from(partes[1], 'hex');
        const encryptedText = partes[2];

        const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        console.error("Alerta de Seguridad: Intento de vulneración de token.");
        return null; // Rechazar validación
    }
};

module.exports = { cifrarToken, descifrarToken };