const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
  TabStopType, TabStopPosition
} = require('docx');
const fs = require('fs');

// ── Colors ──────────────────────────────────────────────────────────────────
const C = {
  darkBlue: '1F4E67',
  red:      'D71D00',
  cyan:     '4CA1AF',
  gold:     'FCC404',
  white:    'FFFFFF',
  black:    '000000',
  lightGray:'F2F2F2',
  medGray:  'CCCCCC',
  darkGray: '444444',
  headerBg: '1F4E67',
  altRow:   'EAF4F8',
};

// ── Border helpers ───────────────────────────────────────────────────────────
const border = (color = C.medGray, size = 4) => ({ style: BorderStyle.SINGLE, size, color });
const borders = (color = C.medGray) => ({ top: border(color), bottom: border(color), left: border(color), right: border(color) });
const noBorder = () => ({ style: BorderStyle.NONE, size: 0, color: 'FFFFFF' });
const noBorders = () => ({ top: noBorder(), bottom: noBorder(), left: noBorder(), right: noBorder() });

// ── Helpers ──────────────────────────────────────────────────────────────────
const spacer = (pt = 120) => new Paragraph({ children: [], spacing: { before: pt, after: pt } });

const h1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  children: [new TextRun({ text, bold: true, color: C.white, size: 28, font: 'Arial' })],
  shading: { fill: C.darkBlue, type: ShadingType.CLEAR },
  spacing: { before: 360, after: 200 },
  indent: { left: 200, right: 200 },
});

const h2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  children: [new TextRun({ text, bold: true, color: C.darkBlue, size: 24, font: 'Arial' })],
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.cyan, space: 1 } },
  spacing: { before: 280, after: 140 },
});

const h3 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_3,
  children: [new TextRun({ text, bold: true, color: C.darkBlue, size: 22, font: 'Arial' })],
  spacing: { before: 220, after: 100 },
});

const h4 = (text) => new Paragraph({
  children: [new TextRun({ text, bold: true, color: C.red, size: 20, font: 'Arial' })],
  spacing: { before: 160, after: 80 },
});

const p = (text, opts = {}) => new Paragraph({
  children: [new TextRun({ text, size: 20, font: 'Arial', color: C.darkGray, ...opts })],
  spacing: { before: 60, after: 100 },
  alignment: AlignmentType.JUSTIFIED,
});

const pBold = (text) => p(text, { bold: true, color: C.darkBlue });

const bullet = (text, level = 0) => new Paragraph({
  numbering: { reference: 'bullets', level },
  children: [new TextRun({ text, size: 20, font: 'Arial', color: C.darkGray })],
  spacing: { before: 40, after: 60 },
});

const numbered = (text, level = 0) => new Paragraph({
  numbering: { reference: 'numbers', level },
  children: [new TextRun({ text, size: 20, font: 'Arial', color: C.darkGray })],
  spacing: { before: 40, after: 60 },
});

// ── Cell helpers ─────────────────────────────────────────────────────────────
const cell = (text, w, opts = {}) => new TableCell({
  borders: borders(C.medGray),
  width: { size: w, type: WidthType.DXA },
  margins: { top: 80, bottom: 80, left: 120, right: 120 },
  shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
  verticalAlign: VerticalAlign.CENTER,
  children: [new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    children: [new TextRun({
      text,
      size: opts.size || 18,
      bold: opts.bold || false,
      color: opts.color || C.darkGray,
      font: 'Arial',
    })],
  })],
});

const headerCell = (text, w) => cell(text, w, { fill: C.darkBlue, bold: true, color: C.white, center: true, size: 18 });
const altCell    = (text, w, opts = {}) => cell(text, w, { fill: C.altRow, ...opts });

// ── Table row builder ────────────────────────────────────────────────────────
const row = (cells) => new TableRow({ children: cells });
const tableFromRows = (rows, colWidths) => new Table({
  width: { size: colWidths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
  columnWidths: colWidths,
  rows,
});

// ── Cover page ───────────────────────────────────────────────────────────────
const coverPage = [
  spacer(1440),
  new Paragraph({
    children: [new TextRun({ text: 'EVALUACIÓN DE IMPACTO A LA PRIVACIDAD', bold: true, size: 52, color: C.darkBlue, font: 'Arial' })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 200 },
  }),
  new Paragraph({
    children: [new TextRun({ text: 'Human Identification Technologies, S.A. de C.V.', bold: true, size: 36, color: C.red, font: 'Arial' })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 200 },
  }),
  new Paragraph({
    children: [new TextRun({ text: 'Human System — Plataforma de Identidad Digital Soberana', size: 26, color: C.cyan, font: 'Arial', italics: true })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 600 },
  }),
  new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.cyan, space: 1 } },
    children: [],
    spacing: { before: 0, after: 400 },
  }),
  tableFromRows([
    row([cell('Responsable del Tratamiento:', 3600, { bold: true, color: C.darkBlue }), cell('Human Identification Technologies, S.A. de C.V.', 5760)]),
    row([cell('Nombre Comercial:', 3600, { bold: true, color: C.darkBlue }), cell('Human System', 5760)]),
    row([cell('Domicilio:', 3600, { bold: true, color: C.darkBlue }), cell('Ayuntamiento #143, Miguel Hidalgo 1ra Secc, Tlalpan, 14250 CDMX', 5760)]),
    row([cell('Sistema analizado:', 3600, { bold: true, color: C.darkBlue }), cell('Plataforma web humansystem.mx — Registro, autenticación y gestión de identidad digital con tarjeta física NFC/QR y billetera digital', 5760)]),
    row([cell('Versión del documento:', 3600, { bold: true, color: C.darkBlue }), cell('v1.0 — 2025', 5760)]),
    row([cell('Clasificación:', 3600, { bold: true, color: C.darkBlue }), cell('CONFIDENCIAL — Uso interno y ante autoridades', 5760)]),
    row([cell('Normativa aplicable:', 3600, { bold: true, color: C.darkBlue }), cell('LFPDPPP, Reglamento LFPDPPP, Lineamientos INAI, RGPD (referencia), Estándares ISO/IEC 27001', 5760)]),
  ], [3600, 5760]),
  spacer(600),
  new Paragraph({
    children: [new TextRun({ text: 'Documento elaborado conforme a los artículos 3 fr. VI, 18 y demás relativos de la Ley Federal de Protección de Datos Personales en Posesión de los Particulares y su Reglamento, así como a los Lineamientos del Modelo de Autorregulación Vinculante del INAI.', size: 18, color: C.darkGray, font: 'Arial', italics: true })],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 200, after: 100 },
  }),
  new Paragraph({ children: [new PageBreak()] }),
];

// ═══════════════════════════════════════════════════════════════════════════
//  SESIÓN 1 – IDENTIFICACIÓN GENERAL DE OBLIGACIONES
// ═══════════════════════════════════════════════════════════════════════════
const session1 = [
  h1('SESIÓN 1 — IDENTIFICACIÓN GENERAL DE LAS OBLIGACIONES EN MATERIA DE PROTECCIÓN DE DATOS PERSONALES'),

  h2('1.1 Marco Normativo Aplicable'),
  p('Human Identification Technologies, S.A. de C.V. ("HIT" o "el Responsable"), con nombre comercial Human System, opera como responsable del tratamiento de datos personales dentro del territorio mexicano, por lo que se encuentra sujeta en forma integral al siguiente marco normativo:'),
  bullet('Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP), publicada en el DOF el 5 de julio de 2010.'),
  bullet('Reglamento de la LFPDPPP, publicado en el DOF el 21 de diciembre de 2011.'),
  bullet('Lineamientos del Aviso de Privacidad, publicados en el DOF el 17 de enero de 2013.'),
  bullet('Recomendaciones en materia de seguridad de datos personales del INAI, publicadas en 2013.'),
  bullet('Parámetros para el Autorregulación de la Protección de Datos Personales (INAI, 2015).'),
  bullet('Disposiciones de la Ley General de Protección de Datos Personales en Posesión de Sujetos Obligados (LGPDPPSO), en lo conducente para organismos que interactúen con el sector público.'),
  bullet('ISO/IEC 27001:2022 — Seguridad de la Información (referencia técnica adoptada voluntariamente).'),
  bullet('Reglamento General de Protección de Datos (RGPD/GDPR) de la Unión Europea, en calidad de estándar internacional de referencia para transferencias internacionales y mejores prácticas.'),

  h2('1.2 Identificación del Responsable y Encargados'),
  p('Conforme al artículo 3, fracción XIV de la LFPDPPP, HIT tiene la calidad de Responsable, toda vez que decide sobre el tratamiento de los datos personales. Los encargados identificados en la operación actual de la plataforma Human System incluyen:'),
  tableFromRows([
    row([headerCell('Encargado', 2800), headerCell('Rol', 2800), headerCell('Tipo de dato que accede', 3760)]),
    row([cell('Google Cloud Storage / Firebase', 2800), cell('Almacenamiento en la nube', 2800), cell('Foto de perfil, firma digital, documentos generados', 3760)]),
    row([cell('Stripe, Inc.', 2800), cell('Procesador de pagos', 2800), cell('Datos de tarjeta bancaria, montos de transacción', 3760)]),
    row([cell('Twilio Inc.', 2800), cell('Verificación de teléfono (OTP SMS)', 2800), cell('Número de teléfono celular', 3760)]),
    row([cell('MongoDB Atlas / Google Cloud', 2800), cell('Base de datos operativa', 2800), cell('Todos los datos del perfil humano', 3760)]),
    row([cell('QRCode-AI / me-qr.com', 2800), cell('Generación de códigos QR', 2800), cell('URL de validación con token cifrado', 3760)]),
    row([cell('CoinGecko API', 2800), cell('Datos de mercado cripto', 2800), cell('Ningún dato personal (solo consulta pública)', 3760)]),
  ], [2800, 2800, 3760]),
  spacer(),

  h2('1.3 Datos Personales Sometidos a Tratamiento'),
  p('La plataforma Human System recaba, almacena, usa y transmite las siguientes categorías de datos personales, clasificados conforme a la LFPDPPP:'),

  h3('1.3.1 Datos de Identificación (art. 3 fr. V LFPDPPP)'),
  bullet('Nombre completo (nombres y apellidos).'),
  bullet('Clave Única de Registro de Población (CURP) — 18 caracteres.'),
  bullet('Registro Federal de Contribuyentes (RFC) — 13 caracteres.'),
  bullet('Fecha de nacimiento.'),
  bullet('Identificador único de plataforma (HumanoID, formato HUM-XXXXXX).'),

  h3('1.3.2 Datos de Contacto'),
  bullet('Correo electrónico.'),
  bullet('Número de teléfono celular (10 dígitos).'),
  bullet('Dirección física de domicilio o entrega.'),

  h3('1.3.3 Datos Biométricos y Sensibles (art. 3 fr. VI LFPDPPP)'),
  p('Los siguientes datos son considerados datos personales sensibles y requieren consentimiento expreso y por escrito para su tratamiento:'),
  bullet('Fotografía facial del titular (capturada mediante Croppie y almacenada en GCS).'),
  bullet('Firma autógrafa digitalizada (capturada en canvas HTML5 mediante SignaturePad).'),

  h3('1.3.4 Datos Financieros y de Autenticación'),
  bullet('Contraseña de acceso (almacenada con hash bcrypt — Salt rounds: 10 a 12).'),
  bullet('Balance de billetera digital (MXN, HumanCoins, ETH, USDC).'),
  bullet('Historial de transacciones financieras.'),
  bullet('Número de tarjeta digital cifrado (AES-256-GCM), red de pago (Visa/Mastercard), fecha de vencimiento.'),
  bullet('Dirección de billetera Ethereum (pública); clave privada ETH cifrada con AES-256-GCM y NUNCA transmitida al cliente.'),

  h3('1.3.5 Datos Técnicos y de Sesión'),
  bullet('Datos de sesión de navegación (cookies técnicas para mantener la sesión activa).'),
  bullet('Estado de privacidad del perfil (toggle activo/inactivo para visibilidad de datos).'),
  bullet('Datos de geolocalización aproximada (inferida de IP del servidor, no almacenada).'),
  bullet('Identificadores de transacción Stripe (PaymentIntent IDs).'),

  h2('1.4 Finalidades del Tratamiento'),
  p('Conforme al principio de finalidad establecido en el artículo 12 de la LFPDPPP, el tratamiento se realiza exclusivamente para las siguientes finalidades:'),

  h3('1.4.1 Finalidades Primarias (necesarias para la relación jurídica)'),
  numbered('Crear, gestionar y mantener el perfil de identidad digital soberana del titular en la plataforma humansystem.mx.'),
  numbered('Verificar y validar la identidad del titular mediante el sistema Zero-Trust, incluyendo validación de CURP, RFC, correo y sesión única activa.'),
  numbered('Emitir y gestionar la tarjeta física Human ID (chip EMV contactless, banda magnética, NFC, QR dinámico y Photo-QR esteganográfico).'),
  numbered('Emitir y gestionar certificados digitales de registro humano (con firma digital, QR, OVD holográfico y NFC embebido).'),
  numbered('Permitir el acceso seguro del titular a su cuenta mediante autenticación por contraseña.'),
  numbered('Procesar pagos de los servicios contratados mediante la pasarela Stripe.'),
  numbered('Operar la Billetera Humana, incluyendo depósitos en MXN, compra de HumanCoins, transferencias P2P y gestión de activos digitales (ETH, USDC).'),
  numbered('Enviar comunicaciones relacionadas exclusivamente con los servicios contratados (soporte técnico, seguimiento de pedidos, verificación de identidad).'),
  numbered('Cumplir con obligaciones legales y requerimientos de autoridades competentes.'),

  h3('1.4.2 Finalidades Secundarias'),
  p('Human System NO utiliza los datos personales para finalidades secundarias (mercadotecnia, publicidad, elaboración de perfiles comerciales). La plataforma es estrictamente un servicio de identidad y no muestra publicidad de terceros.'),

  h2('1.5 Base Legal del Tratamiento'),
  tableFromRows([
    row([headerCell('Tratamiento', 2400), headerCell('Base Legal LFPDPPP', 2400), headerCell('Artículo', 1600), headerCell('Justificación', 2960)]),
    row([cell('Datos de identificación y biométricos', 2400), cell('Consentimiento expreso y por escrito', 2400), cell('Arts. 8 y 9', 1600), cell('El titular firma en el formulario de registro y acepta el Aviso de Privacidad', 2960)]),
    row([cell('Procesamiento de pagos (Stripe)', 2400), cell('Ejecución de contrato', 2400), cell('Art. 10 fr. II', 1600), cell('Necesario para prestar el servicio de identificación digital contratado', 2960)]),
    row([cell('Cookies técnicas de sesión', 2400), cell('Interés legítimo / necesidad técnica', 2400), cell('Art. 10 fr. III', 1600), cell('Indispensables para el funcionamiento seguro de la plataforma', 2960)]),
    row([cell('Transferencias a verificadores de identidad', 2400), cell('Art. 37 LFPDPPP (sin consentimiento)', 2400), cell('Art. 37 fr. IV', 1600), cell('Ejecución de relación jurídica con el titular que requiere verificación de datos de contacto', 2960)]),
    row([cell('Datos biométricos (foto, firma)', 2400), cell('Consentimiento expreso', 2400), cell('Art. 9', 1600), cell('El titular los sube activamente con check expreso en el aviso de privacidad', 2960)]),
  ], [2400, 2400, 1600, 2960]),
  spacer(),

  h2('1.6 Derechos ARCO y Mecanismos de Ejercicio'),
  p('Conforme a los artículos 22 a 35 de la LFPDPPP, los titulares de datos personales cuentan con los siguientes derechos y mecanismos para ejercerlos:'),
  tableFromRows([
    row([headerCell('Derecho', 1800), headerCell('Descripción', 3200), headerCell('Mecanismo en Human System', 4360)]),
    row([cell('ACCESO', 1800), cell('Conocer qué datos se tienen, para qué fines y en qué condiciones', 3200), cell('Dashboard del perfil: visualización completa de todos los datos. Toggle de privacidad para controlar visibilidad.', 4360)]),
    row([cell('RECTIFICACIÓN', 1800), cell('Corregir datos inexactos o incompletos', 3200), cell('Sección Configuración: actualización de teléfono (con OTP Twilio), correo, dirección y contraseña. Solicitud vía info@humansystem.mx para CURP/RFC/nombre.', 4360)]),
    row([cell('CANCELACIÓN', 1800), cell('Solicitar la eliminación de datos del sistema', 3200), cell('Botón "Eliminar Perfil" en Configuración (requiere contraseña). Elimina BD, desactiva tarjeta y libera archivos en GCS. Plazo: inmediato.', 4360)]),
    row([cell('OPOSICIÓN', 1800), cell('Oponerse al uso de datos para fines específicos', 3200), cell('Solicitud escrita a info@humansystem.mx. Para datos sensibles: revocación del consentimiento mediante eliminación del perfil desde la plataforma.', 4360)]),
    row([cell('REVOCACIÓN', 1800), cell('Revocar el consentimiento otorgado', 3200), cell('Eliminación definitiva del perfil en Configuración, o solicitud a info@humansystem.mx. Plazo de respuesta: 20 días hábiles.', 4360)]),
  ], [1800, 3200, 4360]),
  spacer(),

  new Paragraph({ children: [new PageBreak()] }),
];

// ═══════════════════════════════════════════════════════════════════════════
//  SESIÓN 2 – MEDIDAS DE SEGURIDAD Y SISTEMA DE GESTIÓN
// ═══════════════════════════════════════════════════════════════════════════
const session2 = [
  h1('SESIÓN 2 — MEDIDAS DE SEGURIDAD Y DECISIÓN ESTRATÉGICA SOBRE SISTEMA DE GESTIÓN'),

  h2('2.1 Diagnóstico del Estado Actual de Seguridad'),
  p('La plataforma Human System procesa datos personales de alta sensibilidad (biométricos, financieros e identificativos), por lo que las medidas de seguridad implementadas deben considerarse como una prioridad estratégica de primer orden. A continuación se describe el estado actual y las brechas identificadas:'),

  h2('2.2 Medidas Técnicas Implementadas'),

  h3('2.2.1 Cifrado'),
  tableFromRows([
    row([headerCell('Elemento', 2800), headerCell('Algoritmo/Método', 2000), headerCell('Implementación', 2600), headerCell('Nivel de Riesgo Residual', 1960)]),
    row([cell('Contraseñas de usuarios', 2800), cell('bcrypt (Salt rounds: 10-12)', 2000), cell('Almacenadas en hash, nunca en texto plano. Implementación en authController.js', 2600), cell('BAJO', 1960, { fill: 'D5F5E3', color: '1E8449', bold: true })]),
    row([cell('Tokens QR / IDs de tarjeta y humano', 2800), cell('AES-256-GCM', 2000), cell('Función encryptID(): IV aleatorio (16 bytes) + AuthTag + texto cifrado. ENCRYPTION_KEY vía variable de entorno', 2600), cell('BAJO', 1960, { fill: 'D5F5E3', color: '1E8449', bold: true })]),
    row([cell('Clave privada ETH del titular', 2800), cell('AES-256-GCM', 2000), cell('Nunca enviada al frontend. Cifrada antes de almacenar en MongoDB', 2600), cell('BAJO', 1960, { fill: 'D5F5E3', color: '1E8449', bold: true })]),
    row([cell('Comunicaciones cliente-servidor', 2800), cell('TLS 1.3 (HTTPS)', 2000), cell('Indicado en la UI. Requiere validación de configuración del servidor Node.js/nginx', 2600), cell('BAJO-MEDIO', 1960, { fill: 'FEF9E7', color: 'B7770D', bold: true })]),
    row([cell('Archivos en Google Cloud Storage', 2800), cell('Cifrado en reposo (GCS nativo)', 2000), cell('AES-256 gestionado por Google Cloud. Acceso por URL pública sin token firmado', 2600), cell('MEDIO', 1960, { fill: 'FDEBD0', color: 'A04000', bold: true })]),
    row([cell('Número de tarjeta digital', 2800), cell('AES-256-GCM (encryptID)', 2000), cell('El número se cifra antes de almacenar. Solo se desencripta en sesión autenticada', 2600), cell('BAJO', 1960, { fill: 'D5F5E3', color: '1E8449', bold: true })]),
  ], [2800, 2000, 2600, 1960]),
  spacer(),

  h3('2.2.2 Control de Acceso y Autenticación'),
  bullet('Autenticación por contraseña con bcrypt: protección contra ataques de fuerza bruta mediante hash irreversible con factor de trabajo ajustable.'),
  bullet('Sesión única activa por usuario: el campo sesionActiva previene el acceso simultáneo desde múltiples dispositivos.'),
  bullet('Middleware isAuthenticated() en todas las rutas protegidas: garantiza que solo usuarios con sesión válida accedan a datos personales.'),
  bullet('Kill Switch operativo: el titular puede congelar su cuenta e invalidar la tarjeta en tiempo real desde cualquier dispositivo.'),
  bullet('Verificación OTP para cambio de teléfono: mediante Twilio, el cambio de número requiere código SMS de un solo uso.'),
  bullet('Confirmación de contraseña para acciones críticas: eliminación de datos, reporte de tarjeta y revocación de consentimiento.'),
  bullet('Toggle de privacidad Zero-Knowledge: el titular puede ocultar todos sus datos visibles sin eliminarlos (función de privacidad instantánea).'),

  h3('2.2.3 Arquitectura de Seguridad en el Backend'),
  bullet('Variables de entorno para secretos: ENCRYPTION_KEY, STRIPE_SECRET_KEY, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY y demás credenciales nunca aparecen en código fuente.'),
  bullet('Motor QR con triple fallback: garantiza disponibilidad sin exponer datos del usuario a APIs externas innecesarias (solo la URL cifrada es transmitida).'),
  bullet('Validación de integridad de tokens: decryptID() verifica el AuthTag de GCM, rechazando cualquier token alterado con un log de alerta de seguridad.'),
  bullet('Vector Search para detección de duplicados: algoritmo de similitud coseno en 128 dimensiones detecta transacciones financieras potencialmente duplicadas o fraudulentas.'),
  bullet('Verificación dual antes de procesar pagos: se verifica el estado de Stripe (paymentIntent.status === succeeded) Y se confirma en el servidor antes de acreditar saldo.'),

  h2('2.3 Medidas de Seguridad Físicas'),
  bullet('Infraestructura alojada en Google Cloud Platform: centros de datos certificados ISO/IEC 27001, SOC 2 Type II y PCI DSS Nivel 1.'),
  bullet('Redundancia geográfica: Google Cloud garantiza 2N+1 disponibilidad en almacenamiento y base de datos.'),
  bullet('Acceso físico a servidores gestionado exclusivamente por Google Cloud (modelo de responsabilidad compartida).'),

  h2('2.4 Medidas de Seguridad Administrativas'),
  bullet('Aviso de Privacidad completo y actualizado publicado en el sitio web y presentado obligatoriamente en el proceso de registro.'),
  bullet('Consentimiento expreso mediante checkbox y firma digital en formulario de registro.'),
  bullet('Proceso de eliminación de perfil auditado con verificación de contraseña.'),
  bullet('Procedimiento ARCO documentado con plazo de 20 días hábiles.'),
  bullet('Política de contraseñas: mínimo 8 caracteres, máximo 20, con requisito de mayúscula, minúscula y número.'),

  h2('2.5 Brechas de Seguridad Identificadas y Plan de Remediación'),
  tableFromRows([
    row([headerCell('Brecha Identificada', 3200), headerCell('Riesgo', 1200), headerCell('Plan de Remediación', 4960)]),
    row([cell('Fotografías y firmas en GCS con URL pública sin token firmado (Signed URL)', 3200), cell('ALTO', 1200, { fill: 'FADBD8', color: 'C0392B', bold: true }), cell('Implementar Google Cloud Storage Signed URLs con expiración de 1 hora. Eliminar acceso público directo a archivos de usuario.', 4960)]),
    row([cell('Sin autenticación multifactor (MFA) en el login', 3200), cell('MEDIO-ALTO', 1200, { fill: 'FDEBD0', color: 'A04000', bold: true }), cell('Integrar TOTP (Google Authenticator) o factor biométrico. Ya existe estructura para reconocimiento facial en el frontend.', 4960)]),
    row([cell('Ausencia de rate limiting explícito en rutas /auth y /validar', 3200), cell('MEDIO', 1200, { fill: 'FEF9E7', color: 'B7770D', bold: true }), cell('Implementar express-rate-limit con límite de 5 intentos/15 minutos en rutas de autenticación y bloqueo temporal.', 4960)]),
    row([cell('Sin política de retención de datos definida para transacciones históricas', 3200), cell('MEDIO', 1200, { fill: 'FEF9E7', color: 'B7770D', bold: true }), cell('Definir política de retención: transacciones financieras (5 años por normativa fiscal), datos de perfil eliminado (purga inmediata).', 4960)]),
    row([cell('Claves privadas ETH almacenadas en la misma BD que los datos de usuario', 3200), cell('MEDIO', 1200, { fill: 'FEF9E7', color: 'B7770D', bold: true }), cell('Migrar claves privadas ETH a un HSM (Hardware Security Module) o servicio de custodia como HashiCorp Vault o AWS KMS.', 4960)]),
    row([cell('No se verifican certificados SSL/TLS de las APIs de terceros en el backend', 3200), cell('BAJO-MEDIO', 1200, { fill: 'D5F5E3', color: '1E8449', bold: true }), cell('Habilitar verificación estricta de certificados TLS en las peticiones fetch() del backend.', 4960)]),
  ], [3200, 1200, 4960]),
  spacer(),

  h2('2.6 Decisión Estratégica: Sistema de Gestión de Protección de Datos Personales (SGPDP)'),
  p('Tomando en consideración el volumen y la sensibilidad de los datos tratados, HIT debe adoptar un Sistema de Gestión de Protección de Datos Personales (SGPDP) basado en el ciclo PHVA (Planear-Hacer-Verificar-Actuar), alineado con los Parámetros de Autorregulación del INAI y la norma ISO/IEC 27701:2019.'),

  h3('2.6.1 Elementos del SGPDP Recomendado'),
  numbered('Designación de un Responsable de Protección de Datos (DPO): persona interna o externa con conocimiento técnico-jurídico en materia de datos personales.'),
  numbered('Inventario de tratamientos: registro formal de todos los flujos de datos personales, actualizado al menos trimestralmente.'),
  numbered('Política de Protección de Datos Personales: documento rector que establezca compromisos, responsabilidades y procedimientos.'),
  numbered('Programa de capacitación: formación anual del personal en materia de privacidad y seguridad de la información.'),
  numbered('Auditorías internas periódicas: revisión semestral del cumplimiento de obligaciones y efectividad de las medidas técnicas.'),
  numbered('Plan de respuesta ante violaciones de seguridad: procedimiento documentado para notificar al INAI y a los titulares en un plazo no mayor a 72 horas desde la detección.'),
  numbered('Análisis de riesgo continuo: evaluaciones periódicas de amenazas y vulnerabilidades con matriz de riesgo actualizada.'),

  new Paragraph({ children: [new PageBreak()] }),
];

// ═══════════════════════════════════════════════════════════════════════════
//  SESIÓN 3 – PRINCIPIOS Y AVISO DE PRIVACIDAD
// ═══════════════════════════════════════════════════════════════════════════
const session3 = [
  h1('SESIÓN 3 — CUMPLIMIENTO DE PRINCIPIOS Y EVALUACIÓN DEL AVISO DE PRIVACIDAD'),

  h2('3.1 Evaluación del Cumplimiento de los Principios LFPDPPP'),
  p('El artículo 6 de la LFPDPPP establece los principios rectores del tratamiento de datos personales. A continuación se evalúa el grado de cumplimiento de Human System respecto a cada uno de ellos:'),
  tableFromRows([
    row([headerCell('Principio', 1800), headerCell('Definición Legal', 2400), headerCell('Estado en Human System', 2000), headerCell('Evidencia / Observaciones', 3160)]),
    row([cell('LICITUD', 1800), cell('El tratamiento debe fundarse en una base legal y el titular debe tener conocimiento del aviso de privacidad', 2400), cell('CUMPLE PARCIALMENTE', 2000, { fill: 'FEF9E7', color: 'B7770D', bold: true }), cell('El aviso de privacidad es presentado en el registro. Pendiente: verificar que el consentimiento sea previo y separado para datos biométricos.', 3160)]),
    row([cell('CONSENTIMIENTO', 1800), cell('El titular debe otorgar consentimiento previo, libre, específico e informado', 2400), cell('CUMPLE', 2000, { fill: 'D5F5E3', color: '1E8449', bold: true }), cell('Checkbox de aceptación del aviso + firma digital en el formulario de registro. Para datos sensibles se requiere consentimiento expreso.', 3160)]),
    row([cell('INFORMACIÓN', 1800), cell('El responsable debe informar al titular sobre todos los aspectos del tratamiento', 2400), cell('CUMPLE', 2000, { fill: 'D5F5E3', color: '1E8449', bold: true }), cell('Aviso de privacidad completo con 10 secciones publicado en el sitio web y en el modal de registro.', 3160)]),
    row([cell('CALIDAD', 1800), cell('Los datos deben ser exactos, completos, pertinentes y actualizados', 2400), cell('CUMPLE', 2000, { fill: 'D5F5E3', color: '1E8449', bold: true }), cell('Validaciones de formato de CURP (18 chars), RFC (13 chars), fecha de nacimiento y edad mínima de 18 años en el frontend y backend.', 3160)]),
    row([cell('FINALIDAD', 1800), cell('El tratamiento debe limitarse a las finalidades consentidas', 2400), cell('CUMPLE', 2000, { fill: 'D5F5E3', color: '1E8449', bold: true }), cell('No se usan datos para publicidad ni se comparten con terceros no identificados. Sin finalidades secundarias declaradas.', 3160)]),
    row([cell('LEALTAD', 1800), cell('No obtener datos mediante engaño o medios fraudulentos', 2400), cell('CUMPLE', 2000, { fill: 'D5F5E3', color: '1E8449', bold: true }), cell('El usuario provee activamente todos sus datos. Sin scraping ni obtención indirecta.', 3160)]),
    row([cell('PROPORCIONALIDAD', 1800), cell('Solo recabar los datos estrictamente necesarios', 2400), cell('CUMPLE PARCIALMENTE', 2000, { fill: 'FEF9E7', color: 'B7770D', bold: true }), cell('Los datos de redes sociales (hasta 8 redes) y la dirección de billetera cripto externa son opcionales. Pendiente: justificar necesidad de RFC completo vs. solo CURP.', 3160)]),
    row([cell('RESPONSABILIDAD', 1800), cell('El responsable debe adoptar medidas para garantizar los principios', 2400), cell('CUMPLE PARCIALMENTE', 2000, { fill: 'FEF9E7', color: 'B7770D', bold: true }), cell('Se cuentan con medidas técnicas robustas. Pendiente: formalizar SGPDP, designar DPO y establecer contratos de encargo.', 3160)]),
  ], [1800, 2400, 2000, 3160]),
  spacer(),

  h2('3.2 Evaluación del Aviso de Privacidad Vigente'),
  p('Human System cuenta con un Aviso de Privacidad publicado el 19 de agosto de 2025, presentado tanto en el sitio web como en el modal de registro. A continuación se evalúa su cumplimiento con los Lineamientos del Aviso de Privacidad del INAI:'),
  tableFromRows([
    row([headerCell('Elemento Requerido (Lineamientos INAI)', 4000), headerCell('¿Presente?', 1200), headerCell('Observación', 4160)]),
    row([cell('Identidad y domicilio del responsable', 4000), cell('SÍ', 1200, { fill: 'D5F5E3', color: '1E8449', bold: true }), cell('HIT S.A. de C.V., Ayuntamiento #143, Tlalpan, CDMX. Incluido en Sección I del aviso.', 4160)]),
    row([cell('Finalidades del tratamiento (primarias y secundarias)', 4000), cell('SÍ', 1200, { fill: 'D5F5E3', color: '1E8449', bold: true }), cell('Sección III. Se declara expresamente la ausencia de finalidades secundarias.', 4160)]),
    row([cell('Datos personales que serán tratados', 4000), cell('SÍ', 1200, { fill: 'D5F5E3', color: '1E8449', bold: true }), cell('Sección II. Incluye clasificación de sensibles (foto, firma digital).', 4160)]),
    row([cell('Transferencias de datos (incluyendo base legal)', 4000), cell('SÍ', 1200, { fill: 'D5F5E3', color: '1E8449', bold: true }), cell('Sección IV. Se menciona transferencia a verificadores de identidad bajo art. 37 LFPDPPP.', 4160)]),
    row([cell('Mecanismos para ejercer derechos ARCO', 4000), cell('SÍ', 1200, { fill: 'D5F5E3', color: '1E8449', bold: true }), cell('Sección V. Correo info@humansystem.mx con requisitos y plazo de 20 días hábiles.', 4160)]),
    row([cell('Opciones de revocación del consentimiento', 4000), cell('SÍ', 1200, { fill: 'D5F5E3', color: '1E8449', bold: true }), cell('Sección VI. Eliminación del perfil desde la plataforma o vía correo.', 4160)]),
    row([cell('Mecanismos para limitar uso y divulgación', 4000), cell('SÍ', 1200, { fill: 'D5F5E3', color: '1E8449', bold: true }), cell('Sección VII. Toggle de privacidad en plataforma y REPEP de PROFECO.', 4160)]),
    row([cell('Uso de cookies, web beacons y tecnologías de rastreo', 4000), cell('SÍ', 1200, { fill: 'D5F5E3', color: '1E8449', bold: true }), cell('Sección VIII. Se mencionan cookies técnicas de sesión.', 4160)]),
    row([cell('Procedimiento de modificación del aviso', 4000), cell('SÍ', 1200, { fill: 'D5F5E3', color: '1E8449', bold: true }), cell('Sección IX. Notificación por plataforma y correo registrado.', 4160)]),
    row([cell('Cláusula de consentimiento expreso para datos sensibles', 4000), cell('SÍ', 1200, { fill: 'D5F5E3', color: '1E8449', bold: true }), cell('Sección X. Consentimiento al marcar checkbox + firma digital.', 4160)]),
    row([cell('Nombre y datos del DPO o contacto de privacidad específico', 4000), cell('NO', 1200, { fill: 'FADBD8', color: 'C0392B', bold: true }), cell('BRECHA: No se designa un Responsable de Privacidad (DPO) específico. Se recomienda crear el rol y publicar su contacto.', 4160)]),
    row([cell('Política de retención y eliminación de datos', 4000), cell('NO', 1200, { fill: 'FADBD8', color: 'C0392B', bold: true }), cell('BRECHA: No se especifican plazos de conservación para cada categoría de dato. Requerido por el art. 11 LFPDPPP.', 4160)]),
    row([cell('Versión simplificada del aviso (corto + largo)', 4000), cell('PARCIAL', 1200, { fill: 'FEF9E7', color: 'B7770D', bold: true }), cell('Solo existe la versión completa. Para algunos canales se recomienda aviso simplificado de acuerdo a los Lineamientos INAI.', 4160)]),
  ], [4000, 1200, 4160]),
  spacer(),

  h2('3.3 Recomendaciones para el Aviso de Privacidad'),
  numbered('Incorporar política de retención de datos por categoría: identificación (durante la vigencia + 5 años), financieros (5 años por SAT), biométricos (durante la vigencia del perfil).'),
  numbered('Designar y publicar los datos del DPO: nombre, correo y horario de atención.'),
  numbered('Añadir aviso simplificado en el proceso de registro (máx. 3 párrafos) con referencia al aviso completo.'),
  numbered('Actualizar la Sección VIII con la descripción exacta de las cookies utilizadas y la forma de deshabilitarlas por navegador.'),
  numbered('Incorporar cláusula específica sobre transferencias internacionales de datos (Stripe en EUA, Twilio en EUA, Google Cloud en múltiples países) con las garantías adecuadas.'),

  new Paragraph({ children: [new PageBreak()] }),
];

// ═══════════════════════════════════════════════════════════════════════════
//  SESIÓN 4 – OPERACIÓN Y CUMPLIMIENTO COTIDIANO
// ═══════════════════════════════════════════════════════════════════════════
const session4 = [
  h1('SESIÓN 4 — OPERACIÓN, POLÍTICAS Y CUMPLIMIENTO COTIDIANO'),

  h2('4.1 Flujos de Datos Personales — Mapeo de Tratamientos'),
  p('Para garantizar el cumplimiento cotidiano, es fundamental mapear todos los flujos de datos personales dentro de la plataforma. A continuación se describen los tratamientos relevantes identificados en el análisis del código fuente:'),

  h3('4.1.1 Proceso de Registro (5 fases)'),
  tableFromRows([
    row([headerCell('Fase', 1200), headerCell('Acción', 2400), headerCell('Datos Involucrados', 2400), headerCell('Flujo de Datos', 1200), headerCell('Riesgo', 1160)]),
    row([cell('1 – Biométrica', 1200), cell('Captura y recorte de fotografía facial mediante Croppie', 2400), cell('Imagen facial (dato sensible)', 2400), cell('Cliente → Base64 → GCS', 1200), cell('ALTO', 1160, { fill: 'FADBD8', color: 'C0392B', bold: true })]),
    row([cell('2 – Identidad', 1200), cell('Ingreso de nombre, CURP, RFC, fecha de nacimiento', 2400), cell('Datos de identificación', 2400), cell('Cliente → Validación JS → Servidor → MongoDB', 1200), cell('MEDIO', 1160, { fill: 'FEF9E7', color: 'B7770D', bold: true })]),
    row([cell('3 – Contacto', 1200), cell('Ingreso de correo, teléfono y dirección. Verificación de duplicados', 2400), cell('Datos de contacto', 2400), cell('Cliente → /verificarDuplicados → MongoDB', 1200), cell('BAJO', 1160, { fill: 'D5F5E3', color: '1E8449', bold: true })]),
    row([cell('4 – Contraseña', 1200), cell('Creación de contraseña maestra', 2400), cell('Credencial de acceso', 2400), cell('Cliente → bcrypt hash → MongoDB (hash)', 1200), cell('BAJO', 1160, { fill: 'D5F5E3', color: '1E8449', bold: true })]),
    row([cell('5 – Firma + Pago', 1200), cell('Captura de firma digital y pago Stripe $500 MXN', 2400), cell('Firma (dato sensible), datos bancarios', 2400), cell('Firma → GCS | Pago → Stripe API', 1200), cell('ALTO', 1160, { fill: 'FADBD8', color: 'C0392B', bold: true })]),
  ], [1200, 2400, 2400, 1200, 1160]),
  spacer(),

  h3('4.1.2 Proceso de Autenticación (Login)'),
  bullet('El usuario ingresa su identificador (HumanoID, correo, teléfono, CURP o RFC) y contraseña.'),
  bullet('El servidor busca al usuario, verifica el hash bcrypt y si coincide, actualiza el campo sesionActiva a true y crea la sesión.'),
  bullet('La sesión persiste mediante cookies de sesión del servidor (express-session).'),
  bullet('Punto de riesgo: no existe actualmente un log de intentos fallidos de autenticación ni bloqueo automático de cuentas.'),

  h3('4.1.3 Validación de Credencial por Terceros'),
  p('Cuando un tercero escanea el QR de la tarjeta o certificado, el flujo es:'),
  numbered('El tercero accede a /validation con un token encriptado en la URL.'),
  numbered('El frontend envía el token al endpoint /validar via POST.'),
  numbered('El servidor desencripta el token con AES-256-GCM y verifica el AuthTag.'),
  numbered('Solo se devuelven datos públicos (nombre, foto y estado) si el humano está activo. En ningún caso se exponen CURP, RFC, correo, teléfono ni contraseña.'),
  p('Este diseño de mínima exposición de datos es correcto y cumple el principio de proporcionalidad.'),

  h3('4.1.4 Operación de la Billetera Digital'),
  bullet('Depósitos: procesados por Stripe con confirmación dual (paymentIntent.status === succeeded).'),
  bullet('Transferencias de HumanCoins: verificación de saldo, detección de similitud vectorial anti-duplicado y actualización atómica de balances.'),
  bullet('Clave privada ETH: cifrada con AES-256-GCM, almacenada en MongoDB, NUNCA transmitida al cliente ni en respuestas de API.'),
  bullet('Datos de precios de criptomonedas: obtenidos de CoinGecko API pública, sin transmisión de datos personales.'),

  h2('4.2 Transferencias Internacionales de Datos'),
  p('Conforme al artículo 36 de la LFPDPPP, las transferencias de datos personales a terceros en el extranjero requieren garantías adecuadas. Human System realiza las siguientes transferencias internacionales:'),
  tableFromRows([
    row([headerCell('Destinatario', 2000), headerCell('País', 1200), headerCell('Datos transferidos', 2400), headerCell('Garantía', 2200), headerCell('Cumplimiento', 1560)]),
    row([cell('Stripe, Inc.', 2000), cell('EUA', 1200), cell('Datos de tarjeta bancaria (tokenizados por Stripe Elements, nunca pasan por servidores HIT)', 2400), cell('PCI DSS L1, EU-US Data Privacy Framework, Cláusulas Contractuales Tipo', 2200), cell('ADECUADO', 1560, { fill: 'D5F5E3', color: '1E8449', bold: true })]),
    row([cell('Google Cloud (GCS, Firebase, MongoDB Atlas)', 2000), cell('EUA / Multi-región', 1200), cell('Todos los datos del perfil, fotos, firmas, BD', 2400), cell('ISO 27001, SOC 2 Type II, EU-US DPF, Acuerdo de Procesamiento de Datos disponible', 2200), cell('ADECUADO', 1560, { fill: 'D5F5E3', color: '1E8449', bold: true })]),
    row([cell('Twilio Inc.', 2000), cell('EUA', 1200), cell('Número de teléfono (para OTP)', 2400), cell('ISO 27001, EU-US DPF', 2200), cell('ADECUADO', 1560, { fill: 'D5F5E3', color: '1E8449', bold: true })]),
    row([cell('QRCode-AI / me-qr.com', 2000), cell('Internacional', 1200), cell('URL cifrada de validación (sin datos personales directos)', 2400), cell('Solo URL cifrada. Sin DPA formal documentada.', 2200), cell('REVISAR', 1560, { fill: 'FEF9E7', color: 'B7770D', bold: true })]),
  ], [2000, 1200, 2400, 2200, 1560]),
  spacer(),

  h2('4.3 Tratamientos Relevantes o Intensivos — Análisis Específico'),

  h3('4.3.1 Tratamiento de Datos Biométricos (Fotografía Facial y Firma Digital)'),
  p('Este es el tratamiento de mayor riesgo en la plataforma dada la naturaleza sensible de los datos. Los datos biométricos poseen una característica irreversible: a diferencia de una contraseña, no pueden modificarse si son comprometidos.'),
  bullet('Riesgo principal: el acceso público a las URLs de GCS permite que cualquier persona con la URL descargue la fotografía facial del titular.'),
  bullet('Riesgo secundario: la fotografía facial se usa para pre-cargar dinámicamente en la pantalla de login, lo que implica que se puede determinar si un identificador específico existe en el sistema, facilitando ataques de enumeración de usuarios.'),
  bullet('Medida correctiva urgente: implementar Signed URLs con expiración en GCS para todos los archivos de usuarios (fotos y firmas).'),
  bullet('Medida adicional: considerar si la funcionalidad de pre-carga de foto en el login es estrictamente necesaria, ya que sacrifica privacidad por UX.'),

  h3('4.3.2 Tratamiento de Datos Financieros (Billetera y Transacciones)'),
  bullet('Datos de transacciones almacenados como array embebido en el documento MongoDB del usuario: riesgo de documentos extremadamente grandes con usuarios activos.'),
  bullet('Vectores de transacciones (128 dimensiones) almacenados en MongoDB sin índice dedicado: correcto funcionamiento pero ineficiente a escala.'),
  bullet('Clave privada ETH cifrada con AES-256-GCM: medida correcta. Sin embargo, su almacenamiento en la misma BD de usuarios es un riesgo de concentración.'),

  h3('4.3.3 Tratamiento de CURP y RFC (Documentos de Identidad Nacional)'),
  bullet('CURP y RFC almacenados en texto plano en MongoDB: estos datos son usados como credenciales de autenticación, por lo que un acceso no autorizado a la BD expone datos de identidad nacional.'),
  bullet('Recomendación: evaluar la posibilidad de almacenar CURP y RFC con hash (SHA-256 salado) y mantener solo los últimos 4 dígitos en claro para referencia del usuario.'),

  h2('4.4 Procedimiento de Respuesta ante Violaciones de Seguridad'),
  p('Conforme al artículo 20 de la LFPDPPP y las Recomendaciones de Seguridad del INAI, en caso de una violación de datos personales ("brecha de seguridad"), HIT debe seguir el siguiente protocolo:'),
  numbered('Detección y contención: identificar el origen y alcance de la violación. Aislar los sistemas afectados.'),
  numbered('Evaluación de impacto: determinar qué datos fueron comprometidos, cuántos titulares se ven afectados y cuál es el riesgo potencial de daño (discriminación, fraude, daño reputacional, etc.).'),
  numbered('Notificación al INAI: reportar la violación conforme al procedimiento establecido por el INAI, incluyendo descripción del incidente, medidas adoptadas y afectados estimados.'),
  numbered('Notificación a titulares afectados: informar a los titulares mediante correo electrónico registrado, describiendo el incidente, los datos comprometidos y las medidas que el titular puede tomar para protegerse.'),
  numbered('Remediación técnica: implementar las correcciones necesarias para eliminar la vulnerabilidad explotada.'),
  numbered('Documentación y aprendizaje: registrar el incidente en el log de violaciones de seguridad y actualizar el análisis de riesgo.'),
  p('Plazo recomendado para notificación a titulares: dentro de las 72 horas siguientes al conocimiento del incidente (estándar RGPD adoptado como mejor práctica).'),

  new Paragraph({ children: [new PageBreak()] }),
];

// ═══════════════════════════════════════════════════════════════════════════
//  SESIÓN 5 – ELEMENTOS DE LA EIP
// ═══════════════════════════════════════════════════════════════════════════
const session5 = [
  h1('SESIÓN 5 — ELEMENTOS DE LA EVALUACIÓN DE IMPACTO A LA PRIVACIDAD (EIP)'),

  h2('5.1 Justificación de la EIP para Human System'),
  p('La Evaluación de Impacto a la Privacidad (EIP) es un proceso sistemático para identificar, evaluar y mitigar los riesgos que un proyecto o sistema tecnológico representa para la privacidad de los titulares de datos personales. Su elaboración está recomendada por el INAI cuando el tratamiento involucra datos sensibles, tecnologías emergentes, decisiones automatizadas o impacta a un número significativo de personas.'),
  p('Human System cumple con TODOS los criterios que hacen mandatoria la elaboración de una EIP:'),
  bullet('Tratamiento de datos biométricos (foto facial y firma digital) — categoría de datos de mayor sensibilidad.'),
  bullet('Tratamiento de datos financieros (billetera digital, transacciones, claves ETH).'),
  bullet('Uso de tecnologías emergentes: inteligencia artificial para detección de transacciones duplicadas, NFC, QR esteganográfico, blockchain Ethereum.'),
  bullet('Perfilamiento de identidad: el HumanoID centraliza la identidad digital, financiera y física del titular en un único sistema.'),
  bullet('Impacto masivo potencial: sistema diseñado para escalar a nivel nacional e internacional.'),
  bullet('Transferencias internacionales de datos a múltiples encargados en EUA y Europa.'),

  h2('5.2 Metodología Empleada'),
  p('La presente EIP sigue la metodología de cinco fases recomendada por el INAI y compatible con el estándar ISO/IEC 29134:2017 (Guidelines for Privacy Impact Assessment):'),
  numbered('Fase 1 — Descripción del sistema y del contexto de tratamiento.'),
  numbered('Fase 2 — Identificación y clasificación de datos personales tratados.'),
  numbered('Fase 3 — Evaluación de la necesidad y proporcionalidad del tratamiento.'),
  numbered('Fase 4 — Evaluación de riesgos para los derechos y libertades de los titulares.'),
  numbered('Fase 5 — Determinación de medidas de mitigación y plan de acción.'),

  h2('5.3 Evaluación de Necesidad y Proporcionalidad'),
  tableFromRows([
    row([headerCell('Dato Personal', 2400), headerCell('¿Necesario?', 1200), headerCell('¿Proporcional?', 1200), headerCell('Justificación', 4560)]),
    row([cell('Fotografía facial', 2400), cell('SÍ', 1200, { fill: 'D5F5E3', color: '1E8449', bold: true }), cell('SÍ', 1200, { fill: 'D5F5E3', color: '1E8449', bold: true }), cell('Elemento central del sistema de identidad visual verificada. Se imprime en la tarjeta física.', 4560)]),
    row([cell('Firma digital', 2400), cell('SÍ', 1200, { fill: 'D5F5E3', color: '1E8449', bold: true }), cell('SÍ', 1200, { fill: 'D5F5E3', color: '1E8449', bold: true }), cell('Elemento de autenticidad del certificado y tarjeta. Equivalente funcional a la firma autógrafa en documentos físicos.', 4560)]),
    row([cell('CURP', 2400), cell('SÍ', 1200, { fill: 'D5F5E3', color: '1E8449', bold: true }), cell('SÍ', 1200, { fill: 'D5F5E3', color: '1E8449', bold: true }), cell('Identificador nacional único. Necesario para generar el HumanoID y evitar registros duplicados de la misma persona.', 4560)]),
    row([cell('RFC', 2400), cell('REVISAR', 1200, { fill: 'FEF9E7', color: 'B7770D', bold: true }), cell('REVISAR', 1200, { fill: 'FEF9E7', color: 'B7770D', bold: true }), cell('La plataforma no realiza actualmente operaciones fiscales. Evaluar si puede sustituirse por CURP únicamente para la primera versión del producto.', 4560)]),
    row([cell('Dirección de domicilio', 2400), cell('SÍ', 1200, { fill: 'D5F5E3', color: '1E8449', bold: true }), cell('SÍ', 1200, { fill: 'D5F5E3', color: '1E8449', bold: true }), cell('Necesaria para el envío físico de la tarjeta y certificados impresos.', 4560)]),
    row([cell('Clave privada ETH', 2400), cell('SÍ', 1200, { fill: 'D5F5E3', color: '1E8449', bold: true }), cell('REVISAR', 1200, { fill: 'FEF9E7', color: 'B7770D', bold: true }), cell('Necesaria para la funcionalidad de billetera ETH. Sin embargo, su almacenamiento en la BD principal es cuestionable. Un esquema de custodia externa (HSM) sería más proporcional.', 4560)]),
    row([cell('Historial completo de transacciones', 2400), cell('SÍ', 1200, { fill: 'D5F5E3', color: '1E8449', bold: true }), cell('REVISAR', 1200, { fill: 'FEF9E7', color: 'B7770D', bold: true }), cell('El historial completo sin límite de tiempo puede ser desproporcional. Recomendar política de retención de 5 años con archivado automático.', 4560)]),
    row([cell('Vectores de embedding (128 dims)', 2400), cell('SÍ', 1200, { fill: 'D5F5E3', color: '1E8449', bold: true }), cell('SÍ', 1200, { fill: 'D5F5E3', color: '1E8449', bold: true }), cell('Usados exclusivamente para detección de fraude interno. No son accesibles al usuario ni identifican a personas directamente.', 4560)]),
    row([cell('Datos de redes sociales (hasta 8 redes)', 2400), cell('NO crítico', 1200, { fill: 'FEF9E7', color: 'B7770D', bold: true }), cell('SÍ (opcional)', 1200, { fill: 'D5F5E3', color: '1E8449', bold: true }), cell('Son opcionales y el usuario los provee voluntariamente. El campo puede ser eliminado sin afectar la funcionalidad principal de identidad.', 4560)]),
  ], [2400, 1200, 1200, 4560]),
  spacer(),

  h2('5.4 Matriz de Riesgos a la Privacidad'),
  p('A continuación se presenta la evaluación de riesgos para los derechos y libertades de los titulares, clasificados por probabilidad e impacto:'),
  tableFromRows([
    row([headerCell('ID', 600), headerCell('Amenaza / Riesgo', 2800), headerCell('Datos Afectados', 1800), headerCell('Prob.', 800), headerCell('Impacto', 800), headerCell('Nivel', 800), headerCell('Medida de Mitigación', 2760)]),
    row([cell('R-01', 600), cell('Acceso no autorizado a fotografías y firmas en GCS (URL pública sin autenticación)', 2800), cell('Biométricos', 1800), cell('ALTA', 800, { fill: 'FADBD8', bold: true, color: 'C0392B' }), cell('CRÍTICO', 800, { fill: 'FADBD8', bold: true, color: 'C0392B' }), cell('CRÍTICO', 800, { fill: 'FADBD8', bold: true, color: 'C0392B' }), cell('Implementar GCS Signed URLs con expiración de 1 hora. Remediación inmediata.', 2760)]),
    row([cell('R-02', 600), cell('Acceso no autorizado a MongoDB con todos los datos del titular (ataque a credenciales de BD)', 2800), cell('Todos', 1800), cell('MEDIA', 800, { fill: 'FEF9E7', bold: true, color: 'B7770D' }), cell('CRÍTICO', 800, { fill: 'FADBD8', bold: true, color: 'C0392B' }), cell('ALTO', 800, { fill: 'FDEBD0', bold: true, color: 'A04000' }), cell('IP whitelisting en MongoDB Atlas, rotación periódica de credenciales, habilitación de MongoDB Audit Logs.', 2760)]),
    row([cell('R-03', 600), cell('Fuerza bruta en endpoint /auth sin rate limiting (enumeración de usuarios)', 2800), cell('Credenciales', 1800), cell('ALTA', 800, { fill: 'FADBD8', bold: true, color: 'C0392B' }), cell('ALTO', 800, { fill: 'FDEBD0', bold: true, color: 'A04000' }), cell('ALTO', 800, { fill: 'FDEBD0', bold: true, color: 'A04000' }), cell('express-rate-limit (5 intentos/15 min), captcha en login, bloqueo temporal de cuenta.', 2760)]),
    row([cell('R-04', 600), cell('Exfiltración de clave privada ETH cifrada si la BD es comprometida', 2800), cell('Activos cripto', 1800), cell('MEDIA', 800, { fill: 'FEF9E7', bold: true, color: 'B7770D' }), cell('ALTO', 800, { fill: 'FDEBD0', bold: true, color: 'A04000' }), cell('ALTO', 800, { fill: 'FDEBD0', bold: true, color: 'A04000' }), cell('Migrar claves ETH a HSM o HashiCorp Vault separado. Separación física de claves y datos de perfil.', 2760)]),
    row([cell('R-05', 600), cell('Compromiso de la ENCRYPTION_KEY por exposición de variables de entorno', 2800), cell('Todos (cifrado)', 1800), cell('BAJA', 800, { fill: 'D5F5E3', bold: true, color: '1E8449' }), cell('CRÍTICO', 800, { fill: 'FADBD8', bold: true, color: 'C0392B' }), cell('MEDIO', 800, { fill: 'FEF9E7', bold: true, color: 'B7770D' }), cell('Usar un gestor de secretos (Google Secret Manager, HashiCorp Vault). Rotación trimestral de la clave.', 2760)]),
    row([cell('R-06', 600), cell('Uso de foto facial para identificación de titulares sin su consentimiento por terceros que accedan a URLs públicas GCS', 2800), cell('Biométricos', 1800), cell('ALTA', 800, { fill: 'FADBD8', bold: true, color: 'C0392B' }), cell('ALTO', 800, { fill: 'FDEBD0', bold: true, color: 'A04000' }), cell('ALTO', 800, { fill: 'FDEBD0', bold: true, color: 'A04000' }), cell('Signed URLs (R-01). Añadir marca de agua digital invisible a las fotos almacenadas.', 2760)]),
    row([cell('R-07', 600), cell('Transmisión de datos personales a APIs de QR sin contrato de encargo formalizado', 2800), cell('URL con token', 1800), cell('MEDIA', 800, { fill: 'FEF9E7', bold: true, color: 'B7770D' }), cell('MEDIO', 800, { fill: 'FEF9E7', bold: true, color: 'B7770D' }), cell('MEDIO', 800, { fill: 'FEF9E7', bold: true, color: 'B7770D' }), cell('Formalizar contratos de encargo con QRCode-AI y me-qr.com conforme al art. 25 LFPDPPP. Alternativa: usar exclusivamente el motor local.', 2760)]),
    row([cell('R-08', 600), cell('Pérdida o robo de dispositivo del titular con sesión activa (sesión sin expiración explícita)', 2800), cell('Perfil completo', 1800), cell('MEDIA', 800, { fill: 'FEF9E7', bold: true, color: 'B7770D' }), cell('MEDIO', 800, { fill: 'FEF9E7', bold: true, color: 'B7770D' }), cell('MEDIO', 800, { fill: 'FEF9E7', bold: true, color: 'B7770D' }), cell('Configurar expiración de sesión (maxAge en express-session). Implementar cierre de sesión remoto por Kill Switch.', 2760)]),
    row([cell('R-09', 600), cell('Inyección de código (XSS) en campos de texto que almacenen datos en la BD', 2800), cell('Datos de texto', 1800), cell('BAJA', 800, { fill: 'D5F5E3', bold: true, color: '1E8449' }), cell('ALTO', 800, { fill: 'FDEBD0', bold: true, color: 'A04000' }), cell('BAJO', 800, { fill: 'D5F5E3', bold: true, color: '1E8449' }), cell('Validar y sanitizar todos los inputs en el servidor. Implementar Content Security Policy (CSP) en las cabeceras HTTP.', 2760)]),
    row([cell('R-10', 600), cell('Transferencia no autorizada de datos por empleado interno (amenaza interna)', 2800), cell('Todos', 1800), cell('BAJA', 800, { fill: 'D5F5E3', bold: true, color: '1E8449' }), cell('ALTO', 800, { fill: 'FDEBD0', bold: true, color: 'A04000' }), cell('BAJO', 800, { fill: 'D5F5E3', bold: true, color: '1E8449' }), cell('RBAC (Control de Acceso Basado en Roles) en la BD. Registro de auditoría de accesos. Capacitación al personal.', 2760)]),
  ], [600, 2800, 1800, 800, 800, 800, 2760]),
  spacer(),

  h2('5.5 Plan de Acción y Hoja de Ruta de Cumplimiento'),
  tableFromRows([
    row([headerCell('Acción', 3600), headerCell('Responsable', 1800), headerCell('Prioridad', 1200), headerCell('Plazo', 1200), headerCell('Costo Est.', 1560)]),
    row([cell('Implementar GCS Signed URLs (R-01, R-06)', 3600), cell('Equipo de Ingeniería', 1800), cell('CRÍTICA', 1200, { fill: 'FADBD8', bold: true, color: 'C0392B' }), cell('Inmediato (1-2 semanas)', 1200), cell('$0 (GCS nativo)', 1560)]),
    row([cell('Implementar rate limiting en /auth y /validar (R-03)', 3600), cell('Equipo de Ingeniería', 1800), cell('ALTA', 1200, { fill: 'FDEBD0', bold: true, color: 'A04000' }), cell('2-4 semanas', 1200), cell('$0 (npm)', 1560)]),
    row([cell('Configurar expiración de sesiones (R-08)', 3600), cell('Equipo de Ingeniería', 1800), cell('ALTA', 1200, { fill: 'FDEBD0', bold: true, color: 'A04000' }), cell('1 semana', 1200), cell('$0', 1560)]),
    row([cell('Formalizar contratos de encargo con todos los encargados (R-07)', 3600), cell('Legal / DPO', 1800), cell('ALTA', 1200, { fill: 'FDEBD0', bold: true, color: 'A04000' }), cell('30 días', 1200), cell('Honorarios legales', 1560)]),
    row([cell('Designar DPO y actualizar el Aviso de Privacidad con sus datos', 3600), cell('Dirección General / Legal', 1800), cell('ALTA', 1200, { fill: 'FDEBD0', bold: true, color: 'A04000' }), cell('30 días', 1200), cell('Bajo', 1560)]),
    row([cell('Implementar política de retención de datos por categoría', 3600), cell('Legal + Ingeniería', 1800), cell('MEDIA', 1200, { fill: 'FEF9E7', bold: true, color: 'B7770D' }), cell('60 días', 1200), cell('Bajo', 1560)]),
    row([cell('Migrar claves ETH a gestor de secretos (R-04, R-05)', 3600), cell('Equipo de Ingeniería', 1800), cell('MEDIA', 1200, { fill: 'FEF9E7', bold: true, color: 'B7770D' }), cell('60-90 días', 1200), cell('Medio (GCP KMS)', 1560)]),
    row([cell('Implementar MFA (TOTP/biométrico) para login', 3600), cell('Equipo de Ingeniería', 1800), cell('MEDIA', 1200, { fill: 'FEF9E7', bold: true, color: 'B7770D' }), cell('90 días', 1200), cell('Bajo-Medio', 1560)]),
    row([cell('Activar MongoDB Atlas Audit Logs y IP Whitelist (R-02)', 3600), cell('Equipo de Infraestructura', 1800), cell('MEDIA', 1200, { fill: 'FEF9E7', bold: true, color: 'B7770D' }), cell('2 semanas', 1200), cell('Incluido en plan Atlas', 1560)]),
    row([cell('Formalizar SGPDP completo con DPO, inventario y auditorías', 3600), cell('DPO + Dirección', 1800), cell('ESTRATÉGICA', 1200, { fill: 'EAF4F8', bold: true, color: '1F4E67' }), cell('6 meses', 1200), cell('Mediano', 1560)]),
    row([cell('Evaluación de eliminar RFC del proceso de registro (sustituir por CURP)', 3600), cell('Producto + Legal', 1800), cell('ESTRATÉGICA', 1200, { fill: 'EAF4F8', bold: true, color: '1F4E67' }), cell('90 días', 1200), cell('$0', 1560)]),
  ], [3600, 1800, 1200, 1200, 1560]),
  spacer(),

  new Paragraph({ children: [new PageBreak()] }),
];

// ═══════════════════════════════════════════════════════════════════════════
//  TABLA COMPARATIVA: DOCUMENTOS DE IDENTIFICACIÓN
// ═══════════════════════════════════════════════════════════════════════════
const compTable = [
  h1('TABLA COMPARATIVA — DOCUMENTOS DE IDENTIFICACIÓN VIGENTES EN MÉXICO vs. HUMAN SYSTEM'),
  p('La siguiente tabla presenta un análisis comparativo tipo SCRUM (con criterios de valor, funcionalidad y cobertura) de los principales documentos de identificación en México, contrastados con la tarjeta Human ID de la plataforma Human System.'),
  spacer(),

  tableFromRows([
    row([
      headerCell('CRITERIO', 1400),
      headerCell('PASAPORTE\n(SRE)', 1680),
      headerCell('CREDENCIAL\nPARA VOTAR\n(INE)', 1680),
      headerCell('CARTILLA\nMILITAR\n(SEDENA)', 1680),
      headerCell('LICENCIA DE\nCONDUCIR\n(Gobierno Estatal)', 1680),
      headerCell('HUMAN ID\n(Human System)', 1240),
    ]),
    row([
      cell('Entidad Emisora', 1400, { bold: true, color: C.darkBlue }),
      cell('Secretaría de Relaciones Exteriores (SRE)', 1680),
      cell('Instituto Nacional Electoral (INE)', 1680),
      cell('Secretaría de la Defensa Nacional (SEDENA)', 1680),
      cell('Secretaría de Movilidad / Dirección de Tránsito (varía por entidad)', 1680),
      cell('Human Identification Technologies S.A. de C.V. (empresa privada)', 1240),
    ]),
    row([
      cell('Base Legal', 1400, { bold: true, color: C.darkBlue }),
      cell('Ley de Pasaportes (2011), Reglamento SRE', 1680),
      cell('LGIPE, COFIPE. Órgano constitucional autónomo', 1680),
      cell('Ley del Servicio Militar Nacional, Código de Justicia Militar', 1680),
      cell('Ley de Tránsito y Vialidad de cada entidad federativa (32 leyes distintas)', 1680),
      cell('LFPDPPP, Reglamento LFPDPPP. Acto voluntario (contrato de servicios)', 1240),
    ]),
    row([
      cell('Validez Jurídica', 1400, { bold: true, color: C.darkBlue }),
      cell('Documento público federal con plena fe probatoria. Aceptado internacionalmente como pasaporte', 1680),
      cell('Documento público de mayor uso en México. Reconocido como identificación oficial por el 99% de instituciones', 1680),
      cell('Documento oficial federal para hombres de 18 a 40 años. Acredita cumplimiento del servicio militar', 1680),
      cell('Documento oficial estatal. Reconocido como identificación en México. NO válida como identificación en el extranjero', 1680),
      cell('Documento PRIVADO. No es identificación oficial ante el gobierno. Sirve para verificación de identidad en contextos privados y comerciales', 1240),
    ]),
    row([
      cell('Datos de Identificación', 1400, { bold: true, color: C.darkBlue }),
      cell('Nombre, fecha y lugar de nacimiento, nacionalidad, foto, firma, CURP, número de pasaporte, MRZ (Machine Readable Zone)', 1680),
      cell('Nombre, CURP, fecha de nacimiento, domicilio, clave de elector, foto, firma, huellas dactilares, número de identificación, sección electoral', 1680),
      cell('Nombre, CURP, fecha de nacimiento, número de cartilla, clase de soldado, foto, firma, datos del servicio militar prestado', 1680),
      cell('Nombre, fecha de nacimiento, domicilio, tipo de licencia, vigencia, foto, firma, restricciones médicas (varía por estado)', 1680),
      cell('Nombre, CURP, RFC, foto facial, firma digital, HumanoID, fecha de nacimiento, datos de contacto, QR dinámico, NFC, número de tarjeta virtual', 1240),
    ]),
    row([
      cell('Elementos de Seguridad Físicos', 1400, { bold: true, color: C.darkBlue }),
      cell('Chip RFID (pasaporte biométrico), MRZ, hologramas OVD, tinta OVI, microtexto, papel especial con fibras de seguridad, guilloche, tintas UV/IR', 1680),
      cell('Holografía de alta seguridad, tinta OVI, fotoidentificación integrada, código de barras 2D (PDF417), microtexto, sustrato policarbonato, chip NFC desde 2021', 1680),
      cell('Foto integrada, holograma, microtexto, fondo de seguridad con guilloche, numeración láser, materiales de policarbonato', 1680),
      cell('Foto, holograma (varía por estado), tinta especial, código QR o barras (varía por entidad). Calidad muy heterogénea a nivel nacional', 1680),
      cell('Chip EMV contactless (NFC), QR dinámico anti-captura, Photo-QR Esteganográfico, OVD holográfico dactilar, tinta OVI Gen3, guilloche, tinta UV, grabado láser (Braille-ready), banda magnética, policarbonato, certificado de autenticidad', 1240),
    ]),
    row([
      cell('Tecnología Digital / NFC', 1400, { bold: true, color: C.darkBlue }),
      cell('Chip RFID (ICAO 9303). Solo lectura por autoridades migratorias con equipos homologados', 1680),
      cell('NFC (desde 2021 en credenciales nuevas). App INE para lectura básica', 1680),
      cell('Sin NFC. Sin componente digital avanzado', 1680),
      cell('Mayoritariamente sin NFC. Algunas entidades tienen QR estático para verificación básica', 1680),
      cell('NFC ISO/IEC 14443-A con perfil dinámico (el enlace NFC cambia según configuración del titular). QR dinámico regenerado. Billetera Ethereum integrada. CVV dinámico con temporizador de 5 minutos', 1240),
    ]),
    row([
      cell('Verificación en Línea / Tiempo Real', 1400, { bold: true, color: C.darkBlue }),
      cell('Solo por autoridades con acceso a SICAP (sistema cerrado del gobierno). Sin verificación pública en tiempo real', 1680),
      cell('Verificación básica en lista nominal (solo vigencia). Sin API pública de verificación instantánea', 1680),
      cell('Sin verificación en línea pública disponible', 1680),
      cell('Algunos estados tienen portal de consulta de vigencia. Sin estándar nacional', 1680),
      cell('Verificación pública en tiempo real en humansystem.mx/validation. Resultado inmediato (< 2 segundos): estado del humano, foto y nombre. Triple validación: HumanoID + Tarjeta + Certificado', 1240),
    ]),
    row([
      cell('Control de Privacidad del Titular', 1400, { bold: true, color: C.darkBlue }),
      cell('NINGUNO. El titular no puede controlar qué datos se muestran al validar el documento', 1680),
      cell('MÍNIMO. El titular puede solicitar la no publicación del domicilio en el REPEP. Sin control sobre datos mostrados en la credencial', 1680),
      cell('NINGUNO. Documento de uso institucional militar sin opciones de privacidad', 1680),
      cell('NINGUNO. El titular no tiene control sobre los datos impresos en la licencia', 1680),
      cell('TOTAL. Toggle Zero-Knowledge: el titular controla en tiempo real qué datos se muestran públicamente. Puede ocultar todo su perfil con un clic. El endpoint de validación pública solo muestra nombre y foto básica si el humano activa su perfil', 1240),
    ]),
    row([
      cell('Capacidades Financieras', 1400, { bold: true, color: C.darkBlue }),
      cell('NINGUNA. Es solo un documento de identidad y viaje', 1680),
      cell('NINGUNA. Solo identificación. Algunos bancos la usan como KYC inicial', 1680),
      cell('NINGUNA', 1680),
      cell('NINGUNA', 1680),
      cell('COMPLETAS. Billetera multi-moneda integrada (MXN, HumanCoins, ETH, USDC), pagos NFC tap-to-pay, transferencias P2P entre humanos, QR de cobro dinámico, CVV dinámico para compras online', 1240),
    ]),
    row([
      cell('Vigencia', 1400, { bold: true, color: C.darkBlue }),
      cell('3 a 10 años según tipo', 1680),
      cell('Permanente (con actualización periódica de datos)', 1680),
      cell('Permanente (una vez liberado del servicio)', 1680),
      cell('1 a 3 años (varía por entidad)', 1680),
      cell('Vitalicia (una vez registrado). La tarjeta física: 3 años de vigencia impresa, renovable. El perfil digital: permanente hasta cancelación voluntaria', 1240),
    ]),
    row([
      cell('Costo para el Titular', 1400, { bold: true, color: C.darkBlue }),
      cell('$1,575 MXN (pasaporte de 3 años) a $2,875 MXN (10 años) — Derechos SAT 2024', 1680),
      cell('GRATUITA (derecho ciudadano)', 1680),
      cell('GRATUITA (obligación de servicio militar)', 1680),
      cell('Varía: $200 a $1,200 MXN dependiendo del estado y tipo de licencia', 1680),
      cell('$500 MXN (pago único por registro vitalicio, incluye tarjeta física y envío). Reposición de tarjeta: $500 MXN. Certificados adicionales: $50 MXN c/u', 1240),
    ]),
    row([
      cell('Protección de Datos Personales', 1400, { bold: true, color: C.darkBlue }),
      cell('LFPDPPP aplica parcialmente. El Estado no está sujeto a la misma ley (aplica LGPDPPSO)', 1680),
      cell('LGPDPPSO para el INE como sujeto obligado. Aviso de privacidad público disponible', 1680),
      cell('LGPDPPSO (SEDENA como sujeto obligado). Aviso de privacidad institucional', 1680),
      cell('LGPDPPSO para entidades gubernamentales estatales. Cumplimiento muy heterogéneo', 1680),
      cell('LFPDPPP aplica en su totalidad. HIT como particular debe cumplir todas las obligaciones de la ley. Aviso de privacidad completo. Derechos ARCO garantizados', 1240),
    ]),
    row([
      cell('Derechos ARCO del Titular', 1400, { bold: true, color: C.darkBlue }),
      cell('Limitados. Rectificación vía trámite ante SRE. Sin cancelación posible del pasaporte activo', 1680),
      cell('Limitados. Modificación de domicilio y datos ante INE. Sin derecho a cancelación total del padrón', 1680),
      cell('Sin mecanismo ARCO para civiles. Documento ligado al servicio militar obligatorio', 1680),
      cell('Limitados. Modificación de datos vía renovación. Varía por entidad', 1680),
      cell('PLENOS Y DIRECTOS. El titular puede: ver todos sus datos (Acceso), modificarlos en tiempo real (Rectificación), eliminar su perfil permanentemente con un clic (Cancelación), oponerse al uso de datos específicos (Oposición). Plazo de respuesta: 20 días hábiles o inmediato desde la plataforma', 1240),
    ]),
    row([
      cell('Puntuación SCRUM de Funcionalidad Digital (0-10)', 1400, { bold: true, color: C.darkBlue }),
      cell('6/10 — Chip RFID avanzado pero acceso restringido a autoridades', 1680, { bold: true, color: '1F4E67' }),
      cell('5/10 — NFC básico, sin capacidades financieras ni control de privacidad', 1680, { bold: true, color: '1F4E67' }),
      cell('2/10 — Sin componente digital significativo', 1680, { bold: true, color: '8B0000' }),
      cell('3/10 — Muy heterogéneo. Pocos estados con QR. Sin estándar', 1680, { bold: true, color: '8B0000' }),
      cell('9/10 — Máximas capacidades digitales disponibles. Pendiente: MFA y Signed URLs para 10/10', 1240, { bold: true, color: '1E8449' }),
    ]),
  ], [1400, 1680, 1680, 1680, 1680, 1240]),
  spacer(),

  p('Nota importante: Human System NO sustituye ni reemplaza a los documentos de identificación oficial del Estado mexicano. Es un sistema complementario de identidad privada que ofrece capacidades adicionales de verificación digital, privacidad y servicios financieros integrados, diseñado para contextos comerciales, profesionales y personales donde los documentos oficiales no son los mecanismos más eficientes o accesibles.'),
  spacer(),
  new Paragraph({ children: [new PageBreak()] }),
];

// ═══════════════════════════════════════════════════════════════════════════
//  CONCLUSIONES Y FIRMA
// ═══════════════════════════════════════════════════════════════════════════
const conclusions = [
  h1('CONCLUSIONES Y DECLARACIÓN DE CUMPLIMIENTO'),

  h2('6.1 Conclusiones Generales'),
  p('La presente Evaluación de Impacto a la Privacidad ha identificado que Human System es una plataforma tecnológicamente avanzada que implementa medidas de seguridad robustas en múltiples capas. Sin embargo, la naturaleza altamente sensible de los datos tratados (biométricos, financieros e identificativos) exige que las brechas identificadas sean atendidas de manera urgente y sistemática.'),

  h3('Fortalezas identificadas:'),
  bullet('Cifrado AES-256-GCM para tokens y credenciales financieras.'),
  bullet('Hash bcrypt para contraseñas con factor de trabajo adecuado.'),
  bullet('Principio de mínima exposición en el endpoint de validación pública.'),
  bullet('Control de privacidad Zero-Knowledge para el titular.'),
  bullet('Aviso de privacidad completo y conforme a los Lineamientos INAI.'),
  bullet('Mecanismo de eliminación de perfil inmediato con verificación de contraseña.'),
  bullet('Detección de transacciones duplicadas mediante Vector Search.'),

  h3('Áreas de mejora críticas:'),
  bullet('Implementación urgente de GCS Signed URLs para eliminar acceso público a datos biométricos.'),
  bullet('Implementación de rate limiting en endpoints de autenticación.'),
  bullet('Formalización de contratos de encargo con todos los proveedores externos.'),
  bullet('Designación de un DPO y formalización del SGPDP.'),
  bullet('Actualización del Aviso de Privacidad con política de retención de datos.'),

  h2('6.2 Declaración de Cumplimiento'),
  p('Human Identification Technologies, S.A. de C.V. declara su compromiso con la protección de los datos personales de los titulares conforme a la LFPDPPP y su Reglamento, y se obliga a implementar el plan de acción descrito en la Sección 5.5 de la presente EIP dentro de los plazos establecidos.'),

  spacer(400),

  tableFromRows([
    row([
      cell('Elaborado por:', 2400, { bold: true, color: C.darkBlue }),
      cell('Revisado por:', 2400, { bold: true, color: C.darkBlue }),
      cell('Aprobado por:', 2400, { bold: true, color: C.darkBlue }),
      cell('Fecha:', 2160, { bold: true, color: C.darkBlue }),
    ]),
    row([
      cell('\n\n\n_________________________\nResponsable de Privacidad\nHuman System', 2400),
      cell('\n\n\n_________________________\nDirector de Tecnología\nHuman System', 2400),
      cell('\n\n\n_________________________\nDirector General\nHIT S.A. de C.V.', 2400),
      cell('\n\n\n_________________________\nFecha de aprobación', 2160),
    ]),
  ], [2400, 2400, 2400, 2160]),
];

// ═══════════════════════════════════════════════════════════════════════════
//  DOCUMENT ASSEMBLY
// ═══════════════════════════════════════════════════════════════════════════
const doc = new Document({
  numbering: {
    config: [
      {
        reference: 'bullets',
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: '•',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 600, hanging: 360 } } }
        }]
      },
      {
        reference: 'numbers',
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: '%1.',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 600, hanging: 360 } } }
        }]
      },
    ]
  },
  styles: {
    default: {
      document: { run: { font: 'Arial', size: 20 } }
    },
    paragraphStyles: [
      {
        id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, font: 'Arial', color: C.white },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 }
      },
      {
        id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 24, bold: true, font: 'Arial', color: C.darkBlue },
        paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 1 }
      },
      {
        id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, bold: true, font: 'Arial', color: C.darkBlue },
        paragraph: { spacing: { before: 220, after: 100 }, outlineLevel: 2 }
      },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 }
      }
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: 'EVALUACIÓN DE IMPACTO A LA PRIVACIDAD — HUMAN SYSTEM', bold: true, size: 16, color: C.darkBlue, font: 'Arial' }),
              new TextRun({ text: '    |    Human Identification Technologies S.A. de C.V.    |    CONFIDENCIAL', size: 16, color: C.darkGray, font: 'Arial' }),
            ],
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.cyan, space: 1 } },
            spacing: { before: 0, after: 100 },
          })
        ]
      })
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: '© 2025 Human Identification Technologies S.A. de C.V. — Documento Confidencial — Página ', size: 16, color: C.darkGray, font: 'Arial' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, color: C.darkBlue, font: 'Arial' }),
              new TextRun({ text: ' de ', size: 16, color: C.darkGray, font: 'Arial' }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: C.darkBlue, font: 'Arial' }),
            ],
            alignment: AlignmentType.CENTER,
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.cyan, space: 1 } },
          })
        ]
      })
    },
    children: [
      ...coverPage,
      ...session1,
      ...session2,
      ...session3,
      ...session4,
      ...session5,
      ...compTable,
      ...conclusions,
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('./EIP_HumanSystem_2025.docx', buffer);
  console.log('✅ EIP generada exitosamente');
}).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});