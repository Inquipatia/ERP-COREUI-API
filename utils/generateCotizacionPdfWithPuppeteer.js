const puppeteer = require('puppeteer')
const { renderCotizacionHTML } = require('./renderCotizacionHTML')

const PUPPETEER_PDF_ERROR_MESSAGE = 'No se pudo generar el PDF con Puppeteer.'

const getPuppeteerLaunchOptions = () => ({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
})

const createPuppeteerError = (cause) => {
  const error = new Error(PUPPETEER_PDF_ERROR_MESSAGE)
  error.code = 'PUPPETEER_PDF_UNAVAILABLE'
  error.statusCode = 503
  if (cause) error.cause = cause
  return error
}

const generateCotizacionPdfWithPuppeteer = async (quoteData) => {
  let browser

  try {
    browser = await puppeteer.launch(getPuppeteerLaunchOptions())
    const page = await browser.newPage()

    await page.setContent(renderCotizacionHTML(quoteData), {
      waitUntil: ['domcontentloaded', 'networkidle0'],
    })

    return await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '0mm',
        right: '0mm',
        bottom: '0mm',
        left: '0mm',
      },
    })
  } catch (error) {
    throw createPuppeteerError(error)
  } finally {
    if (browser) {
      await browser.close().catch(() => {})
    }
  }
}

const getPuppeteerInfo = async () => {
  let browser

  try {
    browser = await puppeteer.launch(getPuppeteerLaunchOptions())
    return { canGeneratePdf: true, error: '' }
  } catch (error) {
    return { canGeneratePdf: false, error: error.message || PUPPETEER_PDF_ERROR_MESSAGE }
  } finally {
    if (browser) {
      await browser.close().catch(() => {})
    }
  }
}

module.exports = {
  PUPPETEER_PDF_ERROR_MESSAGE,
  generateCotizacionPdfWithPuppeteer,
  getPuppeteerInfo,
}
