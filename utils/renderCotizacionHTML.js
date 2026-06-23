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

  const neto = Number(data.neto || data.subtotal || 0)
  const iva = Number(data.iva || Math.round(neto * 0.19))
  const total = Number(data.total || neto + iva)

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 0;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      color: #111;
      background: #fff;
    }

    .page {
      padding: 28px;
      width: 100%;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #111;
      padding-bottom: 14px;
      margin-bottom: 18px;
    }

    .brand-title {
      font-size: 24px;
      font-weight: 800;
      margin: 0;
      letter-spacing: 0.4px;
    }

    .brand-subtitle {
      margin-top: 4px;
      font-size: 12px;
      color: #444;
    }

    .quote-meta {
      text-align: right;
      line-height: 1.55;
      font-size: 12px;
    }

    .quote-number {
      font-size: 16px;
      font-weight: 800;
    }

    .client-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 20px;
      margin-bottom: 18px;
      padding: 14px;
      border: 1px solid #ddd;
      border-radius: 8px;
      background: #fafafa;
    }

    .field strong {
      display: inline-block;
      min-width: 80px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      table-layout: fixed;
    }

    th {
      background: #111;
      color: white;
      padding: 8px;
      font-size: 11px;
      text-align: left;
      border: 1px solid #111;
    }

    td {
      border: 1px solid #ccc;
      padding: 8px;
      vertical-align: top;
      line-height: 1.35;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    .col-cantidad {
      width: 55px;
      text-align: center;
    }

    .col-descripcion {
      width: auto;
    }

    .col-precio {
      width: 95px;
      text-align: right;
    }

    .col-total {
      width: 95px;
      text-align: right;
    }

    .totals {
      width: 280px;
      margin-left: auto;
      margin-top: 18px;
      border: 1px solid #ddd;
      border-radius: 8px;
      overflow: hidden;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 10px;
      border-bottom: 1px solid #ddd;
    }

    .total-row:last-child {
      border-bottom: none;
    }

    .grand-total {
      background: #111;
      color: #fff;
      font-size: 15px;
      font-weight: 800;
    }

    .observaciones {
      margin-top: 22px;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 8px;
      min-height: 50px;
      line-height: 1.4;
    }

    .footer {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px solid #ddd;
      font-size: 10px;
      color: #555;
      display: flex;
      justify-content: space-between;
      gap: 12px;
    }

    @page {
      size: A4;
      margin: 12mm 10mm;
    }
  </style>
</head>

<body>
  <div class="page">
    <div class="header">
      <div>
        <h1 class="brand-title">Rubik Creaciones</h1>
        <div class="brand-subtitle">El equipo que concreta tus ideas</div>
      </div>

      <div class="quote-meta">
        <div class="quote-number">Cotización N° ${escapeHTML(data.numero || data.folio || '')}</div>
        <div><strong>Fecha:</strong> ${escapeHTML(data.fecha || '')}</div>
        <div><strong>Vendedor:</strong> ${escapeHTML(data.vendedor || '')}</div>
      </div>
    </div>

    <div class="client-grid">
      <div class="field"><strong>Cliente:</strong> ${escapeHTML(data.cliente || data.razonSocial || '')}</div>
      <div class="field"><strong>RUT:</strong> ${escapeHTML(data.rut || '')}</div>
      <div class="field"><strong>Atención:</strong> ${escapeHTML(data.atencion || data.contacto || '')}</div>
      <div class="field"><strong>Teléfono:</strong> ${escapeHTML(data.telefono || '')}</div>
      <div class="field"><strong>Comuna:</strong> ${escapeHTML(data.comuna || '')}</div>
      <div class="field"><strong>Condición:</strong> ${escapeHTML(data.condicion || data.condicionPago || '')}</div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="col-cantidad">Cant.</th>
          <th class="col-descripcion">Descripción</th>
          <th class="col-precio">Valor unit.</th>
          <th class="col-total">Total</th>
        </tr>
      </thead>

      <tbody>
        ${
          items.length
            ? items.map((item) => {
                const cantidad = item.cantidad || item.qty || item.quantity || ''
                const descripcion = item.descripcion || item.description || item.nombre || ''
                const valorUnitario = Number(item.valorUnitario || item.precioUnitario || item.price || 0)
                const totalItem = Number(item.total || item.valorTotal || valorUnitario * Number(cantidad || 0))

                return `
                  <tr>
                    <td class="col-cantidad">${escapeHTML(cantidad)}</td>
                    <td class="col-descripcion">${escapeHTML(descripcion)}</td>
                    <td class="col-precio">${money(valorUnitario)}</td>
                    <td class="col-total">${money(totalItem)}</td>
                  </tr>
                `
              }).join('')
            : `
              <tr>
                <td colspan="4">Sin ítems ingresados.</td>
              </tr>
            `
        }
      </tbody>
    </table>

    <div class="totals">
      <div class="total-row">
        <span>Neto</span>
        <strong>${money(neto)}</strong>
      </div>

      <div class="total-row">
        <span>IVA 19%</span>
        <strong>${money(iva)}</strong>
      </div>

      <div class="total-row grand-total">
        <span>Total</span>
        <span>${money(total)}</span>
      </div>
    </div>

    <div class="observaciones">
      <strong>Observaciones:</strong><br />
      ${escapeHTML(data.observaciones || '')}
    </div>

    <div class="footer">
      <div>Rubik Creaciones SPA</div>
      <div>Documento generado desde ERP Rubik</div>
    </div>
  </div>
</body>
</html>
  `
}

module.exports = renderCotizacionHTML