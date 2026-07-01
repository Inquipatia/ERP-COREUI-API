const express = require('express')
const { generateCotizacionPdfWithPdfkit } = require('../server/utils/generateCotizacionPdfWithPdfkit')
const { buildQuoteWorkbook } = require('../utils/buildQuoteWorkbook')
const { requireAuth, requirePermission } = require('../middleware/authMiddleware')
const {
  getDocumentExportPayloadById,
  getQuoteExportPayloadById,
} = require('../services/documentExportService')

const router = express.Router()
const EXCEL_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const sanitizeFilePart = (value = '') =>
  String(value || 'sin-numero')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 80)

const getQuoteNumber = (quote = {}) =>
  quote.quoteNumber || quote.numeroCotizacion || quote.numero || quote.folio || quote.number || 'sin-numero'

const hasBody = (body) => body && typeof body === 'object' && Object.keys(body).length > 0

const sendPdfBuffer = async (res, payload) => {
  const pdfBuffer = Buffer.from(await generateCotizacionPdfWithPdfkit(payload))
  const numero = sanitizeFilePart(getQuoteNumber(payload))

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="cotizacion-${numero}.pdf"`)
  res.setHeader('Content-Length', pdfBuffer.length)

  return res.send(pdfBuffer)
}

const sendExcelBuffer = async (res, payload) => {
  const excelBuffer = Buffer.from(await buildQuoteWorkbook(payload))
  const numero = sanitizeFilePart(getQuoteNumber(payload))

  res.setHeader('Content-Type', EXCEL_CONTENT_TYPE)
  res.setHeader('Content-Disposition', `attachment; filename="cotizacion-${numero}.xlsx"`)
  res.setHeader('Content-Length', excelBuffer.length)

  return res.send(excelBuffer)
}

router.get('/export/pdf-health', (_req, res) => {
  res.json({
    ok: true,
    engine: 'pdfkit',
    chromeRequired: false,
    libreOfficeRequired: false,
  })
})

async function handleCotizacionPdf(req, res) {
  if (!hasBody(req.body)) {
    return res.status(400).json({ error: 'No hay datos de cotizacion para generar PDF.' })
  }

  try {
    return sendPdfBuffer(res, req.body || {})
  } catch (error) {
    console.error('Error generando PDF con PDFKit:', error)

    return res.status(500).json({
      ok: false,
      message: 'Error generando PDF con PDFKit',
      error: error.message,
    })
  }
}

async function handleCotizacionExcel(req, res) {
  if (!hasBody(req.body)) {
    return res.status(400).json({ error: 'No hay datos de cotizacion para generar Excel.' })
  }

  try {
    return sendExcelBuffer(res, req.body || {})
  } catch (error) {
    console.error('Error generando Excel de cotizacion:', error)

    return res.status(error.statusCode || 500).json({
      ok: false,
      message: 'Error generando Excel de cotizacion',
      error: error.message,
    })
  }
}

const handleQuoteExportPdf = async (req, res, next) => {
  try {
    return sendPdfBuffer(res, await getQuoteExportPayloadById(req.params.id))
  } catch (error) {
    return next(error)
  }
}

const handleQuoteExportExcel = async (req, res, next) => {
  try {
    return sendExcelBuffer(res, await getQuoteExportPayloadById(req.params.id))
  } catch (error) {
    return next(error)
  }
}

const handleDocumentExportPdf = async (req, res, next) => {
  try {
    return sendPdfBuffer(res, await getDocumentExportPayloadById(req.params.id))
  } catch (error) {
    return next(error)
  }
}

const handleDocumentExportExcel = async (req, res, next) => {
  try {
    return sendExcelBuffer(res, await getDocumentExportPayloadById(req.params.id))
  } catch (error) {
    return next(error)
  }
}

router.post('/export/pdf', handleCotizacionPdf)
router.post('/export/excel', handleCotizacionExcel)
router.post('/excel', handleCotizacionExcel)
router.post('/pdf', handleCotizacionPdf)
router.post('/cotizacion', handleCotizacionPdf)
router.post('/cotizacion/pdf', handleCotizacionPdf)
router.post('/cotizacion/excel', handleCotizacionExcel)
router.get('/export/quotes/:id/pdf', requireAuth, requirePermission('quotes.view'), handleQuoteExportPdf)
router.get('/export/quotes/:id/excel', requireAuth, requirePermission('quotes.view'), handleQuoteExportExcel)
router.get('/export/documents/:id/pdf', requireAuth, requirePermission('documents.view'), handleDocumentExportPdf)
router.get('/export/documents/:id/excel', requireAuth, requirePermission('documents.view'), handleDocumentExportExcel)

module.exports = router
