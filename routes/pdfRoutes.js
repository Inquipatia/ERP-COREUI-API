const express = require('express')
const fs = require('node:fs')
const {
  DEFAULT_TEMPLATE_PATH,
  assertQuoteTemplateReadable,
  buildQuoteWorkbook,
  findQuoteTemplatePath,
} = require('../utils/buildQuoteWorkbook')

const router = express.Router()

const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const safeFileName = (value) =>
  String(value || '8103')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')

const getQuoteNumber = (payload = {}) => {
  const quote = payload.quote || payload.quoteData || payload.payload?.quote || payload.payload?.quoteData || {}

  return safeFileName(
    quote.quoteNumber ||
      quote.numero ||
      payload.quoteNumber ||
      payload.numero ||
      payload.payload?.quoteNumber ||
      payload.payload?.numero ||
      '8103',
  )
}

const getExportStatus = async () => {
  const templatePath = findQuoteTemplatePath()
  const templateFound = fs.existsSync(templatePath)
  let canGenerateXlsx = false

  if (templateFound) {
    try {
      await assertQuoteTemplateReadable(templatePath)
      canGenerateXlsx = true
    } catch (error) {
      canGenerateXlsx = false
    }
  }

  return {
    ok: true,
    templateFound,
    templatePath: templateFound ? templatePath : DEFAULT_TEMPLATE_PATH,
    canGenerateXlsx,
  }
}

router.get('/export-pdf/status', async (_request, response) => {
  response.json(await getExportStatus())
})

router.post('/export-pdf', async (request, response) => {
  if (!request.body || Object.keys(request.body).length === 0) {
    response.status(400).json({ ok: false, message: 'Quote payload is required' })
    return
  }

  const quoteNumber = getQuoteNumber(request.body)
  const fileName = `Cotizacion-Rubik-${quoteNumber}.xlsx`

  try {
    const xlsxBuffer = await buildQuoteWorkbook(request.body)

    response.setHeader('Content-Type', XLSX_CONTENT_TYPE)
    response.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    response.setHeader('Content-Length', Buffer.byteLength(xlsxBuffer))
    response.send(xlsxBuffer)
  } catch (error) {
    response.status(error.statusCode || 500).json({
      ok: false,
      message: error.message || 'No se pudo generar la cotizacion XLSX.',
    })
  }
})

module.exports = router
