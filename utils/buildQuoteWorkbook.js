const fs = require('node:fs')
const path = require('node:path')
const ExcelJS = require('exceljs')

const TEMPLATE_FILE_NAME = 'cotizacion-rubik.xlsx'
const DEFAULT_TEMPLATE_PATH = path.join(process.cwd(), 'public', 'templates', TEMPLATE_FILE_NAME)
const TEMPLATE_CANDIDATES = [
  DEFAULT_TEMPLATE_PATH,
  path.join(__dirname, '..', 'public', 'templates', TEMPLATE_FILE_NAME),
]

const ITEM_START_ROW = 17
const ITEM_TEMPLATE_ROW = 17
const LOWER_SECTION_START_ROW = 33
const AVAILABLE_ITEM_ROWS = LOWER_SECTION_START_ROW - ITEM_START_ROW - 1
const MONEY_FORMAT = '"$"#,##0'
const PRINT_LAST_COLUMN = 'H'
const PRINT_LAST_COLUMN_INDEX = 8
const A4_USABLE_PAGE_HEIGHT_POINTS = 800
const MAX_EXCEL_ROW_HEIGHT = 408
const COLUMN_WIDTHS = {
  A: 6.5,
  B: 22,
  C: 15,
  D: 15,
  E: 11,
  F: 10,
  G: 10,
  H: 13.5,
}

const findQuoteTemplatePath = () =>
  TEMPLATE_CANDIDATES.find((candidate) => fs.existsSync(candidate)) || DEFAULT_TEMPLATE_PATH

const cloneStyle = (style = {}) => JSON.parse(JSON.stringify(style))

const getNumber = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (value === null || value === undefined || value === '') {
    return 0
  }

  const normalized = String(value)
    .trim()
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.')

  return Number(normalized) || 0
}

const getText = (value) => String(value ?? '').trim()

const getCellValueText = (cell) => {
  const value = cell.value

  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'object') {
    if (value.text) {
      return getText(value.text)
    }

    if (value.result) {
      return getText(value.result)
    }

    if (Array.isArray(value.richText)) {
      return value.richText.map((textPart) => textPart.text || '').join('')
    }

    if (value.formula) {
      return getText(value.result || value.formula)
    }
  }

  return getText(value)
}

const getObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {})

const firstPresent = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== '') ?? undefined

const normalizeSearchText = (value) =>
  getText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

const parseInputDate = (value) => {
  const dateValue = firstPresent(value)

  if (!dateValue || dateValue instanceof Date) {
    return dateValue || ''
  }

  const text = getText(dateValue)

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const [year, month, day] = text.slice(0, 10).split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  if (/^\d{2}-\d{2}-\d{4}$/.test(text)) {
    const [day, month, year] = text.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  return text
}

const hasPresentValue = (value) => firstPresent(value) !== undefined

const safeUnmerge = (worksheet, range) => {
  try {
    worksheet.unMergeCells(range)
  } catch (_) {
    // Si no estaba combinado, no hacemos nada.
  }
}

const safeMerge = (worksheet, range) => {
  try {
    worksheet.mergeCells(range)
  } catch (_) {
    // Si ya estaba combinado, no hacemos nada.
  }
}

const parseMergeRange = (range) => {
  const match = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/)

  if (!match) {
    return null
  }

  return {
    startColumn: match[1],
    startRow: Number(match[2]),
    endColumn: match[3],
    endRow: Number(match[4]),
  }
}

const stringifyMergeRange = (range) =>
  `${range.startColumn}${range.startRow}:${range.endColumn}${range.endRow}`

const shiftMergeRangeRows = (range, rowOffset) =>
  stringifyMergeRange({
    ...range,
    startRow: range.startRow + rowOffset,
    endRow: range.endRow + rowOffset,
  })

const getMergeRangesFromRow = (worksheet, firstRow) =>
  Object.values(worksheet._merges || {})
    .map((merge) => parseMergeRange(merge.range))
    .filter((range) => range && range.startRow >= firstRow)
    .map(stringifyMergeRange)

const safeUnmergeRanges = (worksheet, ranges) => {
  ranges.forEach((range) => safeUnmerge(worksheet, range))
}

const safeMergeRanges = (worksheet, ranges) => {
  ranges.forEach((range) => safeMerge(worksheet, range))
}

const insertRowsBeforeLowerSection = (worksheet, extraRowsNeeded, lowerSectionStartRow = LOWER_SECTION_START_ROW) => {
  if (extraRowsNeeded <= 0) {
    return 0
  }

  const lowerSectionMergeRanges = getMergeRangesFromRow(worksheet, lowerSectionStartRow)
  const shiftedLowerSectionMergeRanges = lowerSectionMergeRanges
    .map(parseMergeRange)
    .filter(Boolean)
    .map((range) => shiftMergeRangeRows(range, extraRowsNeeded))

  safeUnmergeRanges(worksheet, lowerSectionMergeRanges)
  worksheet.spliceRows(
    lowerSectionStartRow,
    0,
    ...Array.from({ length: extraRowsNeeded }, () => []),
  )
  safeMergeRanges(worksheet, shiftedLowerSectionMergeRanges)

  return extraRowsNeeded
}

const copyRowStyle = (worksheet, sourceRowNumber, targetRowNumber) => {
  const sourceRow = worksheet.getRow(sourceRowNumber)
  const targetRow = worksheet.getRow(targetRowNumber)

  targetRow.height = sourceRow.height

  for (let col = 1; col <= 8; col += 1) {
    const sourceCell = sourceRow.getCell(col)
    const targetCell = targetRow.getCell(col)

    targetCell.style = cloneStyle(sourceCell.style)
    targetCell.numFmt = sourceCell.numFmt
    targetCell.alignment = cloneStyle(sourceCell.alignment)
    targetCell.border = cloneStyle(sourceCell.border)
    targetCell.fill = cloneStyle(sourceCell.fill)
    targetCell.font = cloneStyle(sourceCell.font)
  }
}

const clearItemRow = (worksheet, rowNumber) => {
  safeUnmerge(worksheet, `B${rowNumber}:D${rowNumber}`)
  safeUnmerge(worksheet, `F${rowNumber}:G${rowNumber}`)

  worksheet.getCell(`A${rowNumber}`).value = null
  worksheet.getCell(`B${rowNumber}`).value = null
  worksheet.getCell(`E${rowNumber}`).value = null
  worksheet.getCell(`F${rowNumber}`).value = null
  worksheet.getCell(`H${rowNumber}`).value = null

  safeMerge(worksheet, `B${rowNumber}:D${rowNumber}`)
  safeMerge(worksheet, `F${rowNumber}:G${rowNumber}`)
}

const findRowByLabel = (worksheet, label) => {
  const normalizedLabel = normalizeSearchText(label)

  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber)

    for (let col = 1; col <= 8; col += 1) {
      const value = normalizeSearchText(getCellValueText(row.getCell(col)))

      if (value === normalizedLabel) {
        return rowNumber
      }
    }
  }

  return null
}

const findCellByLabel = (worksheet, labels, options = {}) => {
  const normalizedLabels = labels.map(normalizeSearchText)
  const minRow = options.minRow || 1
  const maxRow = options.maxRow || worksheet.rowCount
  const minCol = options.minCol || 1
  const maxCol = options.maxCol || PRINT_LAST_COLUMN_INDEX

  for (let rowNumber = minRow; rowNumber <= maxRow; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber)

    for (let col = minCol; col <= maxCol; col += 1) {
      const value = normalizeSearchText(getCellValueText(row.getCell(col)))

      if (normalizedLabels.includes(value)) {
        return row.getCell(col)
      }
    }
  }

  return null
}

const getRightCell = (worksheet, cell, offset = 1) =>
  worksheet.getRow(cell.row).getCell(cell.col + offset)

const writeRightOfLabel = (worksheet, labels, value, defaultAddress, options = {}) => {
  const labelCell = findCellByLabel(worksheet, labels, options)
  const targetCell = labelCell ? getRightCell(worksheet, labelCell) : worksheet.getCell(defaultAddress)

  targetCell.value = value ?? ''
  return targetCell
}

const hasPrintableCellValue = (cell) => {
  const value = cell.value

  if (value === null || value === undefined || value === '') {
    return false
  }

  if (typeof value === 'object') {
    if (value.formula || value.result || value.text || value.hyperlink) {
      return true
    }

    if (Array.isArray(value.richText)) {
      return value.richText.some((textPart) => getText(textPart.text))
    }
  }

  return getText(cell.text || value).length > 0
}

const findLastContentRow = (worksheet) => {
  for (let rowNumber = worksheet.rowCount; rowNumber >= 1; rowNumber -= 1) {
    const row = worksheet.getRow(rowNumber)

    for (let col = 1; col <= PRINT_LAST_COLUMN_INDEX; col += 1) {
      if (hasPrintableCellValue(row.getCell(col))) {
        return rowNumber
      }
    }
  }

  return worksheet.rowCount
}

const estimateWrappedLines = (text, charactersPerLine) => {
  const normalizedText = getText(text)

  if (!normalizedText) {
    return 1
  }

  return normalizedText
    .split(/\r\n|\n|\r/)
    .reduce((lines, line) => lines + Math.max(1, Math.ceil(line.length / charactersPerLine)), 0)
}

const estimateItemRowHeight = (item, baseHeight = 22) => {
  const descriptionLines = estimateWrappedLines(item.description, 58)
  const observationLines = estimateWrappedLines(item.observations, 20)
  const estimatedLines = Math.max(1, descriptionLines, observationLines)

  return Math.max(baseHeight, Math.min(MAX_EXCEL_ROW_HEIGHT, estimatedLines * 14 + 10))
}

const getRowHeight = (worksheet, rowNumber) =>
  worksheet.getRow(rowNumber).height || worksheet.properties.defaultRowHeight || 15

const sumRowHeights = (worksheet, startRow, endRow) => {
  let total = 0

  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
    total += getRowHeight(worksheet, rowNumber)
  }

  return total
}

const addPageBreaks = (worksheet, lowerSectionRow, lastContentRow) => {
  worksheet.rowBreaks = []

  let currentPageHeight = 0

  for (let rowNumber = 1; rowNumber <= lastContentRow; rowNumber += 1) {
    const rowHeight = getRowHeight(worksheet, rowNumber)

    if (rowNumber === lowerSectionRow) {
      const lowerSectionHeight = sumRowHeights(worksheet, lowerSectionRow, lastContentRow)

      if (
        currentPageHeight > 0 &&
        currentPageHeight + lowerSectionHeight > A4_USABLE_PAGE_HEIGHT_POINTS
      ) {
        worksheet.getRow(rowNumber - 1).addPageBreak(1, PRINT_LAST_COLUMN_INDEX)
        currentPageHeight = 0
      }
    }

    if (
      rowNumber > ITEM_START_ROW &&
      rowNumber < lowerSectionRow &&
      currentPageHeight + rowHeight > A4_USABLE_PAGE_HEIGHT_POINTS
    ) {
      worksheet.getRow(rowNumber - 1).addPageBreak(1, PRINT_LAST_COLUMN_INDEX)
      currentPageHeight = 0
    }

    currentPageHeight += rowHeight
  }
}

const writeMoney = (cell, value) => {
  cell.value = Math.round(getNumber(value))
  cell.numFmt = MONEY_FORMAT
}

const findHeaderColumn = (row, labels) => {
  const normalizedLabels = labels.map(normalizeSearchText)

  for (let col = 1; col <= PRINT_LAST_COLUMN_INDEX; col += 1) {
    const value = normalizeSearchText(getCellValueText(row.getCell(col)))

    if (normalizedLabels.includes(value)) {
      return col
    }
  }

  return null
}

const detectItemTable = (worksheet) => {
  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber)
    const columns = {
      quantity: findHeaderColumn(row, ['Cantidad']),
      description: findHeaderColumn(row, ['Descripcion tecnica del producto / servicio', 'Descripcion', 'Descripción']),
      unitValue: findHeaderColumn(row, ['Valor Unitario', 'Valor unitario']),
      total: findHeaderColumn(row, ['Valor Total', 'Valor total']),
      observations: findHeaderColumn(row, ['Observaciones']),
    }

    if (columns.quantity && columns.description && columns.unitValue && columns.total) {
      return {
        headerRow: rowNumber,
        itemStartRow: rowNumber + 1,
        itemTemplateRow: rowNumber + 1,
        columns,
      }
    }
  }

  return {
    headerRow: ITEM_START_ROW - 1,
    itemStartRow: ITEM_START_ROW,
    itemTemplateRow: ITEM_TEMPLATE_ROW,
    columns: {
      quantity: 1,
      description: 2,
      unitValue: 5,
      total: 6,
      observations: 8,
    },
  }
}

const applyCenteredCellStyle = (cell, options = {}) => {
  cell.alignment = {
    ...(cell.alignment || {}),
    horizontal: options.horizontal || 'center',
    vertical: options.vertical || 'middle',
    wrapText: options.wrapText ?? true,
    shrinkToFit: false,
  }

  cell.font = {
    ...(cell.font || {}),
    name: options.fontName || 'Arial',
    size: options.fontSize || cell.font?.size || 10,
    bold: options.bold ?? cell.font?.bold ?? false,
  }
}

const applyHeaderSectionStyles = (worksheet) => {
  const centeredCells = [
    // Datos Rubik / cliente / cotización
    'C6',
    'C7',
    'C8',
    'C9',
    'C10',
    'C11',
    'C12',

    // Nº cotización / fecha / vendedor / datos cliente
    'F6',
    'F7',
    'F8',
    'F9',
    'F10',
    'F11',
    'F12',
  ]

  centeredCells.forEach((address) => {
    applyCenteredCellStyle(worksheet.getCell(address), {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
      fontName: 'Arial',
      fontSize: 10,
    })
  })

    // Estos son los campos que más se notaban desalineados en PDF:
    // cliente, atención, RUT, teléfono, comuna y condición.
    ;['C9', 'F9', 'F10', 'F11', 'F12'].forEach((address) => {
      applyCenteredCellStyle(worksheet.getCell(address), {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
        fontName: 'Arial',
        fontSize: 10,
      })
    })
}

const applyMoneyCellStyle = (cell) => {
  cell.alignment = {
    ...(cell.alignment || {}),
    horizontal: 'right',
    vertical: 'middle',
    wrapText: true,
    shrinkToFit: false,
  }

  cell.font = {
    ...(cell.font || {}),
    name: 'Arial',
  }
}

const unwrapPayload = (quotePayload = {}) => {
  const nestedPayload = getObject(quotePayload.payload)

  if (!Object.keys(nestedPayload).length) {
    return quotePayload
  }

  return {
    ...nestedPayload,
    ...quotePayload,
    amounts: quotePayload.amounts || nestedPayload.amounts,
    client: quotePayload.client || nestedPayload.client,
    company: quotePayload.company || nestedPayload.company,
    items: quotePayload.items || nestedPayload.items,
    quote: quotePayload.quote || nestedPayload.quote || nestedPayload.quoteData,
    quoteData: quotePayload.quoteData || nestedPayload.quoteData,
    quoteItems: quotePayload.quoteItems || nestedPayload.quoteItems,
    selectedSeller: quotePayload.selectedSeller || nestedPayload.selectedSeller,
    seller: quotePayload.seller || nestedPayload.seller,
  }
}

const normalizePayload = (inputPayload = {}) => {
  const quotePayload = unwrapPayload(inputPayload)
  const company = getObject(quotePayload.company || quotePayload.rubikCompany)

  const rawSeller =
    typeof quotePayload.seller === 'string'
      ? { name: quotePayload.seller }
      : getObject(quotePayload.seller || quotePayload.selectedSeller)

  const rawClient = getObject(quotePayload.client || quotePayload.customer || quotePayload.cliente)
  const rawQuote = getObject(quotePayload.quote || quotePayload.quoteData || quotePayload.cotizacion)

  const rawItems = Array.isArray(quotePayload.quoteItems)
    ? quotePayload.quoteItems
    : Array.isArray(quotePayload.items)
      ? quotePayload.items
      : Array.isArray(quotePayload.detalle)
        ? quotePayload.detalle
        : []

  const quoteItems = rawItems
    .filter((item) => {
      const description = getText(
        firstPresent(item.description, item.descripcion, item.technicalDescription, item.name),
      )
      const hasUnitValue = hasPresentValue(
        firstPresent(item.unitValue, item.unitPrice, item.valorUnitario, item.price),
      )
      const hasTotal = hasPresentValue(firstPresent(item.total, item.totalValue, item.valorTotal))
      const hasQuantity = getNumber(firstPresent(item.quantity, item.cantidad, item.qty)) > 0

      return description || hasUnitValue || hasTotal || hasQuantity
    })
    .map((item) => {
      const quantity = getNumber(firstPresent(item.quantity, item.cantidad, item.qty))
      const unitValue = getNumber(
        firstPresent(item.unitValue, item.unitPrice, item.valorUnitario, item.price),
      )
      const explicitTotal = firstPresent(item.total, item.totalValue, item.valorTotal)

      return {
        quantity,
        description: getText(
          firstPresent(item.description, item.descripcion, item.technicalDescription, item.name),
        ),
        unitValue,
        total: explicitTotal === undefined ? quantity * unitValue : getNumber(explicitTotal),
        observations: getText(firstPresent(item.observations, item.observaciones, item.notes)),
      }
    })

  const calculatedNet = quoteItems.reduce((sum, item) => sum + item.total, 0)
  const ivaRate = getNumber(firstPresent(rawQuote.ivaRate, quotePayload.ivaRate, 19)) || 19
  const rawAmounts = getObject(quotePayload.amounts)
  const netValue = firstPresent(rawAmounts.net, rawAmounts.neto, quotePayload.net, quotePayload.neto)
  const net = netValue === undefined ? calculatedNet : getNumber(netValue)
  const ivaValue = firstPresent(rawAmounts.iva, rawAmounts.tax, quotePayload.iva, quotePayload.taxAmount)
  const iva = ivaValue === undefined ? net * (ivaRate / 100) : getNumber(ivaValue)
  const totalValue = firstPresent(
    rawAmounts.total,
    rawAmounts.totalAmount,
    quotePayload.total,
    quotePayload.totalAmount,
  )
  const total = totalValue === undefined ? net + iva : getNumber(totalValue)

  return {
    company: {
      businessName: 'Rubik Creaciones SPA',
      phone: '93535395',
      email: 'contacto@rubikcreaciones.cl',
      rut: '77.589.233-1',
      address: 'Rubik Creaciones SPA',
      ...company,
    },
    seller: {
      ...rawSeller,
      name: getText(firstPresent(rawSeller.name, rawSeller.nombre, rawSeller.fullName)),
      email: getText(firstPresent(rawSeller.email, rawSeller.mail)),
    },
    client: {
      ...rawClient,
      name: getText(firstPresent(rawClient.client, rawClient.name, rawClient.nombre, rawClient.contact)),
      company: getText(
        firstPresent(rawClient.company, rawClient.empresa, rawClient.businessName, rawClient.razonSocial),
      ),
      attention: getText(firstPresent(rawClient.attention, rawClient.atencion, rawClient.contact)),
      rut: getText(firstPresent(rawClient.rut, rawClient.clientRut)),
      phone: getText(firstPresent(rawClient.phone, rawClient.telefono, rawClient.clientPhone)),
      commune: getText(firstPresent(rawClient.commune, rawClient.comuna)),
      email: getText(firstPresent(rawClient.email, rawClient.mail)),
      address: getText(firstPresent(rawClient.address, rawClient.direccion)),
    },
    quote: {
      ...rawQuote,
      quoteNumber: getText(
        firstPresent(rawQuote.quoteNumber, rawQuote.numero, quotePayload.quoteNumber, quotePayload.numero, '8103'),
      ),
      date: parseInputDate(firstPresent(rawQuote.date, rawQuote.fecha, quotePayload.date, quotePayload.fecha)),
      subject: getText(firstPresent(rawQuote.subject, rawQuote.tema, quotePayload.subject, quotePayload.tema)),
      condition: getText(
        firstPresent(rawQuote.condition, rawQuote.condicion, quotePayload.condition, quotePayload.condicion),
      ),
      observations: getText(
        firstPresent(
          rawQuote.observations,
          rawQuote.observaciones,
          rawQuote.notes,
          quotePayload.observations,
          quotePayload.observaciones,
          quotePayload.notes,
        ),
      ),
      ivaRate,
    },
    quoteItems,
    amounts: {
      ...(quotePayload.amounts || {}),
      net,
      iva,
      total,
    },
  }
}

const applyPrintSettings = (worksheet, rows) => {
  const { items, extraRowsInserted, netRow, ivaRow, totalRow, lowerSectionRow } = rows
  const lastContentRow = findLastContentRow(worksheet)
  const printArea = `A1:${PRINT_LAST_COLUMN}${lastContentRow}`

  Object.entries(COLUMN_WIDTHS).forEach(([column, width]) => {
    worksheet.getColumn(column).width = width
  })

  // El printArea ya limita A:H, pero ocultar columnas posteriores evita
  // que LibreOffice tome celdas residuales a la derecha como parte útil.
  for (let col = PRINT_LAST_COLUMN_INDEX + 1; col <= 30; col += 1) {
    worksheet.getColumn(col).hidden = true
  }

  worksheet.pageSetup = {
    ...worksheet.pageSetup,
    paperSize: 9,
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    verticalCentered: false,
    printArea,
    printTitlesRow: '16:16',
    margins: {
      left: 0.25,
      right: 0.25,
      top: 0.35,
      bottom: 0.35,
      header: 0,
      footer: 0,
    },
  }
  worksheet.properties.defaultRowHeight = 18

  addPageBreaks(worksheet, lowerSectionRow || lastContentRow + 1, lastContentRow)

  worksheet.views = [
    {
      showGridLines: false,
    },
  ]
}

const createTemplateError = (templatePath) => {
  const error = new Error(`Template ${TEMPLATE_FILE_NAME} was not found at ${templatePath}.`)
  error.code = 'QUOTE_TEMPLATE_NOT_FOUND'
  error.statusCode = 500
  return error
}

const assertQuoteTemplateReadable = async (templatePath = findQuoteTemplatePath()) => {
  if (!fs.existsSync(templatePath)) {
    throw createTemplateError(templatePath)
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(templatePath)

  return true
}

const createQuoteWorkbook = async (quotePayload, options = {}) => {
  const templatePath = options.templatePath || findQuoteTemplatePath()

  if (!fs.existsSync(templatePath)) {
    throw createTemplateError(templatePath)
  }

  const data = normalizePayload(quotePayload)

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(templatePath)

  const worksheet =
    workbook.getWorksheet('Cotizacion Rubik') ||
    workbook.getWorksheet('Cotización Rubik') ||
    workbook.worksheets[0]

  if (!worksheet) {
    throw new Error('No se encontró una hoja válida en la plantilla Excel.')
  }

  const items = data.quoteItems
  const itemTable = detectItemTable(worksheet)
  const initialLowerSectionRow =
    findRowByLabel(worksheet, 'DATOS DE TRANSFERENCIA') ||
    findRowByLabel(worksheet, 'NETO') ||
    LOWER_SECTION_START_ROW
  const availableItemRows = Math.max(1, initialLowerSectionRow - itemTable.itemStartRow - 1)

  if (!items.length) {
    const error = new Error('Agrega al menos un item valido antes de exportar.')
    error.code = 'QUOTE_ITEMS_REQUIRED'
    error.statusCode = 400
    throw error
  }

  const extraRowsNeeded = Math.max(0, items.length - availableItemRows)
  const extraRowsInserted = insertRowsBeforeLowerSection(worksheet, extraRowsNeeded, initialLowerSectionRow)

  const totalItemRows = availableItemRows + extraRowsInserted

  for (let index = 0; index < totalItemRows; index += 1) {
    const rowNumber = itemTable.itemStartRow + index

    copyRowStyle(worksheet, itemTable.itemTemplateRow, rowNumber)
    clearItemRow(worksheet, rowNumber)
  }
  /*desde acá se empiezan a insertar los items para los documentos*/

  writeRightOfLabel(worksheet, ['DIRECCION', 'DIRECCIÓN'], data.company.address || data.company.businessName, 'C6')
  writeRightOfLabel(worksheet, ['TELEFONO', 'TELÉFONO'], data.company.phone, 'C7')
  writeRightOfLabel(worksheet, ['EMAIL'], data.company.email, 'C8')
  writeRightOfLabel(worksheet, ['CLIENTE'], data.client.name || data.client.client || '', 'C9')
  writeRightOfLabel(worksheet, ['EMPRESA'], data.client.company || '', 'C10')
  writeRightOfLabel(worksheet, ['ATENCION', 'ATENCIÓN'], data.client.attention || '', 'C11')
  writeRightOfLabel(worksheet, ['TEMA'], data.quote.subject || data.quote.tema || '', 'C12')

  writeRightOfLabel(worksheet, ['N° COTIZACION', 'Nº COTIZACION', 'N COTIZACION'], data.quote.quoteNumber, 'F6')
  const dateCell = writeRightOfLabel(worksheet, ['FECHA'], data.quote.date, 'F7')
  if (data.quote.date instanceof Date) {
    dateCell.numFmt = 'dd-mm-yyyy'
  }
  writeRightOfLabel(worksheet, ['VENDEDOR'], data.seller.name || '', 'F8')
  writeRightOfLabel(worksheet, ['RUT CLIENTE'], data.client.rut || '', 'F9')
  writeRightOfLabel(worksheet, ['TELEFONO', 'TELÉFONO'], data.client.phone || '', 'F10', { minCol: 5 })
  writeRightOfLabel(worksheet, ['COMUNA'], data.client.commune || '', 'F11')
  writeRightOfLabel(worksheet, ['CONDICION', 'CONDICIÓN'], data.quote.condition || data.quote.condicion || '', 'F12')

  const clientExtraDetails = [
    data.client.email ? `Email cliente: ${data.client.email}` : '',
    data.client.address ? `Direccion cliente: ${data.client.address}` : '',
    data.quote.observations,
  ]
    .filter(Boolean)
    .join('\n')

  if (clientExtraDetails) {
    const notesRow = (findRowByLabel(worksheet, 'Notas comerciales') || 38) + 1
    const notesCell = worksheet.getCell(`A${notesRow}`)

    notesCell.value = clientExtraDetails
    notesCell.alignment = {
      ...(notesCell.alignment || {}),
      vertical: 'top',
      wrapText: true,
    }
  }

  applyHeaderSectionStyles(worksheet)

  items.forEach((item, index) => {
    const rowNumber = itemTable.itemStartRow + index

    safeUnmerge(worksheet, `B${rowNumber}:D${rowNumber}`)
    safeUnmerge(worksheet, `F${rowNumber}:G${rowNumber}`)

    safeMerge(worksheet, `B${rowNumber}:D${rowNumber}`)
    safeMerge(worksheet, `F${rowNumber}:G${rowNumber}`)

    const row = worksheet.getRow(rowNumber)
    const quantityCell = row.getCell(itemTable.columns.quantity)
    const descriptionCell = row.getCell(itemTable.columns.description)
    const unitValueCell = row.getCell(itemTable.columns.unitValue)
    const totalCell = row.getCell(itemTable.columns.total)
    const observationsCell = row.getCell(itemTable.columns.observations || 8)

    quantityCell.value = item.quantity
    descriptionCell.value = item.description
    unitValueCell.value = item.unitValue
    totalCell.value = item.total
    observationsCell.value = item.observations

    quantityCell.alignment = {
      ...quantityCell.alignment,
      vertical: 'top',
      horizontal: 'center',
    }

    descriptionCell.alignment = {
      ...descriptionCell.alignment,
      wrapText: true,
      shrinkToFit: false,
      vertical: 'top',
    }

    unitValueCell.numFmt = MONEY_FORMAT
    totalCell.numFmt = MONEY_FORMAT

    unitValueCell.alignment = {
      ...unitValueCell.alignment,
      vertical: 'top',
      horizontal: 'right',
    }

    totalCell.alignment = {
      ...totalCell.alignment,
      vertical: 'top',
      horizontal: 'right',
    }

    observationsCell.alignment = {
      ...observationsCell.alignment,
      wrapText: true,
      shrinkToFit: false,
      vertical: 'top',
    }

    worksheet.getRow(rowNumber).height = estimateItemRowHeight(item)
  })

  const netRow = findRowByLabel(worksheet, 'NETO')
  const ivaRow = findRowByLabel(worksheet, 'IVA 19%')
  const totalRow = findRowByLabel(worksheet, 'TOTAL')
  const lowerSectionRow = findRowByLabel(worksheet, 'DATOS DE TRANSFERENCIA') || netRow

  if (netRow) {
    writeMoney(worksheet.getCell(`F${netRow}`), data.amounts.net)
    applyMoneyCellStyle(worksheet.getCell(`F${netRow}`))
  }

  if (ivaRow) {
    writeMoney(worksheet.getCell(`F${ivaRow}`), data.amounts.iva)
    applyMoneyCellStyle(worksheet.getCell(`F${ivaRow}`))
  }

  if (totalRow) {
    writeMoney(worksheet.getCell(`F${totalRow}`), data.amounts.total)
    applyMoneyCellStyle(worksheet.getCell(`F${totalRow}`))
  }

  applyPrintSettings(worksheet, {
    items,
    extraRowsInserted,
    netRow,
    ivaRow,
    totalRow,
    lowerSectionRow,
  })

  return workbook
}

const buildQuoteWorkbook = async (quotePayload, options = {}) => {
  const workbook = await createQuoteWorkbook(quotePayload, options)
  const buffer = await workbook.xlsx.writeBuffer()

  return Buffer.from(buffer)
}

module.exports = {
  DEFAULT_TEMPLATE_PATH,
  TEMPLATE_FILE_NAME,
  assertQuoteTemplateReadable,
  buildQuoteWorkbook,
  createQuoteWorkbook,
  findQuoteTemplatePath,
}
