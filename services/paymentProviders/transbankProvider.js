const {
  Environment,
  IntegrationApiKeys,
  IntegrationCommerceCodes,
  Options,
  WebpayPlus,
} = require('transbank-sdk')

const getTransbankEnvironment = () =>
  String(process.env.TRANSBANK_ENV || 'integration').trim().toLowerCase()

const assertProductionEnabled = () => {
  if (getTransbankEnvironment() !== 'production') return

  const realPaymentsEnabled = String(process.env.ENABLE_REAL_PAYMENTS || '').toLowerCase() === 'true'
  if (!realPaymentsEnabled) {
    const error = new Error('Pagos reales de Transbank deshabilitados. Usa ENABLE_REAL_PAYMENTS=true solo con credenciales productivas validadas.')
    error.statusCode = 403
    throw error
  }

  if (!process.env.TRANSBANK_COMMERCE_CODE || !process.env.TRANSBANK_API_KEY) {
    const error = new Error('Credenciales productivas de Transbank incompletas.')
    error.statusCode = 500
    throw error
  }
}

const getTransbankOptions = () => {
  const environmentName = getTransbankEnvironment()

  if (!['integration', 'production'].includes(environmentName)) {
    const error = new Error(`TRANSBANK_ENV no soportado: ${environmentName}`)
    error.statusCode = 400
    throw error
  }

  assertProductionEnabled()

  const isProduction = environmentName === 'production'
  const commerceCode =
    process.env.TRANSBANK_COMMERCE_CODE ||
    (isProduction ? '' : IntegrationCommerceCodes.WEBPAY_PLUS)
  const apiKey =
    process.env.TRANSBANK_API_KEY ||
    (isProduction ? '' : IntegrationApiKeys.WEBPAY)
  const environment = isProduction ? Environment.Production : Environment.Integration

  if (!commerceCode || !apiKey) {
    const error = new Error('Configuracion de Transbank incompleta.')
    error.statusCode = 500
    throw error
  }

  return new Options(commerceCode, apiKey, environment)
}

const getTransaction = () => new WebpayPlus.Transaction(getTransbankOptions())

const sanitizeTransbankResponse = (response = {}) => {
  if (!response || typeof response !== 'object') return response

  const {
    card_detail: _cardDetail,
    cardDetail: _cardDetailCamel,
    ...safeResponse
  } = response

  return safeResponse
}

const createTransaction = async ({ buyOrder, sessionId, amount, returnUrl } = {}) => {
  if (!buyOrder || !sessionId || !amount || !returnUrl) {
    const error = new Error('buyOrder, sessionId, amount y returnUrl son requeridos.')
    error.statusCode = 400
    throw error
  }

  const response = await getTransaction().create(
    String(buyOrder),
    String(sessionId),
    Number(amount),
    String(returnUrl),
  )

  return {
    ...sanitizeTransbankResponse(response),
    url: response.url,
    token: response.token,
    providerStatus: 'created',
    provider: 'transbank',
    environment: getTransbankEnvironment(),
  }
}

const commitTransaction = async (token) => {
  if (!token) {
    const error = new Error('token_ws es requerido para confirmar la transaccion.')
    error.statusCode = 400
    throw error
  }

  const response = await getTransaction().commit(String(token))
  return sanitizeTransbankResponse(response)
}

const mapTransbankStatus = (response = {}) => {
  const status = String(response.status || '').toUpperCase()
  const responseCode = Number(response.response_code)

  if (status === 'AUTHORIZED' && responseCode === 0) return 'approved'
  if (responseCode === 0 && status !== 'FAILED' && status !== 'REVERSED') return 'approved'
  if (['FAILED', 'NULLIFIED', 'REVERSED'].includes(status)) return 'failed'
  if (Number.isFinite(responseCode) && responseCode < 0) return 'rejected'
  return 'pending'
}

module.exports = {
  commitTransaction,
  createTransaction,
  getTransbankEnvironment,
  mapTransbankStatus,
  sanitizeTransbankResponse,
}
