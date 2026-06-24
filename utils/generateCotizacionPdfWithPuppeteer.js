const puppeteer = require('puppeteer')
const renderCotizacionHTML = require('./renderCotizacionHTML')

async function generateCotizacionPdfWithPuppeteer(data = {}) {
  let browser

  try {
    const html = renderCotizacionHTML(data)

    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    })

    const page = await browser.newPage()

    await page.setContent(html, {
      waitUntil: 'networkidle0',
    })

    await page.emulateMediaType('screen')

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: false,
      preferCSSPageSize: true,
      margin: {
        top: '7mm',
        right: '7mm',
        bottom: '7mm',
        left: '7mm',
      },
    })

    return pdfBuffer
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

module.exports = generateCotizacionPdfWithPuppeteer