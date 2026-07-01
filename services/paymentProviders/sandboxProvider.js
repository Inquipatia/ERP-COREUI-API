const VALID_SANDBOX_STATUSES = new Set(['approved', 'rejected', 'pending', 'failed'])

const normalizeSandboxStatus = (status = '') => {
  const normalizedStatus = String(status || '').trim().toLowerCase()
  return VALID_SANDBOX_STATUSES.has(normalizedStatus) ? normalizedStatus : 'approved'
}

const startPayment = async ({ payment } = {}) => {
  const status = normalizeSandboxStatus(process.env.PAYMENT_SANDBOX_FORCE_STATUS || 'approved')
  const now = new Date().toISOString()

  return {
    ok: status === 'approved',
    provider: 'sandbox',
    status,
    providerStatus: status,
    providerPaymentId: `sandbox-${payment?.id || Date.now()}`,
    transactionDate: now,
    message: 'Pago sandbox simulado. No se movio dinero real.',
    rawResponse: {
      sandbox: true,
      forcedStatus: status,
      generatedAt: now,
    },
  }
}

module.exports = {
  startPayment,
}
