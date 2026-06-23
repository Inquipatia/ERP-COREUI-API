const express = require('express')
const multer = require('multer')
 
const router = express.Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 20,
    fileSize: 25 * 1024 * 1024,
  },
})

const pickFunction = (moduleValue, functionName) => {
  if (typeof moduleValue === 'function') return moduleValue
  if (moduleValue && typeof moduleValue[functionName] === 'function') return moduleValue[functionName]
  if (moduleValue && typeof moduleValue.default === 'function') return moduleValue.default
  return null
}

const safeRequire = (path) => {
  try {
    return require(path)
  } catch (error) {
    console.warn(`Tender analyzer dependency unavailable: ${path}`, error.message)
    return null
  }
}

const analyzeTenderContentModule = safeRequire('../utils/tenderAnalyzer/analyzeTenderContent')
const extractTextFromPdfModule = safeRequire('../utils/tenderAnalyzer/extractTextFromPdf')
const extractTextFromDocxModule = safeRequire('../utils/tenderAnalyzer/extractTextFromDocx')
const extractTextFromExcelModule = safeRequire('../utils/tenderAnalyzer/extractTextFromExcel')

const analyzeTenderContent = pickFunction(analyzeTenderContentModule, 'analyzeTenderContent')
const extractTextFromPdf = pickFunction(extractTextFromPdfModule, 'extractTextFromPdf')
const extractTextFromDocx = pickFunction(extractTextFromDocxModule, 'extractTextFromDocx')
const extractTextFromExcel = pickFunction(extractTextFromExcelModule, 'extractTextFromExcel')

const getExtension = (filename = '') => {
  const parts = filename.toLowerCase().split('.')
  return parts.length > 1 ? parts.pop() : ''
}

const normalizeExtractedResult = (file, result, fallbackMethod = 'unknown') => {
  if (typeof result === 'string') {
    return {
      fileName: file.originalname,
      fileType: file.mimetype || 'text/plain',
      extractedText: result,
      extractionMethod: fallbackMethod,
      extractionWarnings: [],
      segments: [],
    }
  }

  return {
    fileName: result?.fileName || file.originalname,
    fileType: result?.fileType || file.mimetype || 'application/octet-stream',
    extractedText: result?.extractedText || result?.text || '',
    extractionMethod: result?.extractionMethod || fallbackMethod,
    extractionWarnings: result?.extractionWarnings || result?.warnings || [],
    segments: result?.segments || [],
  }
}

const extractTextFromFile = async (file) => {
  const ext = getExtension(file.originalname)

  if (ext === 'txt') {
    return normalizeExtractedResult(file, file.buffer.toString('utf8'), 'txt-buffer')
  }

  if (ext === 'pdf') {
    if (!extractTextFromPdf) {
      throw new Error('Extractor PDF no disponible o mal exportado.')
    }

    return normalizeExtractedResult(file, await extractTextFromPdf(file), 'pdfjs-dist')
  }

  if (ext === 'docx') {
    if (!extractTextFromDocx) {
      throw new Error('Extractor DOCX no disponible o mal exportado.')
    }

    return normalizeExtractedResult(file, await extractTextFromDocx(file), 'mammoth')
  }

  if (['xlsx', 'xls'].includes(ext)) {
    if (!extractTextFromExcel) {
      throw new Error('Extractor Excel no disponible o mal exportado.')
    }

    return normalizeExtractedResult(file, await extractTextFromExcel(file), 'exceljs')
  }

  return normalizeExtractedResult(
    file,
    {
      extractedText: '',
      extractionWarnings: [
        `Formato no soportado para extracción automática: ${file.originalname}`,
      ],
    },
    'unsupported',
  )
}

router.get('/status', (_req, res) => {
  res.json({
    ok: true,
    service: 'tender-analyzer',
    supportedFiles: ['pdf', 'docx', 'xlsx', 'xls', 'txt', 'jpg', 'jpeg', 'png'],
    extractors: {
      pdf: Boolean(extractTextFromPdf),
      docx: Boolean(extractTextFromDocx),
      excel: Boolean(extractTextFromExcel),
      analyzer: Boolean(analyzeTenderContent),
    },
  })
})

router.post('/analyze-documents', upload.array('documents', 20), async (req, res) => {
  try {
    const files = req.files || []
    const manualText = req.body?.sourceText || ''

    const sources = []

    for (const file of files) {
      const extracted = await extractTextFromFile(file)
      sources.push(extracted)
    }

    const extractedText = [
      manualText,
      ...sources.map((source) => {
        const text = source.extractedText || ''
        return `\n\n===== ${source.fileName} =====\n${text}`
      }),
    ]
      .filter(Boolean)
      .join('\n')
      .trim()

    if (!extractedText) {
      return res.status(400).json({
        ok: false,
        error:
          'No se pudo extraer texto de los documentos. Puedes pegar el texto manualmente como respaldo.',
        documentDiagnostics: sources.map((source) => ({
          fileName: source.fileName,
          fileType: source.fileType,
          extractionMethod: source.extractionMethod,
          extractionWarnings: source.extractionWarnings,
          extractedLength: 0,
        })),
      })
    }

    const analysis = analyzeTenderContent
      ? analyzeTenderContent({
          sources,
          manualText,
        })
      : {
          tenderData: {
            sourceText: extractedText,
            summary: extractedText.slice(0, 1200),
          },
          fieldSources: {},
          documentDiagnostics: [],
          extractedText,
          globalWarnings: ['Analizador avanzado no disponible. Se devolvió texto extraído.'],
        }

    return res.json({
      ok: true,
      extractedText: analysis.extractedText || extractedText,
      sourceFiles: files.map((file) => ({
        name: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
      })),
      ...analysis,
    })
  } catch (error) {
    console.error('Error en tender analyzer:', error)

    return res.status(500).json({
      ok: false,
      error: error.message || 'No se pudieron analizar los documentos.',
    })
  }
})

module.exports = router