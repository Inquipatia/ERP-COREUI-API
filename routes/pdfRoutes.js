const express = require('express')
const fs = require('node:fs')
const {
  DEFAULT_TEMPLATE_PATH,
  assertQuoteTemplateReadable,
  buildQuoteWorkbook,
  findQuoteTemplatePath,
} = require('../utils/buildQuoteWorkbook')
const {
  CONVERSION_ERROR_MESSAGE,
  convertWorkbookToPdf,
  getLibreOfficeInfo,
} = require('../utils/convertWorkbookToPdf')
const {
  PUPPETEER_PDF_ERROR_MESSAGE,
  generateCotizacionPdfWithPuppeteer,
  getPuppeteerInfo,
} = require('../utils/generateCotizacionPdfWithPuppeteer')

const router = express.Router()

const PDF_CONTENT_TYPE = 'application/pdf'

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

const getPdfFileName = (quoteNumber) => `cotizacion-${safeFileName(quoteNumber)}.pdf`

const sendPdfBuffer = (response, pdfBuffer, fileName, generator) => {
  response.setHeader('Content-Type', PDF_CONTENT_TYPE)
  response.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
  response.setHeader('Content-Length', Buffer.byteLength(pdfBuffer))
  response.setHeader('X-Rubik-Pdf-Generator', generator)
  response.send(pdfBuffer)
}

const generatePdfWithLibreOfficeFallback = async (payload, quoteNumber) => {
  const xlsxBuffer = await buildQuoteWorkbook(payload)
  return convertWorkbookToPdf(xlsxBuffer, quoteNumber)
}

const generateQuotePdf = async (payload, quoteNumber) => {
  try {
    return {
      buffer: await generateCotizacionPdfWithPuppeteer(payload),
      generator: 'puppeteer-html',
    }
  } catch (puppeteerError) {
    console.error('Puppeteer PDF generation failed. Trying LibreOffice fallback:', puppeteerError)
  }

  return {
    buffer: await generatePdfWithLibreOfficeFallback(payload, quoteNumber),
    generator: 'libreoffice-xlsx-fallback',
  }
}

const handlePdfRequest = async (request, response) => {
  if (!request.body || Object.keys(request.body).length === 0) {
    response.status(400).json({ ok: false, message: 'Quote payload is required' })
    return
  }

  const quoteNumber = getQuoteNumber(request.body)
  const fileName = getPdfFileName(quoteNumber)

  try {
    const { buffer, generator } = await generateQuotePdf(request.body, quoteNumber)
    sendPdfBuffer(response, buffer, fileName, generator)
  } catch (error) {
    console.error('Quote PDF generation failed:', error)

    const statusCode = error.statusCode || 500
    const code = error.code || 'PDF_GENERATION_FAILED'
    const message =
      error.code === 'PDF_CONVERSION_UNAVAILABLE'
        ? CONVERSION_ERROR_MESSAGE
        : error.code === 'PUPPETEER_PDF_UNAVAILABLE'
          ? PUPPETEER_PDF_ERROR_MESSAGE
          : error.message || 'No se pudo generar la cotizacion PDF.'

    response.status(statusCode).json({
      ok: false,
      code,
      message,
    })
  }
}

const getExportStatus = async () => {
  const templatePath = findQuoteTemplatePath()
  const templateFound = fs.existsSync(templatePath)
  let canGenerateXlsx = false
  const [libreOfficeInfo, puppeteerInfo] = await Promise.all([
    getLibreOfficeInfo(),
    getPuppeteerInfo(),
  ])

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
    canGenerateHtmlPdf: puppeteerInfo.canGeneratePdf,
    puppeteerError: puppeteerInfo.error,
    canConvertPdf: libreOfficeInfo.canConvertPdf,
    libreOfficePath: libreOfficeInfo.libreOfficePath,
    mode: 'html-puppeteer-with-xlsx-libreoffice-fallback',
  }
}

router.get('/export-pdf/status', async (_request, response) => {
  response.json(await getExportStatus())
})

router.get('/export/pdf/status', async (_request, response) => {
  response.json(await getExportStatus())
})

router.post('/export-pdf', handlePdfRequest)
router.post('/export/pdf', handlePdfRequest)

module.exports = router
