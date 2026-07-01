const startPayment = async ({ payment } = {}) => {
  const now = new Date().toISOString()

  return {
    ok: true,
    provider: 'manual',
    status: 'pending',
    providerStatus: 'manual_pending',
    providerPaymentId: `manual-${payment?.id || Date.now()}`,
    transactionDate: now,
    message: 'Pago manual registrado para conciliacion interna.',
    rawResponse: {
      manual: true,
      generatedAt: now,
    },
  }
}

module.exports = {
  startPayment,
}
