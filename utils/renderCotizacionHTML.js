function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function money(value) {
  const number = Number(value || 0)
  return `$${number.toLocaleString('es-CL')}`
}

function getItems(data) {
  if (Array.isArray(data.items)) return data.items
  if (Array.isArray(data.detalles)) return data.detalles
  if (Array.isArray(data.productos)) return data.productos
  if (Array.isArray(data.lineas)) return data.lineas
  return []
}

function renderCotizacionHTML(data = {}) {
  const items = getItems(data)

  const neto =
    Number(data.neto || data.subtotal || 0) ||
    items.reduce((sum, item) => sum + Number(item.total || 0), 0)

  const iva = Number(data.iva || Math.round(neto * 0.19))
  const total = Number(data.total || neto + iva)

  const rows = items.length
    ? items
        .map((item) => {
          const cantidad = item.cantidad || item.qty || item.quantity || ''
          const descripcion =
            item.descripcion ||
            item.description ||
            item.nombre ||
            item.producto ||
            ''

          const valorUnitario =
            item.valorUnitario ||
            item.precioUnitario ||
            item.price ||
            item.valor ||
            0

          const totalItem =
            item.total ||
            item.valorTotal ||
            Number(cantidad || 0) * Number(valorUnitario || 0)

          return `
            <tr class="item-row">
              <td class="center">${escapeHTML(cantidad)}</td>
              <td class="description">${escapeHTML(descripcion)}</td>
              <td class="money">${money(valorUnitario)}</td>
              <td class="money">${money(totalItem)}</td>
              <td class="obs">${escapeHTML(item.observaciones || item.observacion || '')}</td>
            </tr>
          `
        })
        .join('')
    : `
      <tr class="item-row">
        <td></td>
        <td class="description"></td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
    `

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />

  <style>
    @page {
      size: A4;
      margin: 7mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      font-family: Arial, Helvetica, sans-serif;
      color: #15153f;
      font-size: 11px;
    }

    .sheet {
      width: 100%;
      min-height: 100%;
      background: #fff;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    td,
    th {
      border: 1px solid #6250ff;
      padding: 4px 5px;
      vertical-align: middle;
    }

    .top-table td {
      height: 27px;
    }

    .logo-cell {
      width: 50%;
      height: 88px;
      text-align: center;
      border-right: 1px solid #6250ff;
      border-bottom: 1px solid #6250ff;
    }

    .logo-main {
      font-size: 52px;
      line-height: 48px;
      letter-spacing: 12px;
      color: #ec1684;
      font-weight: 300;
    }

    .logo-sub {
      font-size: 18px;
      letter-spacing: 10px;
      color: #2b247f;
      margin-top: -4px;
    }

    .logo-services {
      font-size: 11px;
      letter-spacing: 2px;
      color: #ec1684;
      margin-top: 7px;
    }

    .quote-title-cell {
      width: 50%;
      background: #fce5f2;
      text-align: center;
      font-size: 24px;
      font-weight: 800;
      color: #201a82;
      height: 48px;
    }

    .company-rut-cell {
      background: #ffffff;
      text-align: center;
      font-size: 15px;
      font-weight: 800;
      color: #201a82;
      height: 42px;
    }

    .label {
      width: 14%;
      font-weight: 800;
      color: #201a82;
      background: #f8f8f8;
      text-transform: uppercase;
    }

    .value {
      color: #111;
      background: #fff;
      text-align: center;
    }

    .request-title {
      background: #fce5f2;
      text-align: center;
      font-size: 18px;
      font-weight: 800;
      color: #201a82;
      height: 62px;
    }

    .items-header th {
      background: #e9167c;
      color: #ffffff;
      font-size: 11px;
      font-weight: 800;
      text-align: center;
      height: 28px;
      border-color: #6250ff;
    }

    .col-cantidad {
      width: 7%;
    }

    .col-descripcion {
      width: 43%;
    }

    .col-unitario {
      width: 12%;
    }

    .col-total {
      width: 21%;
    }

    .col-observaciones {
      width: 17%;
    }

    .item-row td {
      min-height: 28px;
      height: auto;
      color: #111;
      font-size: 10.5px;
      line-height: 1.18;
      background: #fff;
    }

    .center {
      text-align: center;
    }

    .description {
      text-align: left;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .money {
      text-align: right;
      white-space: nowrap;
    }

    .obs {
      text-align: left;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .blank-row td {
      height: 25px;
    }

    .pink-row td {
      background: #fce5f2;
      height: 18px;
      border-color: #6250ff;
    }

    .transfer-title {
      background: #fff4fa;
      text-align: center;
      font-size: 14px;
      font-weight: 800;
      color: #201a82;
    }

    .transfer-data {
      text-align: center;
      color: #5b48cc;
      font-size: 10.5px;
      line-height: 1.65;
      height: 72px;
    }

    .totals-label {
      width: 15%;
      font-weight: 800;
      font-size: 14px;
      color: #201a82;
      background: #fff;
    }

    .totals-value {
      text-align: right;
      font-weight: 800;
      font-size: 13px;
      color: #201a82;
      background: #fff;
    }

    .total-final td {
      background: #fce5f2;
      font-size: 16px;
      font-weight: 900;
    }

    .notes-title {
      font-weight: 800;
      color: #201a82;
      background: #fff4fa;
      height: 24px;
    }

    .notes-text {
      color: #111;
      background: #fff4fa;
      font-size: 10.5px;
      line-height: 1.35;
      height: 38px;
    }

    .small {
      font-size: 10px;
    }
  </style>
</head>

<body>
  <div class="sheet">
    <table class="top-table">
      <tr>
        <td class="logo-cell" colspan="4" rowspan="3">
          <div class="logo-main">RUBIK</div>
          <div class="logo-sub">CREACIONES</div>
          <div class="logo-services">IMPRESIÓN-VOLUMÉTRICOS-STANDS-NEONFLEX<br />Y MÁS.</div>
        </td>

        <td class="quote-title-cell" colspan="4">COTIZACIÓN</td>
      </tr>

      <tr>
        <td class="company-rut-cell" colspan="4">RUT: 77.589.233-1</td>
      </tr>

      <tr>
        <td class="company-rut-cell small" colspan="4"></td>
      </tr>

      <tr>
        <td class="label">DIRECCIÓN</td>
        <td class="value" colspan="3">Rubik Creaciones SPA</td>
        <td class="label">N° COTIZACIÓN</td>
        <td class="value" colspan="3">${escapeHTML(data.numero || data.folio || '')}</td>
      </tr>

      <tr>
        <td class="label">TELÉFONO</td>
        <td class="value" colspan="3">93535395</td>
        <td class="label">FECHA</td>
        <td class="value" colspan="3">${escapeHTML(data.fecha || '')}</td>
      </tr>

      <tr>
        <td class="label">EMAIL</td>
        <td class="value" colspan="3">contacto@rubikcreaciones.cl</td>
        <td class="label">VENDEDOR</td>
        <td class="value" colspan="3">${escapeHTML(data.vendedor || '')}</td>
      </tr>

      <tr>
        <td class="label">CLIENTE</td>
        <td class="value" colspan="3">${escapeHTML(data.cliente || '')}</td>
        <td class="label">RUT CLIENTE</td>
        <td class="value" colspan="3">${escapeHTML(data.rut || data.rutCliente || '')}</td>
      </tr>

      <tr>
        <td class="label">EMPRESA</td>
        <td class="value" colspan="3">${escapeHTML(data.empresa || '')}</td>
        <td class="label">TELÉFONO</td>
        <td class="value" colspan="3">${escapeHTML(data.telefono || '')}</td>
      </tr>

      <tr>
        <td class="label">ATENCIÓN</td>
        <td class="value" colspan="3">${escapeHTML(data.atencion || '')}</td>
        <td class="label">COMUNA</td>
        <td class="value" colspan="3">${escapeHTML(data.comuna || '')}</td>
      </tr>

      <tr>
        <td class="label">TEMA</td>
        <td class="value" colspan="3">${escapeHTML(data.tema || '')}</td>
        <td class="label">CONDICIÓN</td>
        <td class="value" colspan="3">${escapeHTML(data.condicion || '')}</td>
      </tr>

      <tr>
        <td class="request-title" colspan="8">Cotización según solicitud</td>
      </tr>
    </table>

    <table>
      <thead>
        <tr class="items-header">
          <th class="col-cantidad">Cantidad</th>
          <th class="col-descripcion">Descripción técnica del producto / servicio</th>
          <th class="col-unitario">Valor Unitario</th>
          <th class="col-total">Valor Total</th>
          <th class="col-observaciones">Observaciones</th>
        </tr>
      </thead>

      <tbody>
        ${rows}

        ${Array.from({ length: Math.max(0, 15 - items.length) })
          .map(
            () => `
            <tr class="blank-row">
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
            </tr>
          `
          )
          .join('')}
      </tbody>
    </table>

    <table>
      <tr class="pink-row">
        <td colspan="8"></td>
      </tr>

      <tr>
        <td class="transfer-title" colspan="4">DATOS DE TRANSFERENCIA</td>
        <td class="totals-label">NETO</td>
        <td class="totals-value" colspan="3">${money(neto)}</td>
      </tr>

      <tr>
        <td class="transfer-data" colspan="4" rowspan="3">
          Banco BCI - CTA. CORRIENTE 63730588<br />
          RUT 77.589.233-1 - contacto@rubikcreaciones.cl<br />
          www.rubikcreaciones.cl
        </td>

        <td class="totals-label">IVA 19%</td>
        <td class="totals-value" colspan="3">${money(iva)}</td>
      </tr>

      <tr class="total-final">
        <td class="totals-label">TOTAL</td>
        <td class="totals-value" colspan="3">${money(total)}</td>
      </tr>

      <tr>
        <td colspan="4"></td>
      </tr>

      <tr>
        <td class="notes-title" colspan="8">Notas comerciales</td>
      </tr>

      <tr>
        <td class="notes-text" colspan="8">
          • Valores incluyen IVA, salvo indicación contraria.
          • Plazo de entrega sujeto a aprobación de arte y disponibilidad de materiales.
          • Instalación/despacho se considera solo si está indicado en la descripción.
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
  `
}

module.exports = renderCotizacionHTML