const express = require('express')
const generateCotizacionPdfWithPuppeteer = require('../utils/generateCotizacionPdfWithPuppeteer')

const router = express.Router()

async function handleCotizacionPdf(req, res) {
  try {
    const data = req.body || {}

    const pdfBuffer = Buffer.from(await generateCotizacionPdfWithPuppeteer(data))

    const numero = data.numero || data.folio || data.quoteNumber || data.quote?.quoteNumber || 'rubik'

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="cotizacion-${numero}.pdf"`
    )
    res.setHeader('Content-Length', pdfBuffer.length)
    res.setHeader('X-Rubik-Pdf-Generator', 'puppeteer-html')

    return res.send(pdfBuffer)
  } catch (error) {
    console.error('Error generando PDF con Puppeteer:', error)

    return res.status(500).json({
      ok: false,
      message: 'Error generando PDF con Puppeteer',
      error: error.message,
    })
  }
}

router.post('/export/pdf', handleCotizacionPdf)
router.post('/pdf', handleCotizacionPdf)
router.post('/cotizacion', handleCotizacionPdf)
router.post('/cotizacion/pdf', handleCotizacionPdf)

module.exports = router
