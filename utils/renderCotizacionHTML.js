const htmlEscape = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const getNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (value === null || value === undefined || value === '') return 0

  const normalized = String(value)
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.')

  return Number(normalized) || 0
}

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(getNumber(value))

const firstPresent = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== '') ?? ''

const getNestedObject = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}

const normalizeItem = (item = {}) => {
  const cantidad = getNumber(firstPresent(item.cantidad, item.quantity, item.qty, 0))
  const valorUnitario = getNumber(
    firstPresent(item.valorUnitario, item.unitValue, item.unitPrice, item.price, 0),
  )
  const total = getNumber(firstPresent(item.total, item.valorTotal, item.lineTotal, cantidad * valorUnitario))

  return {
    cantidad,
    descripcion: firstPresent(item.descripcion, item.description, item.technicalDescription),
    valorUnitario,
    total,
    observaciones: firstPresent(item.observaciones, item.observations),
  }
}

const normalizeQuoteData = (data = {}) => {
  const payload = getNestedObject(data.payload)
  const company = getNestedObject(data.company || payload.company)
  const client = getNestedObject(data.client || payload.client)
  const seller = getNestedObject(data.seller || payload.seller)
  const quote = getNestedObject(data.quote || data.quoteData || payload.quote || payload.quoteData)
  const amounts = getNestedObject(data.amounts || payload.amounts)
  const rawItems = firstPresent(data.items, data.quoteItems, data.itemsQuote, payload.items, payload.quoteItems, [])
  const items = (Array.isArray(rawItems) ? rawItems : []).map(normalizeItem)
  const neto = getNumber(firstPresent(data.neto, data.net, amounts.net, amounts.neto, data.montoNeto))
  const iva = getNumber(firstPresent(data.iva, amounts.iva, amounts.taxAmount))
  const total = getNumber(firstPresent(data.total, amounts.total, amounts.totalAmount))
  const computedNeto = items.reduce((sum, item) => sum + item.total, 0)
  const finalNeto = neto || computedNeto
  const finalIva = iva || Math.round(finalNeto * 0.19)
  const finalTotal = total || finalNeto + finalIva

  return {
    numero: firstPresent(data.numero, data.quoteNumber, quote.numero, quote.quoteNumber, '8103'),
    fecha: firstPresent(data.fecha, data.date, quote.fecha, quote.date),
    cliente: firstPresent(data.cliente, data.customer, client.cliente, client.client, client.name),
    rut: firstPresent(data.rut, data.rutCliente, client.rut, client.rutCliente),
    atencion: firstPresent(data.atencion, data.attention, client.atencion, client.attention),
    telefono: firstPresent(data.telefono, data.phone, client.telefono, client.phone),
    comuna: firstPresent(data.comuna, data.commune, client.comuna, client.commune),
    condicion: firstPresent(data.condicion, data.condition, quote.condicion, quote.condition),
    vendedor: firstPresent(data.vendedor, data.sellerName, seller.name, quote.vendedor),
    tema: firstPresent(data.tema, data.subject, quote.tema, quote.subject),
    observaciones: firstPresent(data.observaciones, data.observations, quote.observaciones),
    empresaRubik: firstPresent(company.businessName, company.name, 'Rubik Creaciones'),
    rutRubik: firstPresent(company.rut, '77.589.233-1'),
    emailRubik: firstPresent(company.email, 'contacto@rubikcreaciones.cl'),
    telefonoRubik: firstPresent(company.phone, '93535395'),
    direccionRubik: firstPresent(company.address, 'Rubik Creaciones SPA'),
    items,
    neto: finalNeto,
    iva: finalIva,
    total: finalTotal,
  }
}

const renderItemRows = (items) => {
  if (!items.length) {
    return `
      <tr>
        <td colspan="5" class="empty-row">Sin items ingresados.</td>
      </tr>
    `
  }

  return items
    .map(
      (item) => `
        <tr>
          <td class="qty">${htmlEscape(item.cantidad)}</td>
          <td class="description">${htmlEscape(item.descripcion)}</td>
          <td class="money">${formatCurrency(item.valorUnitario)}</td>
          <td class="money">${formatCurrency(item.total)}</td>
          <td class="notes">${htmlEscape(item.observaciones)}</td>
        </tr>
      `,
    )
    .join('')
}

const renderCotizacionHTML = (data = {}) => {
  const quote = normalizeQuoteData(data)

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Cotizacion ${htmlEscape(quote.numero)}</title>
  <style>
    @page { size: A4; margin: 14mm 12mm 18mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #111827;
      background: #ffffff;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      line-height: 1.35;
    }
    .document { width: 100%; padding-bottom: 10mm; }
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 20px;
      border-bottom: 3px solid #1d4ed8;
      padding-bottom: 14px;
      margin-bottom: 16px;
    }
    .brand-title { color: #1d4ed8; font-size: 25px; font-weight: 800; letter-spacing: .3px; }
    .tagline { color: #6d28d9; font-size: 12px; font-weight: 700; margin-top: 2px; }
    .company-data { color: #4b5563; margin-top: 8px; }
    .quote-box {
      min-width: 175px;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      overflow: hidden;
      text-align: right;
    }
    .quote-box .label { background: #0f172a; color: #ffffff; font-weight: 700; padding: 8px 10px; }
    .quote-box .number { font-size: 18px; font-weight: 800; padding: 10px; color: #1d4ed8; }
    .quote-box .date { padding: 0 10px 10px; color: #4b5563; }
    .section-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 16px;
    }
    .section {
      border: 1px solid #dbe3ef;
      border-radius: 10px;
      overflow: hidden;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .section-title {
      background: #f1f5f9;
      color: #0f172a;
      font-weight: 800;
      padding: 8px 10px;
      border-bottom: 1px solid #dbe3ef;
    }
    .fields { padding: 8px 10px; }
    .field { display: flex; gap: 8px; padding: 3px 0; }
    .field strong { min-width: 82px; color: #475569; }
    table { width: 100%; border-collapse: collapse; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    tr { page-break-inside: avoid; break-inside: avoid; }
    th {
      background: #0f172a;
      color: #ffffff;
      border: 1px solid #0f172a;
      padding: 8px 6px;
      text-align: left;
      font-size: 10px;
      text-transform: uppercase;
    }
    td {
      border: 1px solid #cbd5e1;
      padding: 7px 6px;
      vertical-align: top;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    .qty { width: 8%; text-align: center; }
    .description { width: 42%; white-space: pre-wrap; }
    .money { width: 14%; text-align: right; white-space: nowrap; }
    .notes { width: 22%; white-space: pre-wrap; }
    .empty-row { text-align: center; color: #64748b; padding: 18px; }
    .totals {
      width: 260px;
      margin-left: auto;
      margin-top: 14px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .total-line {
      display: flex;
      justify-content: space-between;
      border: 1px solid #cbd5e1;
      border-bottom: 0;
      padding: 8px 10px;
    }
    .total-line:last-child {
      border-bottom: 1px solid #cbd5e1;
      background: #1d4ed8;
      color: #ffffff;
      font-size: 14px;
      font-weight: 800;
    }
    .observations {
      margin-top: 16px;
      border: 1px solid #dbe3ef;
      border-radius: 10px;
      padding: 10px;
      min-height: 54px;
      white-space: pre-wrap;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .footer {
      position: fixed;
      left: 0;
      right: 0;
      bottom: -10mm;
      margin-top: 18px;
      color: #64748b;
      font-size: 10px;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
    }
  </style>
</head>
<body>
  <main class="document">
    <header class="header">
      <div>
        <div class="brand-title">${htmlEscape(quote.empresaRubik)}</div>
        <div class="tagline">El equipo que concreta tus ideas</div>
        <div class="company-data">
          <div>${htmlEscape(quote.direccionRubik)}</div>
          <div>RUT: ${htmlEscape(quote.rutRubik)}</div>
          <div>Tel: ${htmlEscape(quote.telefonoRubik)} | Email: ${htmlEscape(quote.emailRubik)}</div>
        </div>
      </div>
      <div class="quote-box">
        <div class="label">COTIZACION</div>
        <div class="number">N&deg; ${htmlEscape(quote.numero)}</div>
        <div class="date">${htmlEscape(quote.fecha)}</div>
      </div>
    </header>

    <section class="section-grid">
      <div class="section">
        <div class="section-title">Datos del cliente</div>
        <div class="fields">
          <div class="field"><strong>Cliente</strong><span>${htmlEscape(quote.cliente)}</span></div>
          <div class="field"><strong>RUT</strong><span>${htmlEscape(quote.rut)}</span></div>
          <div class="field"><strong>Atencion</strong><span>${htmlEscape(quote.atencion)}</span></div>
          <div class="field"><strong>Telefono</strong><span>${htmlEscape(quote.telefono)}</span></div>
          <div class="field"><strong>Comuna</strong><span>${htmlEscape(quote.comuna)}</span></div>
        </div>
      </div>
      <div class="section">
        <div class="section-title">Datos de cotizacion</div>
        <div class="fields">
          <div class="field"><strong>Tema</strong><span>${htmlEscape(quote.tema)}</span></div>
          <div class="field"><strong>Condicion</strong><span>${htmlEscape(quote.condicion)}</span></div>
          <div class="field"><strong>Vendedor</strong><span>${htmlEscape(quote.vendedor)}</span></div>
          <div class="field"><strong>Fecha</strong><span>${htmlEscape(quote.fecha)}</span></div>
        </div>
      </div>
    </section>

    <table>
      <thead>
        <tr>
          <th class="qty">Cant.</th>
          <th>Descripcion</th>
          <th class="money">Valor unitario</th>
          <th class="money">Total</th>
          <th>Observaciones</th>
        </tr>
      </thead>
      <tbody>
        ${renderItemRows(quote.items)}
      </tbody>
    </table>

    <section class="totals">
      <div class="total-line"><strong>Neto</strong><span>${formatCurrency(quote.neto)}</span></div>
      <div class="total-line"><strong>IVA 19%</strong><span>${formatCurrency(quote.iva)}</span></div>
      <div class="total-line"><strong>Total</strong><span>${formatCurrency(quote.total)}</span></div>
    </section>

    <section class="observations">
      <strong>Observaciones</strong><br />
      ${htmlEscape(quote.observaciones || 'Sin observaciones.')}
    </section>

    <footer class="footer">
      Rubik Creaciones | Documento generado por ERP Rubik.
    </footer>
  </main>
</body>
</html>`
}

module.exports = {
  normalizeQuoteData,
  renderCotizacionHTML,
}
