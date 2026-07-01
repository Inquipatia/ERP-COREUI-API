const DEFAULT_API_URL = 'https://api.rubikcreaciones.com/api'
const DEFAULT_TEST_EMAIL = 'rsepulveda@rubikcreaciones.cl'
const DEFAULT_TEST_PASSWORD = '123456'
const EXCEL_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const apiUrl = String(process.env.PRODUCTION_API_URL || DEFAULT_API_URL).replace(/\/+$/, '')
const testEmail = process.env.TEST_EMAIL || DEFAULT_TEST_EMAIL
const testPassword = process.env.TEST_PASSWORD || DEFAULT_TEST_PASSWORD

const summary = {
  ok: false,
  loginOk: false,
  healthOk: false,
  pdfHealthOk: false,
  documentsFound: false,
  quotesFound: false,
  documentPdfOk: false,
  documentExcelOk: false,
  quotePdfOk: false,
  quoteExcelOk: false,
  failures: [],
}

const addFailure = (message, details = {}) => {
  summary.failures.push({ message, ...details })
}

const buildUrl = (endpoint) => `${apiUrl}${String(endpoint).startsWith('/') ? endpoint : `/${endpoint}`}`

const parsePayload = async (response) => {
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) return response.json().catch(() => null)
  return response.text().catch(() => null)
}

const requestJson = async (endpoint, { method = 'GET', token, body } = {}) => {
  const response = await fetch(buildUrl(endpoint), {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  return {
    ok: response.ok,
    status: response.status,
    payload: await parsePayload(response),
  }
}

const requestFile = async (endpoint, { token, expectedContentType, label } = {}) => {
  const response = await fetch(buildUrl(endpoint), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const responseForError = response.clone()
  const contentType = response.headers.get('content-type') || ''
  const bytes = Buffer.from(await response.arrayBuffer())
  const errorPayload = response.ok ? null : await parsePayload(responseForError)
  const ok =
    response.status === 200 &&
    contentType.toLowerCase().includes(expectedContentType.toLowerCase()) &&
    bytes.length > 0 &&
    !contentType.toLowerCase().includes('text/html') &&
    !contentType.toLowerCase().includes('application/json')

  if (!ok) {
    addFailure(`${label} no devolvio un archivo valido.`, {
      endpoint,
      status: response.status,
      contentType,
      bytes: bytes.length,
      body: errorPayload,
    })
  }

  return ok
}

const extractItems = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  return []
}

const pickDocument = (documents) =>
  documents.find((document) => {
    const type = String(document.type || document.tipoDocumento || '').toLowerCase()
    const origin = String(document.origin || document.origen || '').toLowerCase()
    return type.includes('cot') || origin.includes('quote') || origin.includes('cot')
  }) ||
  documents.find((document) => document?.id) ||
  null

const pickQuote = (quotes) =>
  quotes.find((quote) => quote?.id && (Array.isArray(quote.items) || Array.isArray(quote.quoteItems))) ||
  quotes.find((quote) => quote?.id) ||
  null

const main = async () => {
  if (typeof fetch !== 'function') {
    throw new Error('Este script requiere Node.js 18+ con fetch global.')
  }

  const login = await requestJson('/auth/login', {
    method: 'POST',
    body: {
      email: testEmail,
      password: testPassword,
    },
  })
  const token = login.payload?.token
  const userEmail = String(login.payload?.user?.email || '').toLowerCase()
  summary.loginOk = login.status === 200 && Boolean(token) && userEmail === testEmail.toLowerCase()

  if (!summary.loginOk) {
    addFailure('Login fallo.', { status: login.status, body: login.payload })
    return
  }

  const health = await requestJson('/health/db')
  summary.healthOk =
    health.status === 200 &&
    health.payload?.ok === true &&
    health.payload?.adapter === 'prisma' &&
    health.payload?.provider === 'mysql'
  if (!summary.healthOk) {
    addFailure('GET /health/db no confirma Prisma/MySQL ok.', {
      status: health.status,
      body: health.payload,
    })
  }

  const pdfHealth = await requestJson('/export/pdf-health', { token })
  summary.pdfHealthOk =
    pdfHealth.status === 200 &&
    pdfHealth.payload?.ok === true &&
    pdfHealth.payload?.engine === 'pdfkit' &&
    pdfHealth.payload?.chromeRequired === false &&
    pdfHealth.payload?.libreOfficeRequired === false
  if (!summary.pdfHealthOk) {
    addFailure('GET /export/pdf-health no cumple contrato esperado.', {
      status: pdfHealth.status,
      body: pdfHealth.payload,
    })
  }

  const documentsResponse = await requestJson('/documents', { token })
  const documents = extractItems(documentsResponse.payload)
  const document = pickDocument(documents)
  summary.documentsFound = documentsResponse.status === 200 && Boolean(document?.id)
  if (!summary.documentsFound) {
    addFailure('No se encontro un documento real para probar exportaciones.', {
      status: documentsResponse.status,
      total: documents.length,
      body: documentsResponse.payload,
    })
  }

  if (document?.id) {
    const encodedDocumentId = encodeURIComponent(document.id)
    summary.documentPdfOk = await requestFile(`/export/documents/${encodedDocumentId}/pdf`, {
      token,
      expectedContentType: 'application/pdf',
      label: 'PDF de documento',
    })
    summary.documentExcelOk = await requestFile(`/export/documents/${encodedDocumentId}/excel`, {
      token,
      expectedContentType: EXCEL_CONTENT_TYPE,
      label: 'Excel de documento',
    })
  }

  const quotesResponse = await requestJson('/quotes', { token })
  const quotes = extractItems(quotesResponse.payload)
  const quote = pickQuote(quotes)
  summary.quotesFound = quotesResponse.status === 200 && Boolean(quote?.id)
  if (!summary.quotesFound) {
    addFailure('No se encontro una cotizacion real para probar exportaciones.', {
      status: quotesResponse.status,
      total: quotes.length,
      body: quotesResponse.payload,
    })
  }

  if (quote?.id) {
    const encodedQuoteId = encodeURIComponent(quote.id)
    summary.quotePdfOk = await requestFile(`/export/quotes/${encodedQuoteId}/pdf`, {
      token,
      expectedContentType: 'application/pdf',
      label: 'PDF de cotizacion',
    })
    summary.quoteExcelOk = await requestFile(`/export/quotes/${encodedQuoteId}/excel`, {
      token,
      expectedContentType: EXCEL_CONTENT_TYPE,
      label: 'Excel de cotizacion',
    })
  }
}

main()
  .catch((error) => {
    addFailure(error.message || 'La validacion de exportaciones fallo.')
  })
  .finally(() => {
    summary.ok =
      summary.failures.length === 0 &&
      summary.loginOk &&
      summary.healthOk &&
      summary.pdfHealthOk &&
      summary.documentsFound &&
      summary.quotesFound &&
      summary.documentPdfOk &&
      summary.documentExcelOk &&
      summary.quotePdfOk &&
      summary.quoteExcelOk

    console.log(JSON.stringify(summary, null, 2))
    process.exitCode = summary.ok ? 0 : 1
  })
