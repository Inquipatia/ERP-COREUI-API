const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const escapeHTML = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

const firstPresent = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== '') ?? ''

const asObject = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}

const TEMPLATE_PATH = path.resolve(__dirname, '..', 'public', 'templates', 'cotizacion-rubik.xlsx')
const TEMPLATE_LOGO_ENTRY = 'xl/media/image1.png'
let cachedLogoDataUri

const findEndOfCentralDirectory = (buffer) => {
  for (let index = buffer.length - 22; index >= 0; index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) return index
  }

  return -1
}

const readZipEntry = (zipBuffer, entryName) => {
  const eocdOffset = findEndOfCentralDirectory(zipBuffer)
  if (eocdOffset < 0) return null

  const totalEntries = zipBuffer.readUInt16LE(eocdOffset + 10)
  let offset = zipBuffer.readUInt32LE(eocdOffset + 16)

  for (let entryIndex = 0; entryIndex < totalEntries; entryIndex += 1) {
    if (zipBuffer.readUInt32LE(offset) !== 0x02014b50) return null

    const compression = zipBuffer.readUInt16LE(offset + 10)
    const compressedSize = zipBuffer.readUInt32LE(offset + 20)
    const fileNameLength = zipBuffer.readUInt16LE(offset + 28)
    const extraLength = zipBuffer.readUInt16LE(offset + 30)
    const commentLength = zipBuffer.readUInt16LE(offset + 32)
    const localHeaderOffset = zipBuffer.readUInt32LE(offset + 42)
    const fileName = zipBuffer.toString('utf8', offset + 46, offset + 46 + fileNameLength)

    if (fileName === entryName) {
      const localFileNameLength = zipBuffer.readUInt16LE(localHeaderOffset + 26)
      const localExtraLength = zipBuffer.readUInt16LE(localHeaderOffset + 28)
      const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength
      const compressedData = zipBuffer.subarray(dataStart, dataStart + compressedSize)

      if (compression === 0) return Buffer.from(compressedData)
      if (compression === 8) return zlib.inflateRawSync(compressedData)

      return null
    }

    offset += 46 + fileNameLength + extraLength + commentLength
  }

  return null
}

const getEmbeddedLogoDataUri = () => {
  if (cachedLogoDataUri !== undefined) return cachedLogoDataUri

  try {
    const zipBuffer = fs.readFileSync(TEMPLATE_PATH)
    const logoBuffer = readZipEntry(zipBuffer, TEMPLATE_LOGO_ENTRY)

    cachedLogoDataUri = logoBuffer
      ? `data:image/png;base64,${logoBuffer.toString('base64')}`
      : ''
  } catch {
    cachedLogoDataUri = ''
  }

  return cachedLogoDataUri
}

const toNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (value === null || value === undefined || value === '') return 0

  const normalized = String(value)
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.')

  return Number(normalized) || 0
}

const formatCLP = (value) => `$${new Intl.NumberFormat('es-CL', {
  maximumFractionDigits: 0,
}).format(toNumber(value))}`

const formatDate = (value) => {
  if (!value) return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Intl.DateTimeFormat('es-CL').format(value)
  }

  const raw = String(value)
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)

  if (dateOnly) {
    return `${dateOnly[3]}-${dateOnly[2]}-${dateOnly[1]}`
  }

  return raw
}

const getItems = (data, payload) => {
  const quote = asObject(data.quote || data.quoteData || payload.quote || payload.quoteData)
  const candidates = [
    data.items,
    data.quoteItems,
    data.detalles,
    data.productos,
    data.lineas,
    quote.items,
    quote.quoteItems,
    payload.items,
    payload.quoteItems,
  ]

  return candidates.find(Array.isArray) || []
}

const normalizeItem = (item = {}) => {
  const cantidad = toNumber(firstPresent(item.cantidad, item.qty, item.quantity, 0))
  const valorUnitario = toNumber(
    firstPresent(item.valorUnitario, item.precioUnitario, item.unitValue, item.unitPrice, item.price, 0),
  )
  const valorTotal = toNumber(
    firstPresent(item.valorTotal, item.total, item.lineTotal, cantidad * valorUnitario),
  )

  return {
    cantidad,
    descripcion: firstPresent(
      item.descripcion,
      item.description,
      item.technicalDescription,
      item.nombre,
      item.name,
    ),
    valorUnitario,
    valorTotal,
    observaciones: firstPresent(item.observaciones, item.observations, item.notes),
  }
}

const normalizeQuoteData = (data = {}) => {
  const payload = asObject(data.payload)
  const company = asObject(data.company || payload.company)
  const rubikCompany = asObject(data.rubikCompany || payload.rubikCompany)
  const seller = asObject(data.seller || payload.seller)
  const client = asObject(data.client || payload.client)
  const quote = asObject(data.quote || data.quoteData || payload.quote || payload.quoteData)
  const amounts = asObject(data.amounts || payload.amounts)
  const items = getItems(data, payload).map(normalizeItem)
  const computedNeto = items.reduce((sum, item) => sum + item.valorTotal, 0)
  const neto = toNumber(firstPresent(data.neto, data.net, data.montoNeto, amounts.neto, amounts.net)) || computedNeto
  const iva = toNumber(firstPresent(data.iva, amounts.iva, amounts.taxAmount)) || Math.round(neto * 0.19)
  const total = toNumber(firstPresent(data.total, amounts.total, amounts.totalAmount)) || neto + iva

  return {
    rubik: {
      businessName: firstPresent(
        rubikCompany.businessName,
        rubikCompany.name,
        company.businessName,
        'Rubik Creaciones SPA',
      ),
      rut: firstPresent(rubikCompany.rut, company.rut, '77.589.233-1'),
      phone: firstPresent(rubikCompany.phone, rubikCompany.telefono, company.phone, '93535395'),
      email: firstPresent(rubikCompany.email, company.email, 'contacto@rubikcreaciones.cl'),
      address: firstPresent(rubikCompany.address, rubikCompany.direccion, company.address, 'Rubik Creaciones SPA'),
    },
    numero: firstPresent(data.numero, data.folio, data.quoteNumber, quote.numero, quote.quoteNumber, '8118'),
    fecha: formatDate(firstPresent(data.fecha, data.date, quote.fecha, quote.date)),
    vendedor: firstPresent(data.vendedor, data.sellerName, seller.name, quote.vendedor),
    cliente: firstPresent(data.cliente, data.customer, client.cliente, client.client, client.name),
    empresa: firstPresent(data.empresa, data.companyName, client.empresa, client.company, client.businessName),
    atencion: firstPresent(data.atencion, data.attention, client.atencion, client.attention, client.contacto),
    tema: firstPresent(data.tema, data.subject, quote.tema, quote.subject),
    rut: firstPresent(data.rut, data.rutCliente, client.rut, client.rutCliente),
    telefono: firstPresent(data.telefono, data.telefonoCliente, data.phone, client.telefono, client.phone),
    comuna: firstPresent(data.comuna, data.commune, client.comuna, client.commune),
    condicion: firstPresent(data.condicion, data.condition, quote.condicion, quote.condition),
    direccion: firstPresent(data.direccion, data.address, client.direccion, client.address),
    email: firstPresent(data.email, data.correo, client.email, client.correo),
    items,
    neto,
    iva,
    total,
    observaciones: firstPresent(data.observaciones, data.observations, quote.observaciones, quote.observations),
  }
}

const renderLogo = () => {
  const logoDataUri = getEmbeddedLogoDataUri()

  if (logoDataUri) {
    return `<img class="rubik-logo-image" src="${logoDataUri}" alt="Rubik Creaciones" />`
  }

  return `
    <div class="rubik-logo" aria-label="Rubik Creaciones">
      <div class="rubik-word">
        <span>R</span><span>U</span><span>B</span><span>I</span><span>K</span>
      </div>
      <div class="rubik-subword">
        <span>C</span><span>R</span><span>E</span><span>A</span><span>C</span><span>I</span><span>O</span><span>N</span><span>E</span><span>S</span>
      </div>
      <div class="rubik-tagline">IMPRESI&Oacute;N-VOLUMETRICOS-STANDS-NEONFLEX</div>
      <div class="rubik-tagline">Y M&Aacute;S.</div>
    </div>
  `
}

const renderRows = (items) => {
  if (!items.length) {
    return `
      <tr class="item-row">
        <td class="qty"></td>
        <td class="description">Sin items ingresados.</td>
        <td class="money"></td>
        <td class="money"></td>
        <td class="observations"></td>
      </tr>
    `
  }

  return items
    .map(
      (item) => `
        <tr class="item-row">
          <td class="qty">${escapeHTML(item.cantidad)}</td>
          <td class="description">${escapeHTML(item.descripcion)}</td>
          <td class="money">${formatCLP(item.valorUnitario)}</td>
          <td class="money">${formatCLP(item.valorTotal)}</td>
          <td class="observations">${escapeHTML(item.observaciones)}</td>
        </tr>
      `,
    )
    .join('')
}

const defaultCommercialNotes =
  'Valores incluyen IVA, salvo indicacion contraria. Plazo de entrega sujeto a aprobacion de arte y disponibilidad de materiales. Instalacion/despacho se considera solo si esta indicado en la descripcion.'

function renderCotizacionHTML(data = {}) {
  const quote = normalizeQuoteData(data)
  const notes = firstPresent(quote.observaciones, defaultCommercialNotes)

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Cotizacion ${escapeHTML(quote.numero)}</title>
  <style>
    @page { size: A4; margin: 7mm 6mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #ffffff;
      color: #060067;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 8.2px;
      line-height: 1.18;
    }
    .sheet {
      width: 100%;
      min-height: 100%;
      background: #ffffff;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    td,
    th {
      border: 0.8px solid #4c40ff;
      padding: 2px 4px;
      vertical-align: middle;
      overflow-wrap: break-word;
      word-break: normal;
    }
    .top-grid td {
      height: 18px;
    }
    .logo-cell {
      height: 74px;
      padding: 0 6px;
      text-align: center;
      border-bottom-color: #4c40ff;
    }
    .rubik-logo-image {
      display: block;
      width: 300px;
      max-width: 82%;
      max-height: 72px;
      height: auto;
      margin: 0 auto;
      object-fit: contain;
    }
    .rubik-logo {
      display: flex;
      min-height: 68px;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #e6007e;
      font-weight: 400;
    }
    .rubik-word {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 18px;
      width: 100%;
      color: #e6007e;
      font-size: 31px;
      line-height: 0.85;
    }
    .rubik-subword {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      color: #2d2387;
      font-size: 11px;
      line-height: 1;
      margin-top: 1px;
    }
    .rubik-tagline {
      color: #e6007e;
      font-size: 6.7px;
      line-height: 1.15;
      margin-top: 4px;
    }
    .quote-title {
      background: #f8e2f1;
      color: #07006f;
      font-size: 12px;
      font-weight: 700;
      text-align: center;
    }
    .quote-rut {
      height: 29px;
      color: #07006f;
      font-weight: 700;
      text-align: center;
    }
    .label {
      background: #eaf0ff;
      color: #07006f;
      font-weight: 700;
      text-transform: uppercase;
    }
    .value {
      color: #111111;
      text-align: center;
    }
    .request-title {
      height: 48px;
      background: #f8e2f1;
      color: #07006f;
      font-size: 12px;
      font-weight: 700;
      text-align: center;
    }
    .items-table th {
      background: #e6007e;
      color: #ffffff;
      font-size: 8.2px;
      font-weight: 700;
      text-align: center;
      white-space: normal;
    }
    .items-table td {
      min-height: 28px;
      color: #111111;
      vertical-align: top;
    }
    .item-row td {
      padding-top: 5px;
      padding-bottom: 5px;
    }
    .qty {
      width: 6.5%;
      text-align: center;
    }
    .description {
      width: 43.5%;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .unit {
      width: 10.5%;
    }
    .line-total {
      width: 21%;
    }
    .obs-col {
      width: 18.5%;
    }
    .money {
      text-align: right;
      white-space: nowrap;
    }
    .observations {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .bottom-spacer {
      height: 19px;
      background: #ffffff;
    }
    .transfer-cell {
      background: #fff4fb;
      color: #3126c8;
      text-align: center;
    }
    .transfer-title {
      color: #07006f;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .transfer-line {
      margin-top: 8px;
    }
    .total-label {
      color: #07006f;
      font-size: 11px;
      text-align: left;
    }
    .total-value {
      color: #07006f;
      font-size: 11px;
      font-weight: 700;
      text-align: right;
      white-space: nowrap;
    }
    .grand-total td {
      background: #f8e2f1;
      font-size: 12px;
      font-weight: 700;
    }
    .notes-title {
      height: 24px;
      background: #f8e2f1;
      color: #07006f;
      font-size: 10px;
      font-weight: 700;
      text-align: left;
    }
    .notes-body {
      min-height: 42px;
      color: #05004d;
      font-size: 8.5px;
      line-height: 1.4;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <main class="sheet">
    <table class="top-grid" aria-label="Datos de cotizacion">
      <colgroup>
        <col style="width: 10%" />
        <col style="width: 40%" />
        <col style="width: 10%" />
        <col style="width: 40%" />
      </colgroup>
      <tr>
        <td class="logo-cell" colspan="2" rowspan="4">${renderLogo()}</td>
        <td class="quote-title" colspan="2">COTIZACI&Oacute;N</td>
      </tr>
      <tr>
        <td class="quote-rut" colspan="2">RUT: ${escapeHTML(quote.rubik.rut)}</td>
      </tr>
      <tr>
        <td class="label">N&deg; COTIZACI&Oacute;N</td>
        <td class="value">${escapeHTML(quote.numero)}</td>
      </tr>
      <tr>
        <td class="label">FECHA</td>
        <td class="value">${escapeHTML(quote.fecha)}</td>
      </tr>
      <tr>
        <td class="label">DIRECCI&Oacute;N</td>
        <td class="value">${escapeHTML(quote.rubik.address)}</td>
        <td class="label">VENDEDOR</td>
        <td class="value">${escapeHTML(quote.vendedor)}</td>
      </tr>
      <tr>
        <td class="label">TEL&Eacute;FONO</td>
        <td class="value">${escapeHTML(quote.telefono)}</td>
        <td class="label">RUT CLIENTE</td>
        <td class="value">${escapeHTML(quote.rut)}</td>
      </tr>
      <tr>
        <td class="label">EMAIL</td>
        <td class="value">${escapeHTML(quote.email)}</td>
        <td class="label">TEL&Eacute;FONO</td>
        <td class="value">${escapeHTML(quote.telefono)}</td>
      </tr>
      <tr>
        <td class="label">CLIENTE</td>
        <td class="value">${escapeHTML(quote.cliente)}</td>
        <td class="label">COMUNA</td>
        <td class="value">${escapeHTML(quote.comuna)}</td>
      </tr>
      <tr>
        <td class="label">EMPRESA</td>
        <td class="value">${escapeHTML(quote.empresa)}</td>
        <td class="label">CONDICI&Oacute;N</td>
        <td class="value">${escapeHTML(quote.condicion)}</td>
      </tr>
      <tr>
        <td class="label">ATENCI&Oacute;N</td>
        <td class="value">${escapeHTML(quote.atencion)}</td>
        <td class="label">DIRECCI&Oacute;N</td>
        <td class="value">${escapeHTML(quote.direccion)}</td>
      </tr>
      <tr>
        <td class="label">TEMA</td>
        <td class="value" colspan="3">${escapeHTML(quote.tema)}</td>
      </tr>
      <tr>
        <td class="request-title" colspan="4">Cotizaci&oacute;n seg&uacute;n solicitud</td>
      </tr>
    </table>

    <table class="items-table" aria-label="Productos y servicios cotizados">
      <colgroup>
        <col class="qty" />
        <col class="description" />
        <col class="unit" />
        <col class="line-total" />
        <col class="obs-col" />
      </colgroup>
      <thead>
        <tr>
          <th>Cantidad</th>
          <th>Descripci&oacute;n t&eacute;cnica del producto / servicio</th>
          <th>Valor Unitario</th>
          <th>Valor Total</th>
          <th>Observaciones</th>
        </tr>
      </thead>
      <tbody>
        ${renderRows(quote.items)}
      </tbody>
    </table>

    <table aria-label="Datos de transferencia y totales">
      <colgroup>
        <col style="width: 50%" />
        <col style="width: 10%" />
        <col style="width: 20%" />
        <col style="width: 20%" />
      </colgroup>
      <tr>
        <td class="bottom-spacer" colspan="4"></td>
      </tr>
      <tr>
        <td class="transfer-cell" colspan="2" rowspan="3">
          <div class="transfer-title">DATOS DE TRANSFERENCIA</div>
          <div class="transfer-line">Banco BCI - CTA. CORRIENTE 63730588</div>
          <div class="transfer-line">RUT ${escapeHTML(quote.rubik.rut)} - ${escapeHTML(quote.rubik.email)}</div>
          <div class="transfer-line">www.rubikcreaciones.cl</div>
        </td>
        <td class="total-label">NETO</td>
        <td class="total-value">${formatCLP(quote.neto)}</td>
      </tr>
      <tr>
        <td class="total-label">IVA 19%</td>
        <td class="total-value">${formatCLP(quote.iva)}</td>
      </tr>
      <tr class="grand-total">
        <td class="total-label">TOTAL</td>
        <td class="total-value">${formatCLP(quote.total)}</td>
      </tr>
    </table>

    <table aria-label="Notas comerciales">
      <tr>
        <td class="notes-title">Notas comerciales</td>
      </tr>
      <tr>
        <td class="notes-body">&bull; ${escapeHTML(notes)}</td>
      </tr>
    </table>
  </main>
</body>
</html>`
}

module.exports = renderCotizacionHTML
