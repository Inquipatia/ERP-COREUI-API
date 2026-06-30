const fs = require('node:fs')
const path = require('node:path')
const PDFDocument = require('pdfkit')
const ExcelJS = require('exceljs')

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 24
const CONTENT_WIDTH = 531
const CONTENT_X = (PAGE_WIDTH - CONTENT_WIDTH) / 2
const PAGE = {
  size: 'A4',
  layout: 'portrait',
  margin: MARGIN,
}

const COLORS = {
  blue: '#201579',
  border: '#6D5CFF',
  header: '#E80F7A',
  lightPink: '#FCE8F4',
  text: '#182033',
  muted: '#5F53CF',
  softGray: '#F2F2F2',
  white: '#FFFFFF',
}

const COMPANY = {
  address: 'Rubik Creaciones SPA',
  phone: '93535395',
  email: 'e.rubikcreaciones@gmail.com',
  rut: '77.589.233-1',
  bank: 'Banco BCI - CTA. CORRIENTE 63730588',
  transferContact: 'RUT 77.589.233-1 - contacto@rubikcreaciones.cl',
  website: 'www.rubikcreaciones.cl',
}

const projectRoot = path.join(__dirname, '..', '..')
const frontendProjectRoot = path.join(projectRoot, '..', 'coreui-free-react-admin-template')
const extractedLogoPath = path.join(projectRoot, 'public', 'templates', 'rubik-logo.png')

const logoCandidates = [
  path.join(projectRoot, 'public', 'templates', 'rubik-logo.png'),
  path.join(projectRoot, 'public', 'templates', 'logo-rubik.png'),
  path.join(projectRoot, 'public', 'logo.png'),
  path.join(projectRoot, 'assets', 'rubik-logo.png'),
  path.join(projectRoot, 'server', 'assets', 'rubik-logo.png'),
]

const devLogoCandidates = [
  path.join(frontendProjectRoot, 'public', 'templates', 'rubik-logo.png'),
  path.join(frontendProjectRoot, 'public', 'templates', 'logo-rubik.png'),
  path.join(frontendProjectRoot, 'public', 'logo.png'),
  path.join(frontendProjectRoot, 'assets', 'rubik-logo.png'),
  path.join(frontendProjectRoot, 'server', 'assets', 'rubik-logo.png'),
  path.join(frontendProjectRoot, 'src', 'assets', 'brand', 'rubik-logo.png'),
]

const templateCandidates = [
  path.join(projectRoot, 'public', 'templates', 'cotizacion-rubik.xlsx'),
  path.join(projectRoot, 'templates', 'cotizacion-rubik.xlsx'),
  path.join(frontendProjectRoot, 'public', 'templates', 'cotizacion-rubik.xlsx'),
]

const fontCandidates = {
  regular: [
    'C:\\Windows\\Fonts\\arial.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
  ],
  bold: [
    'C:\\Windows\\Fonts\\arialbd.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
  ],
}

const FONTS = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
}

const table = {
  x: CONTENT_X,
  y: 318,
  widths: [50, 245, 78, 78, 80],
  headerHeight: 24,
  minRowHeight: 20,
  templateBottomY: 500,
}

const tableWidth = table.widths.reduce((sum, width) => sum + width, 0)

const safeText = (value = '') => String(value ?? '').trim()

const numberValue = (value) => {
  if (value === '' || value === null || value === undefined) return 0

  const parsed = Number(
    String(value)
      .replace(/\s/g, '')
      .replace(/\$/g, '')
      .replace(/\./g, '')
      .replace(',', '.'),
  )

  return Number.isFinite(parsed) ? parsed : 0
}

const formatCurrency = (value) =>
  `$${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(Math.round(numberValue(value)))}`

const formatDate = (value) => {
  if (!value) return ''
  const rawValue = safeText(value)
  const isoDateMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoDateMatch) return `${isoDateMatch[3]}-${isoDateMatch[2]}-${isoDateMatch[1]}`

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return rawValue

  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

const getQuoteNumber = (quote = {}) =>
  safeText(quote.quoteNumber || quote.numeroCotizacion || quote.numero || quote.number || 'sin-numero')

const getItems = (quote = {}) => {
  if (Array.isArray(quote.items)) return quote.items
  if (Array.isArray(quote.quoteItems)) return quote.quoteItems
  return []
}

const itemQuantity = (item = {}) => numberValue(item.quantity ?? item.cantidad ?? item.qty)

const itemUnitValue = (item = {}) =>
  numberValue(item.unitValue ?? item.valorUnitario ?? item.unitPrice ?? item.price)

const itemDescription = (item = {}) =>
  safeText(item.description || item.descripcion || item.technicalDescription || item.name || '')

const itemObservations = (item = {}) =>
  safeText(item.observations || item.observaciones || item.notes || '')

const itemTotal = (item = {}) => {
  const explicitTotal = item.total ?? item.totalValue ?? item.valorTotal
  if (explicitTotal !== undefined && explicitTotal !== null && explicitTotal !== '') {
    return numberValue(explicitTotal)
  }

  return itemQuantity(item) * itemUnitValue(item)
}

const getTotals = (quote = {}) => {
  const items = getItems(quote)
  const calculatedNet = items.reduce((sum, item) => sum + itemTotal(item), 0)

  const netAmount = numberValue(quote.netAmount ?? quote.neto ?? quote.amounts?.net ?? calculatedNet)
  const taxAmount = numberValue(quote.taxAmount ?? quote.iva ?? quote.amounts?.iva ?? Math.round(netAmount * 0.19))
  const totalAmount = numberValue(quote.totalAmount ?? quote.total ?? quote.amounts?.total ?? netAmount + taxAmount)

  return { netAmount, taxAmount, totalAmount }
}

const findExistingPath = (candidates) => candidates.find((candidate) => fs.existsSync(candidate))

const extractLogoFromTemplate = async () => {
  const templatePath = findExistingPath(templateCandidates)
  if (!templatePath) return ''

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(templatePath)

  const media = workbook.model?.media || []
  const image = media.find((item) => item.type === 'image' && item.buffer)
  if (!image) return ''

  fs.mkdirSync(path.dirname(extractedLogoPath), { recursive: true })
  fs.writeFileSync(extractedLogoPath, image.buffer)

  return extractedLogoPath
}

const resolveLogoPath = async () =>
  findExistingPath(logoCandidates) || (await extractLogoFromTemplate()) || findExistingPath(devLogoCandidates)

const registerFonts = (doc) => {
  const regularPath = findExistingPath(fontCandidates.regular)
  const boldPath = findExistingPath(fontCandidates.bold)

  if (regularPath) {
    doc.registerFont('RubikRegular', regularPath)
    FONTS.regular = 'RubikRegular'
  }

  if (boldPath) {
    doc.registerFont('RubikBold', boldPath)
    FONTS.bold = 'RubikBold'
  }
}

const rect = (doc, x, y, width, height, options = {}) => {
  doc.save()

  if (options.fill) {
    doc.rect(x, y, width, height).fill(options.fill)
  }

  if (options.stroke) {
    doc
      .lineWidth(options.lineWidth || 0.55)
      .strokeColor(options.stroke)
      .rect(x, y, width, height)
      .stroke()
  }

  doc.restore()
}

const text = (doc, value, x, y, options = {}) => {
  const textOptions = {
    width: options.width,
    align: options.align || 'left',
    lineGap: options.lineGap || 0,
  }

  if (options.height !== undefined) {
    textOptions.height = options.height
  }

  doc
    .fillColor(options.color || COLORS.text)
    .font(options.bold ? FONTS.bold : FONTS.regular)
    .fontSize(options.size || 9)
    .text(safeText(value), x, y, textOptions)
}

const centerText = (doc, value, x, y, width, options = {}) =>
  text(doc, value, x, y, { ...options, align: 'center', width })

const rightText = (doc, value, x, y, width, options = {}) =>
  text(doc, value, x, y, { ...options, align: 'right', width })

const pageBottom = (doc) => doc.page.height - MARGIN

const drawFallbackLogo = (doc, x, y, width) => {
  centerText(doc, 'R U B I K', x, y, width, {
    color: COLORS.header,
    size: 30,
    bold: true,
  })

  centerText(doc, 'C R E A C I O N E S', x, y + 31, width, {
    color: COLORS.blue,
    size: 12,
    bold: true,
  })

  centerText(doc, 'IMPRESIÓN - VOLUMÉTRICOS - STANDS - NEONFLEX Y MÁS', x, y + 52, width, {
    color: COLORS.header,
    size: 7.4,
    bold: true,
  })
}

const drawLabelValueRow = (doc, x, y, labelWidth, valueWidth, rowHeight, label, value) => {
  rect(doc, x, y, labelWidth, rowHeight, { fill: COLORS.softGray, stroke: COLORS.border })
  rect(doc, x + labelWidth, y, valueWidth, rowHeight, { fill: COLORS.white, stroke: COLORS.border })

  text(doc, label, x + 4, y + 5.2, {
    bold: true,
    color: COLORS.blue,
    size: 7.1,
    width: labelWidth - 8,
  })

  centerText(doc, value, x + labelWidth + 4, y + 5.2, valueWidth - 8, {
    color: COLORS.text,
    size: 7.7,
  })
}

const drawHeader = (doc, quote, logoPath) => {
  const leftX = CONTENT_X
  const topY = 24
  const quoteBlockWidth = 230
  const quoteBlockX = CONTENT_X + CONTENT_WIDTH - quoteBlockWidth
  const logoWidth = CONTENT_WIDTH - quoteBlockWidth - 8
  const rowHeight = 19

  if (logoPath) {
    try {
      doc.image(logoPath, leftX + 5, topY + 2, {
        fit: [logoWidth - 10, 90],
        align: 'center',
        valign: 'center',
      })
    } catch (_error) {
      drawFallbackLogo(doc, leftX, topY + 2, logoWidth)
    }
  } else {
    drawFallbackLogo(doc, leftX, topY + 2, logoWidth)
  }

  rect(doc, quoteBlockX, topY, quoteBlockWidth, 50, {
    fill: COLORS.lightPink,
    stroke: COLORS.border,
    lineWidth: 0.75,
  })

  centerText(doc, 'COTIZACIÓN', quoteBlockX, topY + 14, quoteBlockWidth, {
    bold: true,
    color: COLORS.blue,
    size: 18,
  })

  rect(doc, quoteBlockX, topY + 50, quoteBlockWidth, 44, {
    fill: COLORS.white,
    stroke: COLORS.border,
    lineWidth: 0.75,
  })

  centerText(doc, `RUT: ${COMPANY.rut}`, quoteBlockX, topY + 64, quoteBlockWidth, {
    bold: true,
    color: COLORS.blue,
    size: 11.5,
  })

  const leftWidth = 300
  const rightWidth = CONTENT_WIDTH - leftWidth
  const rightX = leftX + leftWidth
  const leftLabel = 74
  const rightLabel = 76
  const valueLeft = leftWidth - leftLabel
  const valueRight = rightWidth - rightLabel
  const baseY = 124

  drawLabelValueRow(doc, leftX, baseY, leftLabel, valueLeft, rowHeight, 'DIRECCIÓN', COMPANY.address)
  drawLabelValueRow(doc, leftX, baseY + rowHeight, leftLabel, valueLeft, rowHeight, 'TELÉFONO', COMPANY.phone)
  drawLabelValueRow(doc, leftX, baseY + rowHeight * 2, leftLabel, valueLeft, rowHeight, 'EMAIL', COMPANY.email)
  drawLabelValueRow(doc, leftX, baseY + rowHeight * 3, leftLabel, valueLeft, rowHeight, 'CLIENTE', quote.client || quote.cliente)
  drawLabelValueRow(doc, leftX, baseY + rowHeight * 4, leftLabel, valueLeft, rowHeight, 'EMPRESA', quote.company || quote.empresa)
  drawLabelValueRow(doc, leftX, baseY + rowHeight * 5, leftLabel, valueLeft, rowHeight, 'ATENCIÓN', quote.contact || quote.atencion)
  drawLabelValueRow(doc, leftX, baseY + rowHeight * 6, leftLabel, valueLeft, rowHeight, 'TEMA', quote.subject || quote.tema)

  drawLabelValueRow(doc, rightX, baseY, rightLabel, valueRight, rowHeight, 'N° COTIZACIÓN', getQuoteNumber(quote))
  drawLabelValueRow(doc, rightX, baseY + rowHeight, rightLabel, valueRight, rowHeight, 'FECHA', formatDate(quote.date || quote.fecha))
  drawLabelValueRow(doc, rightX, baseY + rowHeight * 2, rightLabel, valueRight, rowHeight, 'VENDEDOR', quote.seller || quote.vendedor)
  drawLabelValueRow(doc, rightX, baseY + rowHeight * 3, rightLabel, valueRight, rowHeight, 'RUT CLIENTE', quote.rut || quote.rutCliente)
  drawLabelValueRow(doc, rightX, baseY + rowHeight * 4, rightLabel, valueRight, rowHeight, 'TELÉFONO', quote.phone || quote.telefono)
  drawLabelValueRow(doc, rightX, baseY + rowHeight * 5, rightLabel, valueRight, rowHeight, 'COMUNA', quote.commune || quote.comuna)
  drawLabelValueRow(doc, rightX, baseY + rowHeight * 6, rightLabel, valueRight, rowHeight, 'CONDICIÓN', quote.condition || quote.condicion)

  rect(doc, leftX, baseY + rowHeight * 7, CONTENT_WIDTH, 44, {
    fill: COLORS.lightPink,
    stroke: COLORS.border,
  })

  centerText(doc, 'Cotización según solicitud', leftX, baseY + rowHeight * 7 + 13, CONTENT_WIDTH, {
    bold: true,
    color: COLORS.blue,
    size: 13.5,
  })
}

const drawTableHeader = (doc, y) => {
  const headers = [
    'Cantidad',
    'Descripción técnica del producto / servicio',
    'Valor Unitario',
    'Valor Total',
    'Observaciones',
  ]

  let x = table.x

  headers.forEach((header, index) => {
    const width = table.widths[index]

    rect(doc, x, y, width, table.headerHeight, {
      fill: COLORS.header,
      stroke: COLORS.border,
    })

    centerText(doc, header, x + 3, y + 7, width - 6, {
      bold: true,
      color: COLORS.white,
      size: index === 1 ? 7.3 : 6.8,
    })

    x += width
  })
}

const getItemRowHeight = (doc, item) => {
  doc.font(FONTS.regular).fontSize(7.2)

  const descriptionHeight = doc.heightOfString(itemDescription(item), {
    width: table.widths[1] - 10,
    lineGap: 1,
  })

  const observationsHeight = doc.heightOfString(itemObservations(item), {
    width: table.widths[4] - 10,
    lineGap: 1,
  })

  return Math.max(table.minRowHeight, descriptionHeight + 10, observationsHeight + 10)
}

const drawEmptyItemRow = (doc, y, height = table.minRowHeight) => {
  let x = table.x

  table.widths.forEach((width) => {
    rect(doc, x, y, width, height, {
      fill: COLORS.white,
      stroke: COLORS.border,
    })
    x += width
  })
}

const drawItemRow = (doc, item, y, height) => {
  const values = [
    { value: itemQuantity(item) || '', align: 'center' },
    { value: itemDescription(item), align: 'left' },
    { value: formatCurrency(itemUnitValue(item)), align: 'right' },
    { value: formatCurrency(itemTotal(item)), align: 'right' },
    { value: itemObservations(item), align: 'left' },
  ]

  let x = table.x

  values.forEach((cell, index) => {
    const width = table.widths[index]

    rect(doc, x, y, width, height, {
      fill: COLORS.white,
      stroke: COLORS.border,
    })

    text(doc, cell.value, x + 5, y + 4.5, {
      align: cell.align,
      color: COLORS.text,
      size: 7.2,
      width: width - 10,
      lineGap: 1,
    })

    x += width
  })
}

const addContinuationPage = (doc) => {
  doc.addPage(PAGE)
  drawTableHeader(doc, 34)
  return 34 + table.headerHeight
}

const drawTemplateEmptyRows = (doc, y) => {
  let nextY = y

  while (nextY + table.minRowHeight <= table.templateBottomY) {
    drawEmptyItemRow(doc, nextY)
    nextY += table.minRowHeight
  }

  return nextY
}

const drawItemsTable = (doc, quote) => {
  const items = getItems(quote)
  const bottomLimit = pageBottom(doc) - 8
  let y = table.y
  let usedContinuationPage = false

  drawTableHeader(doc, y)
  y += table.headerHeight

  if (!items.length) {
    drawEmptyItemRow(doc, y, 30)
    centerText(doc, 'Sin ítems ingresados.', table.x, y + 9, tableWidth, {
      color: COLORS.text,
      size: 8.5,
    })
    return drawTemplateEmptyRows(doc, y + 30)
  }

  items.forEach((item) => {
    const rowHeight = getItemRowHeight(doc, item)

    if (y + rowHeight > bottomLimit) {
      y = addContinuationPage(doc)
      usedContinuationPage = true
    }

    drawItemRow(doc, item, y, rowHeight)
    y += rowHeight
  })

  if (!usedContinuationPage && items.length <= 5) {
    return drawTemplateEmptyRows(doc, y)
  }

  return y
}

const ensureSpace = (doc, y, neededHeight) => {
  if (y + neededHeight <= pageBottom(doc)) return y

  doc.addPage(PAGE)
  return 34
}

const drawBottomBlocks = (doc, quote, startY) => {
  const { netAmount, taxAmount, totalAmount } = getTotals(quote)
  const x = table.x
  const transferWidth = 300
  const totalsX = x + transferWidth
  const totalsWidth = tableWidth - transferWidth
  const totalLabelWidth = 74
  const rowHeight = 22

  let y = ensureSpace(doc, startY, 245)

  rect(doc, x, y, tableWidth, 16, {
    fill: COLORS.lightPink,
    stroke: COLORS.border,
  })

  y += 16

  rect(doc, x, y, transferWidth, rowHeight * 4, {
    fill: COLORS.white,
    stroke: COLORS.border,
  })

  centerText(doc, 'DATOS DE TRANSFERENCIA', x, y + 9, transferWidth, {
    bold: true,
    color: COLORS.blue,
    size: 9.7,
  })

  centerText(doc, COMPANY.bank, x, y + 33, transferWidth, {
    color: COLORS.muted,
    size: 8.1,
  })

  centerText(doc, COMPANY.transferContact, x, y + 53, transferWidth, {
    color: COLORS.muted,
    size: 8.1,
  })

  centerText(doc, COMPANY.website, x, y + 73, transferWidth, {
    color: COLORS.muted,
    size: 8.1,
  })

  const totalRows = [
    ['NETO', formatCurrency(netAmount), false],
    ['IVA 19%', formatCurrency(taxAmount), false],
    ['TOTAL', formatCurrency(totalAmount), true],
  ]

  totalRows.forEach(([label, value, highlight], index) => {
    const rowY = y + index * rowHeight

    rect(doc, totalsX, rowY, totalLabelWidth, rowHeight, {
      fill: highlight ? COLORS.lightPink : COLORS.softGray,
      stroke: COLORS.border,
    })

    rect(doc, totalsX + totalLabelWidth, rowY, totalsWidth - totalLabelWidth, rowHeight, {
      fill: highlight ? COLORS.lightPink : COLORS.white,
      stroke: COLORS.border,
    })

    text(doc, label, totalsX + 5, rowY + 6.2, {
      bold: true,
      color: COLORS.blue,
      size: highlight ? 10.3 : 9.1,
      width: totalLabelWidth - 10,
    })

    rightText(doc, value, totalsX + totalLabelWidth + 5, rowY + 6.2, totalsWidth - totalLabelWidth - 10, {
      bold: true,
      color: COLORS.blue,
      size: highlight ? 10.3 : 9.1,
    })
  })

  y += rowHeight * 4
  y = ensureSpace(doc, y + 8, 76)

  rect(doc, x, y, tableWidth, 22, {
    fill: COLORS.lightPink,
    stroke: COLORS.border,
  })

  text(doc, 'Notas comerciales', x + 5, y + 6.5, {
    bold: true,
    color: COLORS.blue,
    size: 9.5,
    width: tableWidth - 10,
  })

  rect(doc, x, y + 22, tableWidth, 54, {
    fill: COLORS.white,
    stroke: COLORS.border,
  })

  text(
    doc,
    '• Valores incluyen IVA, salvo indicación contraria. • Plazo de entrega sujeto a aprobación de arte y disponibilidad de materiales. • Instalación/despacho se considera solo si está indicado en la descripción.',
    x + 6,
    y + 32,
    {
      color: COLORS.text,
      size: 7.7,
      width: tableWidth - 12,
      lineGap: 2,
    },
  )

  const observations = safeText(quote.observations || quote.observaciones)

  if (observations) {
    doc.font(FONTS.regular).fontSize(7.8)
    const observationTextHeight = doc.heightOfString(observations, {
      width: tableWidth - 12,
      lineGap: 1,
    })
    const observationHeight = Math.max(44, observationTextHeight + 30)
    const obsY = ensureSpace(doc, y + 84, observationHeight)

    rect(doc, x, obsY, tableWidth, 21, {
      fill: COLORS.lightPink,
      stroke: COLORS.border,
    })

    text(doc, 'Observaciones', x + 5, obsY + 6.5, {
      bold: true,
      color: COLORS.blue,
      size: 9.5,
    })

    rect(doc, x, obsY + 21, tableWidth, observationHeight - 21, {
      fill: COLORS.white,
      stroke: COLORS.border,
    })

    text(doc, observations, x + 6, obsY + 29, {
      color: COLORS.text,
      size: 7.8,
      width: tableWidth - 12,
      lineGap: 1,
    })
  }
}

const generateCotizacionPdfWithPdfkit = async (quote = {}) => {
  const logoPath = await resolveLogoPath()

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      ...PAGE,
      bufferPages: false,
    })

    registerFonts(doc)

    const chunks = []

    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    try {
      drawHeader(doc, quote, logoPath)
      const tableEndY = drawItemsTable(doc, quote)
      drawBottomBlocks(doc, quote, tableEndY)
      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}

module.exports = {
  generateCotizacionPdfWithPdfkit,
}
