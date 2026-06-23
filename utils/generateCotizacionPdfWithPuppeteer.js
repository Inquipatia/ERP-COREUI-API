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
      preferCSSPageSize: true,
      margin: {
        top: '12mm',
        right: '10mm',
        bottom: '12mm',
        left: '10mm',
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