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

const toNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (value === null || value === undefined || value === '') return 0

  const normalized = String(value)
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.')

  return Number(normalized) || 0
}

const formatCLP = (value) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(toNumber(value))

const getItems = (data, payload) => {
  const candidates = [
    data.items,
    data.quoteItems,
    data.detalles,
    data.productos,
    data.lineas,
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
    ),
    valorUnitario,
    valorTotal,
    observaciones: firstPresent(item.observaciones, item.observations, item.notes),
  }
}

const normalizeQuoteData = (data = {}) => {
  const payload = asObject(data.payload)
  const rubikCompany = asObject(data.rubikCompany || data.company || payload.rubikCompany || payload.company)
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
      businessName: firstPresent(rubikCompany.businessName, rubikCompany.name, 'Rubik Creaciones SPA'),
      rut: firstPresent(rubikCompany.rut, '77.589.233-1'),
      phone: firstPresent(rubikCompany.phone, rubikCompany.telefono, '93535395'),
      email: firstPresent(rubikCompany.email, 'contacto@rubikcreaciones.cl'),
      address: firstPresent(rubikCompany.address, rubikCompany.direccion, 'Rubik Creaciones SPA'),
    },
    sellerName: firstPresent(data.vendedor, data.sellerName, seller.name, quote.vendedor),
    numero: firstPresent(data.numero, data.folio, data.quoteNumber, quote.numero, quote.quoteNumber, '8103'),
    fecha: firstPresent(data.fecha, data.date, quote.fecha, quote.date),
    tema: firstPresent(data.tema, data.subject, quote.tema, quote.subject),
    condicion: firstPresent(data.condicion, data.condition, quote.condicion, quote.condition),
    cliente: firstPresent(data.cliente, data.customer, client.cliente, client.client, client.name),
    empresa: firstPresent(data.empresa, data.companyName, client.empresa, client.company),
    atencion: firstPresent(data.atencion, data.attention, client.atencion, client.attention, client.contacto),
    rutCliente: firstPresent(data.rut, data.rutCliente, client.rut, client.rutCliente),
    telefonoCliente: firstPresent(data.telefono, data.telefonoCliente, data.phone, client.telefono, client.phone),
    comuna: firstPresent(data.comuna, data.commune, client.comuna, client.commune),
    observaciones: firstPresent(data.observaciones, data.observations, quote.observaciones),
    items,
    neto,
    iva,
    total,
  }
}

const renderRows = (items) => {
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
          <td class="qty">${escapeHTML(item.cantidad)}</td>
          <td class="description">${escapeHTML(item.descripcion)}</td>
          <td class="money">${formatCLP(item.valorUnitario)}</td>
          <td class="money">${formatCLP(item.valorTotal)}</td>
          <td class="notes">${escapeHTML(item.observaciones)}</td>
        </tr>
      `,
    )
    .join('')
}

function renderCotizacionHTML(data = {}) {
  const quote = normalizeQuoteData(data)

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Cotizacion ${escapeHTML(quote.numero)}</title>
  <style>
    @page { size: A4; margin: 12mm 10mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #111827;
      background: #ffffff;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10.5px;
      line-height: 1.34;
    }
    .page { width: 100%; }
    .top {
      display: grid;
      grid-template-columns: 1fr 210px;
      gap: 16px;
      align-items: start;
      margin-bottom: 10px;
    }
    .brand {
      border-bottom: 3px solid #1d4ed8;
      padding-bottom: 10px;
    }
    .brand-name {
      color: #1d4ed8;
      font-size: 26px;
      font-weight: 900;
      letter-spacing: .2px;
    }
    .tagline {
      color: #6d28d9;
      font-size: 12px;
      font-weight: 800;
      margin: 2px 0 8px;
    }
    .rubik-data { color: #475569; }
    .quote-box {
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      overflow: hidden;
      text-align: right;
    }
    .quote-title {
      background: #0f172a;
      color: #ffffff;
      font-weight: 800;
      padding: 8px 10px;
      text-align: center;
      letter-spacing: .4px;
    }
    .quote-number {
      color: #1d4ed8;
      font-size: 20px;
      font-weight: 900;
      padding: 10px 12px 4px;
    }
    .quote-date { color: #475569; padding: 0 12px 10px; }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin: 12px 0;
    }
    .panel {
      border: 1px solid #dbe3ef;
      border-radius: 8px;
      overflow: hidden;
      break-inside: avoid;
    }
    .panel-title {
      background: #f1f5f9;
      color: #0f172a;
      font-weight: 800;
      padding: 7px 9px;
      border-bottom: 1px solid #dbe3ef;
    }
    .panel-body { padding: 7px 9px; }
    .field {
      display: grid;
      grid-template-columns: 92px 1fr;
      gap: 8px;
      padding: 2px 0;
    }
    .field strong { color: #475569; }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin-top: 10px;
    }
    thead { display: table-header-group; }
    th {
      background: #0f172a;
      color: #ffffff;
      border: 1px solid #0f172a;
      padding: 7px 6px;
      font-size: 9.5px;
      text-transform: uppercase;
      text-align: left;
    }
    td {
      border: 1px solid #cbd5e1;
      padding: 6px;
      vertical-align: top;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    .qty { width: 8%; text-align: center; }
    .description { width: 43%; white-space: pre-wrap; }
    .money { width: 13%; text-align: right; white-space: nowrap; }
    .notes { width: 23%; white-space: pre-wrap; }
    .empty-row { text-align: center; color: #64748b; padding: 16px; }
    .bottom {
      display: grid;
      grid-template-columns: 1fr 260px;
      gap: 14px;
      align-items: start;
      margin-top: 14px;
    }
    .transfer,
    .notes-box {
      border: 1px solid #dbe3ef;
      border-radius: 8px;
      padding: 9px;
      break-inside: avoid;
    }
    .box-title {
      color: #0f172a;
      font-weight: 900;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .totals {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      overflow: hidden;
      break-inside: avoid;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 10px;
      border-bottom: 1px solid #cbd5e1;
    }
    .total-row:last-child {
      border-bottom: 0;
      background: #1d4ed8;
      color: #ffffff;
      font-size: 14px;
      font-weight: 900;
    }
    .commercial-notes {
      margin-top: 10px;
      color: #475569;
      font-size: 10px;
    }
    .commercial-notes ul {
      margin: 5px 0 0 15px;
      padding: 0;
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="top">
      <div class="brand">
        <div class="brand-name">Rubik Creaciones</div>
        <div class="tagline">El equipo que concreta tus ideas</div>
        <div class="rubik-data">
          <div>${escapeHTML(quote.rubik.businessName)}</div>
          <div>RUT: ${escapeHTML(quote.rubik.rut)}</div>
          <div>Direccion: ${escapeHTML(quote.rubik.address)}</div>
          <div>Telefono: ${escapeHTML(quote.rubik.phone)} | Email: ${escapeHTML(quote.rubik.email)}</div>
        </div>
      </div>
      <aside class="quote-box">
        <div class="quote-title">COTIZACION</div>
        <div class="quote-number">N&deg; ${escapeHTML(quote.numero)}</div>
        <div class="quote-date">${escapeHTML(quote.fecha)}</div>
      </aside>
    </section>

    <section class="info-grid">
      <div class="panel">
        <div class="panel-title">Datos cliente</div>
        <div class="panel-body">
          <div class="field"><strong>Cliente</strong><span>${escapeHTML(quote.cliente)}</span></div>
          <div class="field"><strong>Empresa</strong><span>${escapeHTML(quote.empresa)}</span></div>
          <div class="field"><strong>Atencion</strong><span>${escapeHTML(quote.atencion)}</span></div>
          <div class="field"><strong>RUT cliente</strong><span>${escapeHTML(quote.rutCliente)}</span></div>
          <div class="field"><strong>Telefono</strong><span>${escapeHTML(quote.telefonoCliente)}</span></div>
          <div class="field"><strong>Comuna</strong><span>${escapeHTML(quote.comuna)}</span></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-title">Datos cotizacion</div>
        <div class="panel-body">
          <div class="field"><strong>Fecha</strong><span>${escapeHTML(quote.fecha)}</span></div>
          <div class="field"><strong>Vendedor</strong><span>${escapeHTML(quote.sellerName)}</span></div>
          <div class="field"><strong>Tema</strong><span>${escapeHTML(quote.tema)}</span></div>
          <div class="field"><strong>Condicion</strong><span>${escapeHTML(quote.condicion)}</span></div>
        </div>
      </div>
    </section>

    <table>
      <thead>
        <tr>
          <th class="qty">Cantidad</th>
          <th>Descripcion tecnica del producto / servicio</th>
          <th class="money">Valor unitario</th>
          <th class="money">Valor total</th>
          <th>Observaciones</th>
        </tr>
      </thead>
      <tbody>
        ${renderRows(quote.items)}
      </tbody>
    </table>

    <section class="bottom">
      <div>
        <div class="transfer">
          <div class="box-title">Datos de transferencia</div>
          <div>Banco BCI</div>
          <div>Cuenta corriente Rubik Creaciones SPA</div>
          <div>RUT: ${escapeHTML(quote.rubik.rut)}</div>
          <div>Email: ${escapeHTML(quote.rubik.email)}</div>
          <div>www.rubikcreaciones.cl</div>
        </div>
        <div class="notes-box commercial-notes">
          <div class="box-title">Notas comerciales</div>
          <ul>
            <li>Valores expresados en pesos chilenos.</li>
            <li>La produccion inicia segun aprobacion comercial y tecnica.</li>
            <li>Plazos sujetos a confirmacion de materiales, arte final y pago acordado.</li>
            <li>${escapeHTML(quote.observaciones || 'Sin observaciones adicionales.')}</li>
          </ul>
        </div>
      </div>
      <div class="totals">
        <div class="total-row"><strong>Neto</strong><span>${formatCLP(quote.neto)}</span></div>
        <div class="total-row"><strong>IVA 19%</strong><span>${formatCLP(quote.iva)}</span></div>
        <div class="total-row"><strong>Total</strong><span>${formatCLP(quote.total)}</span></div>
      </div>
    </section>
  </main>
</body>
</html>`
}

module.exports = renderCotizacionHTML
