const mongoose = require('mongoose');

/**
 * LoginAttempt — Registro de intentos de acceso
 * TTL de 24h: MongoDB elimina documentos automáticamente
 * Detecta: credential stuffing, enumeración, slow brute force
 */
const loginAttemptSchema = new mongoose.Schema({
    ip:          { type: String, required: true },
    fingerprint: { type: String, required: true }, // Hash de headers del dispositivo
    identifier:  { type: String },                 // Username/email/CURP intentado (ofuscado)
    success:     { type: Boolean, default: false },
    timestamp:   { type: Date,   default: Date.now },
    userAgent:   { type: String },
    reason:      { type: String }, // 'not_found' | 'bad_password' | 'locked' | 'success'
    sessionId:   { type: String }, // Para detectar session fixation
});

// TTL: auto-destruir después de 24 horas
loginAttemptSchema.index({ timestamp: 1 }, { expireAfterSeconds: 86400 });

// Índices compuestos para queries de velocidad
loginAttemptSchema.index({ ip: 1, timestamp: -1 });
loginAttemptSchema.index({ fingerprint: 1, timestamp: -1 });
loginAttemptSchema.index({ ip: 1, success: 1, timestamp: -1 });

module.exports = mongoose.model('LoginAttempt', loginAttemptSchema);