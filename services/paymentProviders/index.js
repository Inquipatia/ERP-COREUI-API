const manualProvider = require('./manualProvider')
const sandboxProvider = require('./sandboxProvider')

const providers = {
  manual: manualProvider,
  sandbox: sandboxProvider,
}

const getPaymentProvider = (providerName = '') => {
  const normalizedProviderName = String(providerName || 'manual').trim().toLowerCase()
  const provider = providers[normalizedProviderName]

  if (!provider) {
    const error = new Error(`Proveedor de pago no soportado: ${normalizedProviderName}`)
    error.statusCode = 400
    throw error
  }

  return provider
}

module.exports = {
  getPaymentProvider,
  providers,
}
