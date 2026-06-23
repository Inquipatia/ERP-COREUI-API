const express = require('express')
const generateCotizacionPdfWithPuppeteer = require('../utils/generateCotizacionPdfWithPuppeteer')

const router = express.Router()

async function handleCotizacionPdf(req, res) {
  try {
    const data = req.body || {}

    const pdfBuffer = await generateCotizacionPdfWithPuppeteer(data)

    const numero = data.numero || data.folio || 'rubik'

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="cotizacion-${numero}.pdf"`
    )

    return res.send(Buffer.from(pdfBuffer))
  } catch (error) {
    console.error('Error generando PDF con Puppeteer:', error)

    return res.status(500).json({
      ok: false,
      message: 'Error generando PDF con Puppeteer',
      error: error.message,
    })
  }
}

router.post('/pdf', handleCotizacionPdf)
router.post('/cotizacion', handleCotizacionPdf)
router.post('/cotizacion/pdf', handleCotizacionPdf)

module.exports = router