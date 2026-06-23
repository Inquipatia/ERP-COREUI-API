const express = require('express')
const multer = require('multer')

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

let analyzeTenderContent
let extractTextFromPdf
let extractTextFromDocx
let extractTextFromExcel

try {
  analyzeTenderContent = require('../utils/tenderAnalyzer/analyzeTenderContent')
} catch {
  analyzeTenderContent = null
}

try {
  extractTextFromPdf = require('../utils/tenderAnalyzer/extractTextFromPdf')
} catch {
  extractTextFromPdf = null
}

try {
  extractTextFromDocx = require('../utils/tenderAnalyzer/extractTextFromDocx')
} catch {
  extractTextFromDocx = null
}

try {
  extractTextFromExcel = require('../utils/tenderAnalyzer/extractTextFromExcel')
} catch {
  extractTextFromExcel = null
}

const getExtension = (filename = '') => {
  const parts = filename.toLowerCase().split('.')
  return parts.length > 1 ? parts.pop() : ''
}

const extractTextFromFile = async (file) => {
  const ext = getExtension(file.originalname)

  if (ext === 'txt') {
    return file.buffer.toString('utf8')
  }

  if (ext === 'pdf' && extractTextFromPdf) {
    return extractTextFromPdf(file.buffer, file.originalname)
  }

  if (ext === 'docx' && extractTextFromDocx) {
    return extractTextFromDocx(file.buffer, file.originalname)
  }

  if (['xlsx', 'xls'].includes(ext) && extractTextFromExcel) {
    return extractTextFromExcel(file.buffer, file.originalname)
  }

  return ''
}

router.get('/status', (req, res) => {
  res.json({
    ok: true,
    service: 'tender-analyzer',
    supportedFiles: ['pdf', 'docx', 'xlsx', 'xls', 'txt', 'jpg', 'jpeg', 'png'],
  })
})

router.post('/analyze-documents', upload.array('documents', 20), async (req, res) => {
  try {
    const files = req.files || []
    const manualText = req.body?.sourceText || ''

    const extractedParts = []

    for (const file of files) {
      const text = await extractTextFromFile(file)

      extractedParts.push({
        fileName: file.originalname,
        text: typeof text === 'string' ? text : text?.text || '',
      })
    }

    const extractedText = [
      manualText,
      ...extractedParts.map((item) => `\n\n===== ${item.fileName} =====\n${item.text}`),
    ]
      .filter(Boolean)
      .join('\n')

    if (!extractedText.trim()) {
      return res.status(400).json({
        ok: false,
        error:
          'No se pudo extraer texto de los documentos. Puedes pegar el texto manualmente como respaldo.',
      })
    }

    const analysis = analyzeTenderContent
      ? await analyzeTenderContent(extractedText, {
          sourceFiles: files.map((file) => ({
            name: file.originalname,
            size: file.size,
            mimetype: file.mimetype,
          })),
        })
      : {
          sourceText: extractedText,
          summary: extractedText.slice(0, 1200),
          globalWarnings: ['Analizador avanzado no disponible. Se devolvió texto extraído.'],
        }

    res.json({
      ok: true,
      extractedText,
      sourceFiles: files.map((file) => ({
        name: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
      })),
      ...analysis,
    })
  } catch (error) {
    console.error('Error en tender analyzer:', error)

    res.status(500).json({
      ok: false,
      error: error.message || 'No se pudieron analizar los documentos.',
    })
  }
})

module.exports = router