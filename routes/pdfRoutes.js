const express = require('express')
const fs = require('node:fs')
const path = require('node:path')
const { promisify } = require('node:util')
const libreOffice = require('libreoffice-convert')
const {
  DEFAULT_TEMPLATE_PATH,
  assertQuoteTemplateReadable,
  buildQuoteWorkbook,
  findQuoteTemplatePath,
} = require('../utils/buildQuoteWorkbook')

const router = express.Router()
const convertWithOptionsAsync = promisify(libreOffice.convertWithOptions)

const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const PDF_CONTENT_TYPE = 'application/pdf'

const getFallbackPayload = (extra = {}) => ({
  fallback: 'print',
  message: 'PDF server unavailable',
  ok: false,
  ...extra,
})

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

const uniquePaths = (paths) => [...new Set(paths.filter(Boolean))]

const getLibreOfficeBinaryCandidates = () =>
  uniquePaths([
    process.env.LIBRE_OFFICE_EXE,
    process.env.SOFFICE_PATH,
    process.env.LIBREOFFICE_PATH,
    process.platform === 'win32'
      ? path.join(process.env.PROGRAMFILES || '', 'LibreOffice', 'program', 'soffice.exe')
      : null,
    process.platform === 'win32'
      ? path.join(process.env['PROGRAMFILES(X86)'] || '', 'LibreOffice', 'program', 'soffice.exe')
      : null,
    process.platform === 'win32' ? 'C:/Program Files/LibreOffice/program/soffice.exe' : null,
    process.platform === 'darwin'
      ? '/Applications/LibreOffice.app/Contents/MacOS/soffice'
      : null,
    process.platform === 'linux' ? '/usr/bin/libreoffice' : null,
    process.platform === 'linux' ? '/usr/bin/soffice' : null,
    process.platform === 'linux' ? '/usr/local/bin/libreoffice' : null,
    process.platform === 'linux' ? '/usr/local/bin/soffice' : null,
    process.platform === 'linux' ? '/snap/bin/libreoffice' : null,
    process.platform === 'linux' ? '/opt/libreoffice/program/soffice' : null,
  ])

const findLibreOfficeBinary = () =>
  getLibreOfficeBinaryCandidates().find((candidate) => fs.existsSync(candidate)) || null

const canConvertPdf = () => Boolean(findLibreOfficeBinary())

const convertXlsxToPdf = async (xlsxBuffer, baseFileName) => {
  if (!canConvertPdf()) {
    return null
  }

  const pdfBuffer = await convertWithOptionsAsync(Buffer.from(xlsxBuffer), 'pdf', undefined, {
    execOptions: {
      timeout: 120000,
      windowsHide: true,
    },
    fileName: `${baseFileName}.xlsx`,
    sofficeAdditionalArgs: ['--nologo', '--nofirststartwizard', '--norestore'],
    sofficeBinaryPaths: getLibreOfficeBinaryCandidates(),
  })

  return Buffer.from(pdfBuffer)
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
    canConvertPdf: canConvertPdf(),
  }
}

const sendBufferDownload = (response, { buffer, contentType, fileName }) => {
  response.setHeader('Content-Type', contentType)
  response.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
  response.setHeader('Content-Length', Buffer.byteLength(buffer))
  response.send(buffer)
}

const isTemplateFailure = (error) =>
  error?.code === 'QUOTE_TEMPLATE_NOT_FOUND' ||
  /template|plantilla|xlsx|zip|workbook/i.test(error?.message || '')

router.get('/export-pdf/status', async (_request, response) => {
  response.json(await getExportStatus())
})

router.get('/export-pdf', async (_request, response) => {
  response.json({
    ...(await getExportStatus()),
    service: 'rubik-pdf-export',
    message: 'Use POST /api/export-pdf with quote payload.',
  })
})

router.post('/export-pdf', async (request, response) => {
  if (!request.body || Object.keys(request.body).length === 0) {
    response.status(400).json({ ok: false, message: 'Quote payload is required' })
    return
  }

  const quoteNumber = getQuoteNumber(request.body)
  const baseFileName = `Cotizacion-Rubik-${quoteNumber}`
  let xlsxBuffer

  try {
    xlsxBuffer = await buildQuoteWorkbook(request.body)
  } catch (error) {
    if (isTemplateFailure(error)) {
      const templatePath = findQuoteTemplatePath()

      response.json(
        getFallbackPayload({
          reason: `Template cotizacion-rubik.xlsx could not be read: ${error.message}`,
          templateFound: fs.existsSync(templatePath),
          templatePath,
        }),
      )
      return
    }

    response.status(error.statusCode || 400).json({
      ok: false,
      message: error.message || 'No se pudo generar la cotizacion.',
    })
    return
  }

  try {
    const pdfBuffer = await convertXlsxToPdf(xlsxBuffer, baseFileName)

    if (pdfBuffer) {
      sendBufferDownload(response, {
        buffer: pdfBuffer,
        contentType: PDF_CONTENT_TYPE,
        fileName: `${baseFileName}.pdf`,
      })
      return
    }
  } catch (error) {
    console.warn('PDF conversion unavailable, returning XLSX:', error.message)
  }

  sendBufferDownload(response, {
    buffer: xlsxBuffer,
    contentType: XLSX_CONTENT_TYPE,
    fileName: `${baseFileName}.xlsx`,
  })
})

module.exports = router
