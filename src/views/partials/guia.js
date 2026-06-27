const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageBreak
} = require('docx');
const fs = require('fs');

const GREEN = "1B6B3A";
const GREEN_LIGHT = "D1F0DF";
const GREEN_DARK = "0F5C2E";
const RED_LIGHT = "FCE8E8";
const RED_DARK = "8B1A1A";
const BLUE_LIGHT = "E3F0FC";
const BLUE_DARK = "0D4D8B";
const ORANGE_LIGHT = "FEF3E2";
const ORANGE_DARK = "7A4800";
const YELLOW_LIGHT = "FFF8E1";
const YELLOW_DARK = "7A4800";
const GRAY_LIGHT = "F5F5F5";
const GRAY_MID = "CCCCCC";
const WHITE = "FFFFFF";

const border = { style: BorderStyle.SINGLE, size: 1, color: GRAY_MID };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, font: "Arial", size: 32, bold: true, color: WHITE })],
    shading: { fill: GREEN, type: ShadingType.CLEAR },
    spacing: { before: 320, after: 160 },
    indent: { left: 200, right: 200 }
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, font: "Arial", size: 26, bold: true, color: GREEN_DARK })],
    spacing: { before: 240, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: GREEN_LIGHT } }
  });
}

function h3(text, color) {
  return new Paragraph({
    children: [new TextRun({ text, font: "Arial", size: 22, bold: true, color: color || GREEN })],
    spacing: { before: 180, after: 80 }
  });
}

function body(text, bold_parts) {
  if (!bold_parts) {
    return new Paragraph({
      children: [new TextRun({ text, font: "Arial", size: 20 })],
      spacing: { before: 40, after: 40 }
    });
  }
  return new Paragraph({
    children: bold_parts,
    spacing: { before: 40, after: 40 }
  });
}

function bullet(text, level) {
  return new Paragraph({
    numbering: { reference: "bullets", level: level || 0 },
    children: [new TextRun({ text, font: "Arial", size: 20 })],
    spacing: { before: 30, after: 30 }
  });
}

function bulletBold(before, bold, after, level) {
  return new Paragraph({
    numbering: { reference: "bullets", level: level || 0 },
    children: [
      new TextRun({ text: before || "", font: "Arial", size: 20 }),
      new TextRun({ text: bold || "", font: "Arial", size: 20, bold: true }),
      new TextRun({ text: after || "", font: "Arial", size: 20 })
    ],
    spacing: { before: 30, after: 30 }
  });
}

function step(n, text, bold_word) {
  const runs = [];
  if (bold_word) {
    const idx = text.indexOf(bold_word);
    if (idx >= 0) {
      runs.push(new TextRun({ text: `${n}. ` + text.substring(0, idx), font: "Arial", size: 20 }));
      runs.push(new TextRun({ text: bold_word, font: "Arial", size: 20, bold: true }));
      runs.push(new TextRun({ text: text.substring(idx + bold_word.length), font: "Arial", size: 20 }));
    } else {
      runs.push(new TextRun({ text: `${n}. ${text}`, font: "Arial", size: 20 }));
    }
  } else {
    runs.push(new TextRun({ text: `${n}. ${text}`, font: "Arial", size: 20 }));
  }
  return new Paragraph({ children: runs, spacing: { before: 40, after: 40 }, indent: { left: 200 } });
}

function nota(label, text, bgColor, labelColor) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: { top: border, bottom: border, left: { style: BorderStyle.SINGLE, size: 12, color: labelColor || GREEN }, right: border },
            shading: { fill: bgColor || GREEN_LIGHT, type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 160, right: 120 },
            children: [
              new Paragraph({ children: [new TextRun({ text: label, font: "Arial", size: 18, bold: true, color: labelColor || GREEN_DARK })], spacing: { after: 40 } }),
              new Paragraph({ children: [new TextRun({ text, font: "Arial", size: 20 })], spacing: { before: 0 } })
            ]
          })
        ]
      })
    ],
    margins: { top: 80, bottom: 80 }
  });
}

function spacer(before) {
  return new Paragraph({ children: [new TextRun("")], spacing: { before: before || 80, after: 0 } });
}

function tableSimple(headers, rows, colWidths) {
  const totalWidth = 9360;
  const cw = colWidths || headers.map(() => Math.floor(totalWidth / headers.length));
  const headerRow = new TableRow({
    children: headers.map((h, i) => new TableCell({
      borders,
      width: { size: cw[i], type: WidthType.DXA },
      shading: { fill: GREEN, type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text: h, font: "Arial", size: 18, bold: true, color: WHITE })] })]
    }))
  });
  const dataRows = rows.map(row => new TableRow({
    children: row.map((cell, i) => new TableCell({
      borders,
      width: { size: cw[i], type: WidthType.DXA },
      shading: { fill: GRAY_LIGHT, type: ShadingType.CLEAR },
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text: cell, font: "Arial", size: 18 })] })]
    }))
  }));
  return new Table({ width: { size: totalWidth, type: WidthType.DXA }, columnWidths: cw, rows: [headerRow, ...dataRows] });
}

function kpiTable(items) {
  const rows = [];
  for (let i = 0; i < items.length; i += 2) {
    const pair = items.slice(i, i + 2);
    rows.push(new TableRow({
      children: pair.map(item => new TableCell({
        borders,
        width: { size: 4680, type: WidthType.DXA },
        shading: { fill: GRAY_LIGHT, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 160, right: 120 },
        children: [
          new Paragraph({ children: [new TextRun({ text: item.name, font: "Arial", size: 18, bold: true })] }),
          new Paragraph({ children: [new TextRun({ text: item.value, font: "Arial", size: 32, bold: true, color: GREEN })] }),
          new Paragraph({ children: [new TextRun({ text: item.desc || "", font: "Arial", size: 16, color: "888888" })] })
        ]
      }))
    }));
  }
  return new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [4680, 4680], rows });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
          { level: 1, format: LevelFormat.BULLET, text: "\u2013", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1080, hanging: 360 } } } }
        ]
      },
      {
        reference: "numbers",
        levels: [
          { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } }
        ]
      }
    ]
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 20 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: WHITE },
        paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: GREEN_DARK },
        paragraph: { spacing: { before: 240, after: 100 }, outlineLevel: 1 } }
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1080, bottom: 1440, left: 1080 }
      }
    },
    children: [

      // PORTADA
      new Paragraph({
        alignment: AlignmentType.CENTER,
        shading: { fill: GREEN, type: ShadingType.CLEAR },
        spacing: { before: 480, after: 80 },
        children: [new TextRun({ text: "PAYJOY", font: "Arial", size: 56, bold: true, color: WHITE })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        shading: { fill: GREEN, type: ShadingType.CLEAR },
        spacing: { before: 0, after: 80 },
        children: [new TextRun({ text: "GUIA DE CERTIFICACION CX", font: "Arial", size: 36, bold: true, color: "C5E8D4" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        shading: { fill: GREEN, type: ShadingType.CLEAR },
        spacing: { before: 0, after: 240 },
        children: [new TextRun({ text: "Medios Escritos  |  Customer Support Phone Finance", font: "Arial", size: 22, color: "A0D4B8" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 480 },
        children: [new TextRun({ text: "Todos los temas de ambas presentaciones", font: "Arial", size: 20, color: "888888", italics: true })]
      }),

      pageBreak(),

      // 1. METRICAS KPI
      h1("1. Metricas KPI"),
      spacer(80),
      kpiTable([
        { name: "CSAT (Customer Satisfaction)", value: "90%", desc: "Satisfaccion del cliente tras la interaccion" },
        { name: "QA (Quality Assurance)", value: "90%", desc: "Calidad de procesos y servicio" },
        { name: "CSAT Sent Rate", value: "100%", desc: "Encuesta enviada en todos los tickets" },
        { name: "AHT Inbound", value: "5 min", desc: "Tiempo promedio de manejo en llamadas" }
      ]),
      spacer(80),
      tableSimple(
        ["Metrica", "Objetivo", "Descripcion"],
        [
          ["AHT Chats", "10-13 min", "Tiempo promedio de manejo en chat"],
          ["FRT (First Response Time) Chats", "30 seg", "Primera respuesta al cliente"],
          ["FRT Inbound", "30 seg", "Primera respuesta en llamada"],
          ["CRT (Continuous Reply Time)", "30 seg", "Respuesta continua durante toda la conversacion"]
        ],
        [2800, 1800, 4760]
      ),
      spacer(120),

      // 2. CANALES
      h1("2. Canales de Atencion"),
      spacer(80),
      tableSimple(
        ["Canal", "Detalle"],
        [
          ["WhatsApp (Medios Escritos)", "55 7502 8669 opcion 2"],
          ["Chat In App (Medios Escritos)", "Desde la app PayJoy, seccion de ayuda"],
          ["Correo (Medios Escritos)", "clientes@payjoy.com"],
          ["Llamadas Inbound", "55 5351 8341"]
        ],
        [3500, 5860]
      ),
      spacer(80),
      nota("Horario de atencion", "Lunes a domingo de 8:00 a 22:00 hrs", YELLOW_LIGHT, YELLOW_DARK),
      spacer(120),

      // 3. FILTROS DE SEGURIDAD
      h1("3. Filtros de Seguridad"),
      spacer(80),
      nota(
        "Medios Escritos (WhatsApp / Chat In App)",
        "El bot realiza el filtro automaticamente. El agente SOLO confirma el nombre del titular aseverandolo: \"Senor/Senorita (Nombre) en que le puedo apoyar\".",
        GREEN_LIGHT, GREEN_DARK
      ),
      spacer(80),
      h3("Inbound / Llamadas — Siempre validar con:"),
      bullet("Orden financiera"),
      bullet("Nombre del titular"),
      bullet("Device TAG"),
      bullet("CURP"),
      bullet("IMEI"),
      bullet("Numero registrado"),
      spacer(80),
      nota("Terceros", "Si no es el titular de la cuenta, solo se puede proporcionar: codigo de pago, informacion de donde pagar, canalizacion a cobranza y requisitos de cierre por fallecimiento.", RED_LIGHT, RED_DARK),
      nota("NOTA CLAVE", "Siempre dejar NOTA en Dashboard Y en Talkdesk/Zendesk en cada interaccion.", YELLOW_LIGHT, YELLOW_DARK),
      spacer(120),

      // 4. NOTA INTERNA
      h1("4. Estructura de Nota Interna"),
      spacer(80),
      tableSimple(
        ["Medios Escritos", "Inbound"],
        [
          ["WA PF / Chat PF", "Nombre del titular"],
          ["No. de ticket", "Tag"],
          ["Tag", "OF (Orden Financiera)"],
          ["Tipificacion", "Numero de donde llama el cliente"],
          ["Solicitud del cliente", "Tipificacion"],
          ["Acciones realizadas", "Call ID"],
          ["", "Solicitud del cliente"],
          ["", "Acciones realizadas"]
        ],
        [4680, 4680]
      ),
      spacer(80),
      nota("Importante — Call ID", "En cada llamada (inbound) se genera un Call ID que DEBE registrarse en la nota de Dashboard Y en Talkdesk.", YELLOW_LIGHT, YELLOW_DARK),
      spacer(120),

      pageBreak(),

      // 5. DASHBOARD
      h1("5. Dashboard"),
      spacer(80),
      h3("Busqueda de perfiles — se puede buscar por:"),
      new Paragraph({
        children: [
          new TextRun({ text: "Device TAG  |  Nombre completo  |  OF / No. de Contrato  |  Correo registrado  |  IMEI  |  Telefono  |  CURP", font: "Arial", size: 20, color: "555555" })
        ],
        spacing: { before: 40, after: 80 }
      }),
      spacer(80),
      h3("Estados del dispositivo — en NEGRO (sin bloqueo)"),
      tableSimple(
        ["Estado", "Significado"],
        [
          ["Ready for activation", "Equipo en proceso de instalacion (paso 4 de la venta)"],
          ["Secured", "Asegurado por la app PayJoy — sin bloqueo aparente"],
          ["Fully Unlocked", "Totalmente pagado — listo para remover el candado de la app"],
          ["Not Secured", "Totalmente pagado — listo para remover el candado de la app"],
          ["Removable", "Totalmente pagado — listo para eliminar la aplicacion PayJoy"]
        ],
        [2800, 6560]
      ),
      spacer(80),
      h3("Estados en ROJO (bloqueo activo)", RED_DARK),
      tableSimple(
        ["Estado", "Causa del bloqueo"],
        [
          ["Credit Exhausted", "Bloqueo por falta de pago"],
          ["Required phone mismatch", "Bloqueo por cambio de numero telefonico"],
          ["Required SIM mismatch", "Bloqueo por cambio de SIM"],
          ["No SIM in device", "Bloqueo por falta de SIM"]
        ],
        [3500, 5860]
      ),
      spacer(120),

      // 6. ZENDESK
      h1("6. Zendesk"),
      spacer(80),
      h2("Autenticacion Customer"),
      step(1, "Verificar 'customer type': si aparece como 'PayJoy m3' → NO es necesario autenticar, continuar con la interaccion."),
      step(2, "Si aparece 'Not Authenticated' → ingresar datos del cliente: fecha de nacimiento + numero de ID (CURP, Cedula, DNI o CPF)."),
      step(3, "Enviar el ticket en estatus ABIERTO y verificar si trajo informacion."),
      step(4, "En cualquier caso, continuar la interaccion con el cliente."),
      spacer(80),
      h2("Autenticacion Clerk — Venta"),
      body("Si customer type = 'PayJoy m3' → no autenticar. Si dice 'Not Authenticated':"),
      bulletBold("Ingresar ", "Clerk tag: KRXRDBTW", " o Cartag: CWQNPXXB"),
      bullet("Verificar si el proceso trajo informacion y continuar con el soporte."),
      spacer(80),
      h2("Autenticacion Clerk — Posventa"),
      step(1, "Identificar que es una solicitud posventa → seleccionar la casilla 'postsale-request'."),
      step(2, "Cambiar el 'customer type' a 'not authenticated'."),
      step(3, "Ingresar la informacion del clerk o cliente segun los datos que falten → enviar ticket como ABIERTO."),
      step(4, "Verificar si trajo informacion y continuar con el soporte."),
      spacer(80),
      h2("Macros y Disposiciones"),
      bullet("Buscar macro por palabra clave (ej: 'pago' → despliega: Link de pago, Pago no reflejado, Sin opciones de pago)."),
      bullet("Las macros cambian segun el area asignada al agente y ayudan a optimizar el AHT."),
      bullet("Las disposiciones registran el motivo de contacto. Siempre elegir la razon correcta."),
      bulletBold("Algunas disposiciones piden info adicional: ", "codigo de error o proveedor de pago", ". Si no se llena = penalizacion en QA."),
      spacer(80),
      h2("CSAT en Zendesk"),
      nota(
        "Proceso para enviar la encuesta (Medios Escritos)",
        "1. Aplicar macro /Salida\n2. Cambiar el estatus del ticket a PENDIENTE\n-> La encuesta se envia automaticamente. Obligatorio en TODOS los tickets.",
        GREEN_LIGHT, GREEN_DARK
      ),
      spacer(80),
      h3("Escenarios CSAT (Phone Finance)"),
      tableSimple(
        ["Escenario", "Accion", "Tiempo limite"],
        [
          ["1.1 — Con disposicion del BOT, cliente no responde ni la apertura", "Dejar disposicion del BOT + marcar 'sin interaccion' → enviar como PENDIENTE", "Menos de 30 seg"],
          ["1.2 — Con disposicion del BOT, se quedo a la mitad (no resolvio)", "Dejar disposicion correspondiente + marcar 'sin interaccion' → PENDIENTE", "3 minutos"],
          ["2 — Sin disposicion del BOT, se quedo a la mitad (no resolvio)", "Poner disposicion correspondiente + sin interaccion → PENDIENTE", "3 minutos"],
          ["3 — Sin disposicion del BOT, cliente no responde ni la apertura", "Disposicion: 'Sin interaccion inicial del solicitante' → PENDIENTE", "Menos de 30 seg"]
        ],
        [3200, 3960, 2200]
      ),
      spacer(120),

      pageBreak(),

      // 7. FORMAS DE PAGO
      h1("7. Formas de Pago y Cobranza"),
      spacer(80),
      h2("Metodos de pago disponibles"),
      new Paragraph({
        children: [new TextRun({ text: "Cash In Store: OXXO  |  CoDi  |  PayNet  |  Six  |  Transferencia bancaria (cualquier banco)", font: "Arial", size: 20, color: "555555" })],
        spacing: { before: 40, after: 40 }
      }),
      body("*Algunos codigos de pago tienen vigencia."),
      spacer(80),
      h2("Canalizar a Cobranza"),
      nota(
        "Regla principal",
        "Si el cliente tiene MAS DE 5 DIAS DE ATRASO y nos contacta en horario laboral de cobranza → NO dar codigo de pago → canalizar a collections.",
        RED_LIGHT, RED_DARK
      ),
      spacer(80),
      bulletBold("L-V despues de las 6pm, sabados y domingos: ", "hasta 30 dias de atraso", " → si se puede dar codigo. Si el atraso es mayor → seguir proceso de cobranza."),
      bulletBold("Si el cliente quiere ", "liquidar el total de la deuda", " → SIEMPRE canalizar a collections."),
      bulletBold("Numero de cobranza: ", "5541646829 opcion 1", " — L-V de 9am a 6pm (sabados y domingos no hay servicio)."),
      spacer(80),
      nota("Tipificacion", "Si se canalizo a cobranza → tipificar como 'Informacion de servicio'.\nSi se pudo dar el codigo → tipificar como 'Codigo de pago'.", YELLOW_LIGHT, YELLOW_DARK),
      spacer(120),

      // 8. PAGO NO REFLEJADO
      h1("8. Pago No Reflejado"),
      spacer(80),
      tableSimple(
        ["Tiempo del pago", "Accion"],
        [
          ["Menos de 1 hora", "Dar tiempo de espera. L1 rastrea el pago en Banxico."],
          ["Mas de 1 hora", "Abrir Side Conversation a L2. Si el equipo esta bloqueado, L2 puede ofrecer extension."]
        ],
        [2800, 6560]
      ),
      spacer(80),
      h3("Datos a solicitar segun metodo de pago"),
      tableSimple(
        ["CODI", "OXXO / Open Pay", "SPEI / Transferencia"],
        [
          ["Fecha del pago", "Fecha del pago", "Fecha del pago"],
          ["Clave de rastreo / referencia", "Fecha en que se genero la referencia", "Clave de rastreo / referencia"],
          ["Monto exacto", "Monto exacto", "Monto exacto"],
          ["Cuenta beneficiaria (en Dashboard)", "Referencia de pago", "Institucion emisora"],
          ["", "", "Cuenta beneficiaria (en Dashboard)"]
        ],
        [3120, 3120, 3120]
      ),
      spacer(80),
      h3("Roles"),
      bulletBold("L1: ", "Verifica datos en Dashboard,", " solicita informacion al cliente y escala via Side Conversation."),
      bulletBold("L2: ", "Busca en plataformas:", " CODI → CEP Banxico; SPEI → Dashboard STP o CEP; OXXO → Portal SPIN negocios y MODE."),
      bulletBold("L3: ", "Ejecuta y aplica", " el pago en el sistema."),
      spacer(80),
      nota("Disposicion", "07 Relacionado con pagos → 09 Pago no reflejado → No reflejado inmediatamente.\n*Siempre seleccionar el metodo de pago del cliente.", GREEN_LIGHT, GREEN_DARK),
      spacer(80),
      h3("Pago Incorrecto"),
      bullet("Disposicion: 07 Relacionado a pagos → 11 Pago no reflejado → Pago Incorrecto"),
      bulletBold("CODI/SPEI: ", "Orientar a validar con la institucion y volver a pagar correctamente."),
      bulletBold("OXXO/Open Pay: ", "Orientar a validar directamente en el establecimiento."),
      spacer(80),
      h3("Incidencia Masiva (10-15+ reportes continuos)"),
      bullet("Notificar al supervisor con: numero de casos recibidos y tickets en bandeja."),
      bullet("L2 otorga extension con razon: 'Caida del procesador de pagos'."),
      nota("Disposicion incidencia", "07 Relacionado a pagos → 21 Pago no reflejado → Incidente de pago.", YELLOW_LIGHT, YELLOW_DARK),
      spacer(120),

      pageBreak(),

      // 9. EXTENSION DE PAGO
      h1("9. Extension de Pago"),
      spacer(80),
      body("Beneficio que permite al cliente solicitar dias adicionales para completar su pago y evitar la suspension del servicio."),
      spacer(80),
      h3("Requisitos"),
      bullet("El dispositivo necesita tener acceso a internet."),
      bullet("No se conceden extensiones a clientes identificados como fraude."),
      spacer(80),
      h3("Tiempos de reflexion por metodo"),
      tableSimple(
        ["Metodo", "Tiempo para reflejar", "Accion si no se refleja"],
        [
          ["CODI", "Hasta 4 horas", "Mas de 4hrs → Side Conversation a L2"],
          ["OXXO / Open Pay", "Hasta 4 horas", "Mas de 4hrs → Side Conversation a L2"],
          ["SPEI / Transferencia", "Hasta 4 horas", "Mas de 4hrs → Side Conversation a L2"]
        ],
        [2800, 2500, 4060]
      ),
      spacer(80),
      nota(
        "Importante",
        "Solo aplica si el equipo esta bloqueado y el cliente NO tiene extensiones previas.\nRegistrar la extension en Dashboard con nota: numero de ticket + motivo de la consulta.",
        YELLOW_LIGHT, YELLOW_DARK
      ),
      spacer(120),

      // 10. CAMBIO DE SIM
      h1("10. Cambio de SIM / Numero"),
      spacer(80),
      h3("Bloqueos que activa PayJoy"),
      tableSimple(
        ["Estado (rojo)", "Causa"],
        [
          ["Required phone mismatch", "Bloqueo por cambio de numero telefonico"],
          ["Required SIM mismatch", "Bloqueo por cambio de SIM"],
          ["No SIM in device", "Bloqueo por falta de SIM"]
        ],
        [4000, 5360]
      ),
      spacer(80),
      h3("Proceso"),
      step(1, "Verificar que la nueva SIM este dentro del equipo y que cuente con conexion a WiFi o datos moviles."),
      step(2, "Solicitar al cliente los datos. Agregar nota en Dashboard con el simbolo |:"),
      body("   Numero que se va a utilizar: 📞|XXXXXXXXXX"),
      body("   Numero adicional de contacto: ☎|XXXXXXXXXX"),
      step(3, "Realizar el cambio de SIM / Numero en Dashboard → seccion Manage Device."),
      spacer(80),
      nota("Honor Dual SIM", "Si no se logra el cambio de SIM → indicar al cliente que coloque 2 SIM en el equipo y llame nuevamente. En 2da llamada no hace filtro.", BLUE_LIGHT, BLUE_DARK),
      nota("Tipificacion", "Basarse en la nota que genere el sistema. Si aparece la palabra NULL → es un bloqueo OCULTO.", YELLOW_LIGHT, YELLOW_DARK),
      spacer(120),

      pageBreak(),

      // 11. FULLY PAID
      h1("11. Fully Paid y Fully de Riesgo"),
      spacer(80),
      h2("Fully Paid"),
      body("El financiamiento esta totalmente pagado y se pueden dar al cliente los pasos para eliminar la app PayJoy."),
      spacer(80),
      tableSimple(
        ["Canal", "Filtro de seguridad requerido"],
        [
          ["Medios Escritos", "CURP del cliente"],
          ["Inbound", "Fecha de nacimiento"]
        ],
        [4680, 4680]
      ),
      spacer(80),
      h2("Fully de Riesgo"),
      body("Es cuando el cliente realizo un pago en tienda (CashInStore) que rebasa el 50% del valor total del equipo."),
      bulletBold("Solo aplica para ", "pagos en tienda directamente con el socio.", " NO aplican tiendas de conveniencia."),
      bulletBold("Si el perfil ya es REMOVABLE: ", "solo dar pasos para remover la app", " pero tipificar igualmente como Fully de Riesgo."),
      nota("Excepcion Walmart / Bodega Aurrera", "Si el cliente cambio de domicilio, la tienda cerro o no le ayudaron, se puede gestionar el proceso de Fully de Riesgo.", BLUE_LIGHT, BLUE_DARK),
      spacer(120),

      // 12. CANCELACION
      h1("12. Cancelacion, Devolucion y Defuncion"),
      spacer(80),
      h2("Cancelacion General"),
      h3("Condiciones"),
      bullet("La venta no tiene mas de 15 dias naturales de realizada."),
      bullet("El cliente no ha realizado algun pago (ademas del enganche)."),
      bullet("No importa si tiene Credit Exhausted — puede cancelar igual."),
      bullet("Si la tienda ya rechazo la cancelacion: NO mandar de nuevo a tienda → ofrecer politica de devolucion."),
      nota("NO aplica en", "Bodega Aurrera / Walmart / Chedraui / Soriana — en estas tiendas NO hay cancelaciones.", RED_LIGHT, RED_DARK),
      h3("Proceso"),
      step(1, "Siempre persuadir al cliente para que continue con el financiamiento."),
      step(2, "Dirigir al cliente a la tienda donde adquirio el financiamiento."),
      step(3, "La cancelacion esta sujeta a la aprobacion del gerente o autorizado de la tienda."),
      step(4, "El socio acepta equipo devuelto en optimas condiciones y realiza devolucion del enganche."),
      spacer(80),
      h2("Cancelacion Movistar"),
      h3("Requisitos"),
      bullet("Dentro de los primeros 5 dias habiles despues de la compra."),
      bullet("Sin ningun pago semanal realizado."),
      bullet("Equipo con accesorios, caja original, sin fallas y estetica al 100%."),
      h3("Proceso"),
      step(1, "Verificar motivo y validar que cumple los requisitos."),
      step(2, "Solicitar al cliente enviar a clientes@payjoy.com: Nombre del titular, foto del INE, 6 fotografias del equipo con app PayJoy abierta (mostrando los 6 lados)."),
      step(3, "Agente L2 realiza filtro de seguridad y asigna el ticket en #staymobileissues."),
      step(4, "Equipo de garantias valida y, si aprueba, envia la carta de cancelacion de Movistar."),
      spacer(80),
      tableSimple(
        ["Tipo de ticket", "Tipificacion"],
        [
          ["Una vez iniciado el proceso vía email", "Sale Cancellation - Anulacion de venta"],
          ["Tickets de chat", "Financing Information - Consulta anulacion de contrato"]
        ],
        [4000, 5360]
      ),
      spacer(80),
      h2("Politica de Devolucion"),
      h3("Condiciones"),
      bullet("Cliente regresa el equipo a las oficinas PayJoy."),
      bullet("Equipo con accesorios, caja original, sin fallas y estetica al 100%."),
      bullet("NO reembolsa el enganche ni los pagos realizados."),
      bullet("El cliente PIERDE posibilidad de volver a adquirir producto PayJoy (PF, CL)."),
      bullet("Aplica para cualquier tienda."),
      h3("Proceso"),
      step(1, "Verificar motivo y notificar al cliente sobre las implicaciones."),
      step(2, "Solicitar envio a clientes@payjoy.com: nombre, foto INE, 6 fotos del equipo con app abierta (6 lados)."),
      step(3, "Agente L2 valida identidad y asigna en #staymobileissues."),
      step(4, "Equipo de garantias completa el proceso de devolucion."),
      spacer(80),
      nota("Macro y disposicion", "Macro en Zendesk: /Politica devolucion\nDisposicion: Politica de devolucion", GREEN_LIGHT, GREEN_DARK),
      spacer(80),
      h2("Cierre de Contrato por Defuncion"),
      bulletBold("Solicitar ", "Acta de Defuncion", " (NO el Certificado de Defuncion) por ambos lados + INE del familiar directo que reporta."),
      bulletBold("Sin Acta de Defuncion: ", "enviar CURP", " — no es necesario hacer ningun pago."),
      bullet("Correo: clientes@payjoy.com"),
      nota("Disposicion", "Financing Information — Fallecimiento del titular", GREEN_LIGHT, GREEN_DARK),
      spacer(120),

      pageBreak(),

      // 13. GARANTIA
      h1("13. Garantia y Plan de Reparacion"),
      spacer(80),
      h2("Garantia"),
      h3("Requisitos y condiciones"),
      bullet("Solo cubre defectos de fabrica o problemas de software."),
      bullet("Si el cliente tiene atraso, puede acceder a garantia igualmente."),
      bullet("Debe seguir efectuando sus pagos durante todo el proceso de garantia."),
      bullet("La cuenta no debe tener notas de fraude."),
      bulletBold("Invalida la garantia: ", "dano fisico, manipulacion de software, bloqueo por patron o contrasena."),
      spacer(80),
      h3("Escenarios"),
      tableSimple(
        ["Caso", "Proceso"],
        [
          ["Equipo adquirido en socio PayJoy (al corriente)", "Dirigir a la tienda donde compro con caja y accesorios originales. La tienda inicia la garantia con el proveedor."],
          ["Equipo adquirido en Grupo Walmart", "PayJoy gestiona la garantia via talleres autorizados. Pedir datos del cliente, descripcion de falla, telefono y correo. L1 sube al canal delta-garantias en Slack."]
        ],
        [3000, 6360]
      ),
      spacer(80),
      h2("Plan de Reparacion"),
      nota(
        "Beneficio",
        "PayJoy cubre el 50% del costo de la reparacion, siempre que no exceda el 25% del costo total del equipo.\nEjemplo: equipo de $5,000 → PayJoy cubre hasta $1,250 de la reparacion.",
        GREEN_LIGHT, GREEN_DARK
      ),
      spacer(80),
      h3("Condiciones"),
      bullet("Cliente debe ser persona fisica (PF)."),
      bullet("Contrato activo y dentro del plazo de financiamiento."),
      bullet("Debe estar al corriente en sus pagos."),
      bullet("Solo para dispositivos adquiridos mediante financiamiento PayJoy."),
      bullet("Cubre danos por uso normal y cotidiano (no accidentes ni maltrato)."),
      bullet("Solo puede utilizarse UNA VEZ por financiamiento."),
      bullet("Si ya supero el plazo pero debe MAS DE $1,000 MXN → puede aplicar el plan."),
      spacer(80),
      h3("Proceso"),
      step(1, "Verificar con codigo postal si hay un taller autorizado cercano."),
      step(2, "Si hay taller: pedir datos completos (titular, TAG, OF, numero, descripcion falla, correo, IMEI, fecha que acudira, taller) → subir a delta-garantias en Slack o Side Conversation."),
      step(3, "Si NO hay taller: pedir datos (titular, TAG, OF, numero, descripcion falla, correo) → Slack 'support PF' (inbound) o Side Conversation (medios escritos)."),
      spacer(80),
      nota("Consideraciones", "Sin costo de envio.\nSi no acepta la reparacion se cobra el diagnostico y la guia.\nLa guia llega en 24 hrs habiles (FedEx o DHL). Reparacion: 3 a 5 dias habiles.", YELLOW_LIGHT, YELLOW_DARK),
      spacer(120),

      pageBreak(),

      // 14. BLOQUEOS
      h1("14. Bloqueos"),
      spacer(80),
      h2("Bloqueo Preventivo — Robo / Extravio"),
      h3("Conditions"),
      bullet("Aplica sin importar si el cliente esta o no al corriente en sus pagos."),
      bullet("El bloqueo que se realiza es PREVENTIVO."),
      bulletBold("Recomendar tambien el ", "bloqueo por IMEI con la compania telefonica", " ya que PayJoy no garantiza que la persona que lo tenga no acceda a la informacion."),
      h3("Proceso"),
      nota(
        "Medios Escritos",
        "Agregar nota en el perfil del cliente con: folio de solicitud + 'Bloqueo por robo'.\nSolicitar el bloqueo via Side Conversation a L2.",
        GREEN_LIGHT, GREEN_DARK
      ),
      spacer(80),
      h2("Retiro de Bloqueo Preventivo"),
      bullet("El cliente debe estar AL CORRIENTE en sus pagos."),
      bullet("No debe tener notas de fraude en el perfil."),
      nota(
        "Medios Escritos",
        "Agregar nota: folio de solicitud + 'Desbloqueo por Robo'.\nSolicitar apoyo via Side Conversation a L2.\nNotificar al cliente cuando el equipo ha sido desbloqueado (verificar conexion a internet).",
        GREEN_LIGHT, GREEN_DARK
      ),
      spacer(80),
      h2("Bloqueo de Internet"),
      body("La app PayJoy necesita permisos de administrador del dispositivo + conexion a internet constante."),
      h3("Pasos para forzar la conexion"),
      bullet("Validar WiFi: cargar un video de YouTube para confirmar."),
      bullet("Validar datos moviles: asegurarse de contar con saldo."),
      bullet("Verificar que la fecha y hora esten configuradas como automaticas (de internet)."),
      bullet("Verificar que PayJoy sea el UNICO administrador del dispositivo."),
      bulletBold("Si nada funciona: ", "solicitar foto o video de evidencia", " por WhatsApp o correo clientes@payjoy.com con datos del cliente, equipo y tipo de bloqueo."),
      spacer(80),
      h2("Bloqueo por Patron / Contrasena"),
      body("PayJoy no es responsable — estas configuraciones son del cliente. El bloqueo desactiva funciones incluyendo el internet."),
      tableSimple(
        ["Tipo de instalacion", "Proceso"],
        [
          ["IMEI Guard", "Dirigir a tienda para reset de fabrica + eliminar el patron. La app PayJoy se reinstala automaticamente al conectar a internet."],
          ["KNOX HACK / desconexion < 24 hrs", "Mandar a tienda para reset de fabrica. (Excepcion: Walmart / Bodega Aurrera → no aplica tienda)"],
          ["KNOX HACK / desconexion > 24 hrs", "Aplicar plan de reparacion."],
          ["KNOX HACK / sin conexion a internet", "Si la app no logra conectar → plan de reparacion (reemplazo de tarjeta logica)."]
        ],
        [3000, 6360]
      ),
      spacer(80),
      h2("Bloqueo IMEI"),
      body("El equipo interno de fraude bloquea equipos sospechosos. El equipo deja de detectar tarjetas SIM."),
      step(1, "El cliente reporta que su equipo no lee ninguna SIM."),
      step(2, "Buscar el IMEI en la herramienta de bloqueo. Si aparece informacion del equipo → esta bloqueado por IMEI."),
      step(3, "Iniciar proceso de desbloqueo. El cliente DEBE ESTAR AL DIA en sus pagos."),
      spacer(80),
      h2("Equipos KnoxGuard — Samsung"),
      bullet("Insertar una SIM con datos activos en el equipo."),
      bullet("Verificar que el equipo no tenga bloqueo por falta de pago."),
      bullet("Se pueden dar 4 horas de extension de pago."),
      bulletBold("Si nada funciona: ", "dirigir al cliente a correo clientes@payjoy.com"),
      spacer(120),

      pageBreak(),

      // 15. CARTA NO ADEUDO
      h1("15. Carta de No Adeudo / Contrato / Factura"),
      spacer(80),
      h2("Carta de No Adeudo"),
      body("Cuando otras financieras o instituciones solicitan evidencia de que el cliente ya no tiene adeudo con PayJoy."),
      h3("Consideraciones previas"),
      bulletBold("Fully de riesgo: ", "seguir primero el proceso de retiro para Fully de riesgo."),
      bulletBold("Reporte por robo: ", "se puede enviar la carta SIN retirar el bloqueo por robo."),
      bulletBold("Marca de fraude: ", "validar con el equipo de Fraude el envio de la carta."),
      spacer(80),
      nota(
        "Proceso — Medios Escritos",
        "Llenar el formulario Google con el correo del cliente.\nPlazo de envio: 24 a 72 horas habiles.",
        GREEN_LIGHT, GREEN_DARK
      ),
      spacer(80),
      h2("Contrato"),
      body("El cliente puede verlo directamente desde la app. Si solicita que se lo envien por correo:"),
      nota(
        "Proceso",
        "Llenar el formulario Google con el correo del cliente.\nIndicar al cliente el tiempo de espera para el envio del contrato.",
        BLUE_LIGHT, BLUE_DARK
      ),
      spacer(80),
      h2("Factura"),
      nota("Primera respuesta SIEMPRE", "Ofrecer primero la Carta de No Adeudo — viene a nombre del cliente y sirve para comprobar que es propietario al 100% del equipo.", YELLOW_LIGHT, YELLOW_DARK),
      spacer(80),
      h3("Tipos de factura"),
      tableSimple(
        ["Tipo", "Proceso"],
        [
          ["Factura original del telefono", "Solicitar en la tienda donde compro el equipo. Viene a nombre de PayJoy y NO puede modificarse."],
          ["Factura fiscal (para deducir impuestos)", "Todos los pagos concluidos en el mismo ano fiscal → cliente envia cedula fiscal (no mayor a 3 meses) a clientes@payjoy.com. Plazo: 10 a 15 dias habiles."]
        ],
        [3000, 6360]
      ),
      spacer(120),

      // 16. FRAUDE
      h1("16. Fraude y Segundo Comprador"),
      spacer(80),
      h2("Robo de Identidad"),
      body("The titular se comunica porque no reconoce el financiamiento activo a su nombre."),
      step(1, "Desaprobar el perfil en la seccion 'ID Verification' → marcar como 'Identificacion, sospecha de fraude'."),
      step(2, "Solicitar evidencia: cotizaciones en linea donde pudo haber dado sus datos, etc."),
      step(3, "Indicar al cliente que envie a clientes@payjoy.com: nombre completo, numero de contacto, correo electronico, foto del INE (parte frontal) y resumen de lo sucedido."),
      step(4, "Tiempo de resolucion: hasta 15 dias habiles."),
      spacer(80),
      h2("Segundo Comprador"),
      body("El titular vendio el equipo sin liquidar y el comprador se comunica porque el equipo esta bloqueado."),
      step(1, "Escuchar con atencion y hacer preguntas clave: que paso, quien vendio, donde lo compro, por cuanto."),
      step(2, "Dejar nota detallada en el perfil con el nombre y numero de contacto del segundo comprador."),
      step(3, "Informar que el financiamiento NO ES TRANSFERIBLE bajo ningun concepto."),
      step(4, "El reporte a Buro de Credito seguira siendo para el titular original, no para el segundo comprador."),
      step(5, "Solicitar que el segundo comprador intente contactar al titular para que liquide el adeudo."),
      spacer(120),

      // 17. TALKDESK
      h1("17. Talkdesk (Referencia Inbound)"),
      spacer(80),
      h2("Auxiliares de estado"),
      tableSimple(
        ["Estado", "Color", "Uso"],
        [
          ["Available", "Verde", "Disponible para recibir llamadas"],
          ["Seg promesa", "Rojo", "Seguimiento de promesa de pago"],
          ["Away / Bathroom", "Naranja", "Ausencia breve / bano"],
          ["Lunch", "Naranja", "Hora de comida"],
          ["Coaching", "Naranja", "Sesion de coaching"],
          ["Tea Break (15 min)", "Naranja", "Descanso"],
          ["Escalation", "Rojo", "En proceso de escalacion"],
          ["Offline", "Gris", "Fuera de linea"]
        ],
        [2800, 1500, 5060]
      ),
      spacer(80),
      h2("Autenticacion Manual en Talkdesk"),
      h3("Datos a capturar (tab Cards)"),
      bullet("National ID — CURP del cliente"),
      bullet("Date of Birth — DD.MM.AAAA (ej: 02.02.1993)"),
      bullet("Phone Number — numero telefonico registrado"),
      spacer(80),
      nota(
        "Si el numero no coincide",
        "Preguntar al cliente si desea mantener el numero desde el que llama para futuras interacciones.\nActualizar el numero en Dashboard si el cliente confirma que quiere cambiarlo.",
        YELLOW_LIGHT, YELLOW_DARK
      ),
      spacer(80),
      h3("Confirmar autenticacion exitosa"),
      bullet("En la tab Cards debe aparecer: 'Authenticated' / 'Autenticado correctamente'."),
      bulletBold("Para modificar datos despues de autenticar: ", "presionar el boton REFRESH."),
      bulletBold("Si la autenticacion no es exitosa: ", "intentarlo una vez mas y continuar con la interaccion de todos modos."),
      spacer(80),
      nota("Verificar campo contexto", "Antes de iniciar soporte, verificar el campo contexto apartado identity para saber si el cliente esta identificado o no (Customer not Identified vs Customer Identified).", BLUE_LIGHT, BLUE_DARK),
      spacer(200),

      // CIERRE
      new Paragraph({
        alignment: AlignmentType.CENTER,
        shading: { fill: GREEN, type: ShadingType.CLEAR },
        spacing: { before: 240, after: 240 },
        children: [new TextRun({ text: "EXITO EN TU EXAMEN DE CERTIFICACION!", font: "Arial", size: 28, bold: true, color: WHITE })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 80 },
        children: [new TextRun({ text: "Guia generada para certificacion PayJoy CX | Medios Escritos", font: "Arial", size: 18, color: "888888", italics: true })]
      })

    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("./Guia_Certificacion_PayJoy_CX.docx", buffer);
  console.log("Documento creado exitosamente en la carpeta actual.");
});