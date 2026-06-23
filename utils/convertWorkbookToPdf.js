const fs = require('node:fs')
const fsPromises = require('node:fs/promises')
const path = require('node:path')
const { execFile } = require('node:child_process')
const { randomUUID } = require('node:crypto')
const { promisify } = require('node:util')
const { pathToFileURL } = require('node:url')

const execFileAsync = promisify(execFile)
const TEMP_ROOT = path.join(process.cwd(), 'tmp', 'pdf-export')
const CONVERSION_ERROR_MESSAGE =
  'LibreOffice/soffice no está disponible para convertir XLSX a PDF.'

const getLibreOfficeCandidates = () =>
  [
    process.env.LIBREOFFICE_PATH,
    'soffice',
    'libreoffice',
    '/usr/bin/soffice',
    '/usr/bin/libreoffice',
    '/usr/local/bin/soffice',
    '/usr/local/bin/libreoffice',
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
  ].filter(Boolean)

const unique = (values) => [...new Set(values)]

const isFilePathCandidate = (candidate) =>
  path.isAbsolute(candidate) || candidate.includes('\\') || candidate.includes('/')

const canRunLibreOffice = async (candidate) => {
  if (isFilePathCandidate(candidate) && !fs.existsSync(candidate)) {
    return false
  }

  try {
    await execFileAsync(candidate, ['--version'], {
      timeout: 10000,
      windowsHide: true,
    })
    return true
  } catch (error) {
    return false
  }
}

const getLibreOfficeInfo = async () => {
  for (const candidate of unique(getLibreOfficeCandidates())) {
    if (isFilePathCandidate(candidate) && fs.existsSync(candidate)) {
      return {
        canConvertPdf: true,
        libreOfficePath: candidate,
      }
    }

    if (await canRunLibreOffice(candidate)) {
      return {
        canConvertPdf: true,
        libreOfficePath: candidate,
      }
    }
  }

  return {
    canConvertPdf: false,
    libreOfficePath: '',
  }
}

const sanitizeFilePart = (value) =>
  String(value || '8103')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')

const createConversionError = (cause) => {
  const error = new Error(CONVERSION_ERROR_MESSAGE)
  error.code = 'PDF_CONVERSION_UNAVAILABLE'
  error.statusCode = 503
  if (cause) {
    error.cause = cause
  }
  return error
}

const convertWorkbookToPdf = async (xlsxBuffer, quoteNumber) => {
  const { canConvertPdf, libreOfficePath } = await getLibreOfficeInfo()

  if (!canConvertPdf || !libreOfficePath) {
    throw createConversionError()
  }

  const safeQuoteNumber = sanitizeFilePart(quoteNumber)
  const workDir = path.join(TEMP_ROOT, randomUUID())
  const profileDir = path.join(workDir, 'lo-profile')
  const baseFileName = `Cotizacion-Rubik-${safeQuoteNumber}`
  const xlsxPath = path.join(workDir, `${baseFileName}.xlsx`)
  const pdfPath = path.join(workDir, `${baseFileName}.pdf`)

  try {
    await fsPromises.mkdir(profileDir, { recursive: true })
    await fsPromises.writeFile(xlsxPath, Buffer.from(xlsxBuffer))

    await execFileAsync(
      libreOfficePath,
      [
        `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
        '--headless',
        '--convert-to',
        'pdf',
        '--outdir',
        workDir,
        xlsxPath,
      ],
      {
        timeout: 120000,
        windowsHide: true,
      },
    )

    if (!fs.existsSync(pdfPath)) {
      throw createConversionError()
    }

    return await fsPromises.readFile(pdfPath)
  } catch (error) {
    if (error.code === 'PDF_CONVERSION_UNAVAILABLE') {
      throw error
    }

    throw createConversionError(error)
  } finally {
    await fsPromises.rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
}

module.exports = {
  CONVERSION_ERROR_MESSAGE,
  convertWorkbookToPdf,
  getLibreOfficeInfo,
}
