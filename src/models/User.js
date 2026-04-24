const mongoose = require('mongoose');

const transaccionSchema = new mongoose.Schema({
    transaccionID:    { type: String, required: true },
    tipo:             { type: String, enum: ['deposito', 'retiro', 'transferencia', 'compra_cripto', 'compra_humancoin'], required: true },
    moneda:           { type: String, enum: ['MXN', 'USD', 'ETH', 'BTC', 'USDC', 'HUMANCOIN'], required: true },
    monto:            { type: Number, required: true },
    montoDest:        { type: Number },           // monto en moneda destino (FX)
    monedaDest:       { type: String },           // moneda destino (FX)
    tasaCambio:       { type: Number },           // tasa usada
    descripcion:      { type: String },           // texto libre
    descripcionVec:   { type: [Number] },         // ← VECTOR para Atlas Vector Search (embedding)
    destinatario:     { type: String },           // humanoID o dirección ETH destino
    estado:           { type: String, enum: ['pendiente', 'completada', 'fallida', 'reintentando'], default: 'pendiente' },
    paymentIntentId:  { type: String },           // Stripe PI si aplica
    reintentos:       { type: Number, default: 0 },
    fechaCreacion:    { type: Date, default: Date.now },
    fechaCompletada:  { type: Date }
});

const humanSchema = new mongoose.Schema({
    humanoID:         { type: String, unique: true, required: true },
    estado:           { type: String, default: 'activado' },
    sesionActiva:     { type: Boolean, default: false },
    descripcion:      String,
    qrCodeUrl:        String,
    fotoPerfilUrl:    String,
    firmaDigitalUrl:  String,
    LinkHumano:       String,

    datosPersonales: {
        nombre:       { type: String, required: true },
        direccion:    { type: String },
        correo:       { type: String, unique: true, sparse: true, required: true },
        telefono:     { type: String, unique: true, required: true },
        contraseña:   { type: String, required: true },
        curp:         { type: String, unique: true, required: true },
        rfc:          { type: String, unique: true, required: true },
        Tarjetadebito: String,
        BilleteraCripto: String,
    },

    socialLinks: {
        personal: String, trabajo: String, instagram: String,
        facebook: String, youtube: String, linkedin: String,
        whatsapp: String, twitter: String, tiktok: String
    },

    tarjeta: {
        tarjetaID:       String,
        contador:        { type: Number, default: 0 },
        qrCodeUrl:       String,
        LinkTarjeta:     String,
        estado:          { type: String, enum: ['comprado','enviado','pendiente_activacion','activado','inactivo','reportado'], default: 'comprado' },
        red:             { type: String, enum: ['visa','mastercard'], default: 'visa' },
        numeroTarjeta:   { type: String },
        fechaVencimiento:{ type: String },
        titular:         { type: String },
        direccionEnvioFisico: { type: String }
    },

    // ════════════════════════════════════════════════════════════
    //  BILLETERA HUMANA — NÚCLEO FINANCIERO
    // ════════════════════════════════════════════════════════════
    billeteraHumana: {
        // ── Wallet Ethereum auto-generada ──
        direccionETH:     { type: String },          // 0x... dirección pública
        clavePrivadaETH:  { type: String },          // AES-256-GCM encriptada — NUNCA al frontend

        // ── Balances (en unidades base) ──
        balanceMXN:       { type: Number, default: 0.00 },
        balanceUSD:       { type: Number, default: 0.00 },
        balanceETH:       { type: Number, default: 0.000000 },
        balanceBTC:       { type: Number, default: 0.000000 },
        balanceUSDC:      { type: Number, default: 0.00 },
        balanceHUMANCOIN: { type: Number, default: 0 },

        // ── Cuenta financiera Stripe (Stablecoin Financial Account) ──
        stripeFinancialAccountId: { type: String },  // fa_xxx de Stripe
        stripeCustomerId:         { type: String },  // cus_xxx de Stripe

        // ── Identidad verificada (Stripe Identity) ──
        identidadVerificada: { type: Boolean, default: false },
        stripeVerificationSessionId: { type: String },

        // ── Emisión de tarjeta virtual (Stripe Issuing) ──
        tarjetaVirtualId:       { type: String },    // ic_xxx Stripe Issuing
        tarjetaVirtualNumero:   { type: String },    // encriptado
        tarjetaVirtualEstado:   { type: String, enum: ['activa','suspendida','cancelada','no_emitida'], default: 'no_emitida' },

        // ── Suscripción / Billing ──
        stripePlanId:      { type: String },
        stripeMeterId:     { type: String },         // Meters API para usage-based
        planActivo:        { type: String, enum: ['free','basic','pro'], default: 'free' },

        // ── Metadata ──
        fechaCreacion:   { type: Date, default: Date.now },
        red:             { type: String, default: 'ethereum' }
    },

    // ── Historial de transacciones con Vector Search ──
    transacciones: [transaccionSchema],

    totalTransacciones: { type: Number, default: 0 },

    certificadosAdicionales: [{
        certificadoID:        { type: String, unique: true },
        url:                  { type: String },
        qrCodeUrl:            { type: String },
        version:              { type: Number },
        fechaCompra:          { type: Date, default: Date.now },
        estado:               { type: String, enum: ['activo','reportado'], default: 'activo' },
        direccionEnvioFisico: { type: String }
    }],

    totalCertificadosComprados: { type: Number, default: 0 },
    toggleState:                { type: Boolean, default: false }
});

// ── Índices estándar ──
humanSchema.index({ "datosPersonales.correo": 1 },  { unique: true, sparse: true });
humanSchema.index({ "datosPersonales.curp": 1 },    { unique: true, sparse: true });
humanSchema.index({ "datosPersonales.rfc": 1 },     { unique: true, sparse: true });
humanSchema.index({ "datosPersonales.telefono": 1 },{ unique: true, sparse: true });

// ── Índice Vector Search (Atlas) — crea este índice en el panel de Atlas ──
// Nombre del índice: "transacciones_vector_index"
// Campo: "transacciones.descripcionVec" — dimensions: 384 — similarity: cosine
humanSchema.index({ "transacciones.fechaCreacion": -1 });
humanSchema.index({ "billeteraHumana.direccionETH": 1 }, { sparse: true });

module.exports = mongoose.model('Human', humanSchema);