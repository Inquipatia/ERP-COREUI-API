const express = require('express')
const { generateCotizacionPdfWithPdfkit } = require('../server/utils/generateCotizacionPdfWithPdfkit')

const router = express.Router()

const sanitizeFilePart = (value = '') =>
  String(value || 'sin-numero')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 80)

const getQuoteNumber = (quote = {}) =>
  quote.quoteNumber || quote.numeroCotizacion || quote.numero || quote.folio || quote.number || 'sin-numero'

const hasBody = (body) => body && typeof body === 'object' && Object.keys(body).length > 0

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
    const data = req.body || {}
    const pdfBuffer = Buffer.from(await generateCotizacionPdfWithPdfkit(data))
    const numero = sanitizeFilePart(getQuoteNumber(data))

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="cotizacion-${numero}.pdf"`)
    res.setHeader('Content-Length', pdfBuffer.length)

    return res.send(pdfBuffer)
  } catch (error) {
    console.error('Error generando PDF con PDFKit:', error)

    return res.status(500).json({
      ok: false,
      message: 'Error generando PDF con PDFKit',
      error: error.message,
    })
  }
}

router.post('/export/pdf', handleCotizacionPdf)
router.post('/pdf', handleCotizacionPdf)
router.post('/cotizacion', handleCotizacionPdf)
router.post('/cotizacion/pdf', handleCotizacionPdf)

module.exports = router
