const DEFAULT_API_URL = 'https://api.rubikcreaciones.com/api'
const DEFAULT_TEST_EMAIL = 'r.rojas@rubikcreaciones.cl'
const DEFAULT_TEST_PASSWORD = '123456'

const apiUrl = String(process.env.PRODUCTION_API_URL || DEFAULT_API_URL).replace(/\/+$/, '')
const testEmail = process.env.TEST_EMAIL || DEFAULT_TEST_EMAIL
const testPassword = process.env.TEST_PASSWORD || DEFAULT_TEST_PASSWORD

const summary = {
  ok: false,
  loginOk: false,
  healthOk: false,
  financePermissionOk: false,
  movementCreated: false,
  paymentCreated: false,
  sandboxStarted: false,
  finalPaymentStatus: '',
  finalMovementStatus: '',
  auditLogOk: false,
  summaryOk: false,
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

const extractItems = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  return []
}

const normalizeMovementStatus = (movement = {}) => {
  if (movement.paymentState) return movement.paymentState
  if (movement.status === 'Pagado') return 'paid'
  if (movement.status === 'Pago parcial') return 'partial'
  if (movement.status === 'Vencido') return 'overdue'
  if (movement.status === 'Anulado') return 'canceled'
  return 'pending'
}

const main = async () => {
  if (typeof fetch !== 'function') {
    throw new Error('Este script requiere Node.js 18+ con fetch global.')
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

  const financeSummaryBefore = await requestJson('/finance/summary', { token })
  if (financeSummaryBefore.status === 403) {
    addFailure(
      'El usuario no tiene permisos financieros. Ejecuta npm run finance:grant-demo-permissions o usa TEST_EMAIL de Gerencia/Finanzas.',
      { status: financeSummaryBefore.status, body: financeSummaryBefore.payload },
    )
    return
  }

  summary.financePermissionOk = financeSummaryBefore.status === 200
  if (!summary.financePermissionOk) {
    addFailure('GET /finance/summary no respondio correctamente.', {
      status: financeSummaryBefore.status,
      body: financeSummaryBefore.payload,
    })
    return
  }

  const demoResponse = await requestJson('/finance/demo/sandbox-payment', {
    method: 'POST',
    token,
    body: {},
  })

  const movement = demoResponse.payload?.movement
  const payment = demoResponse.payload?.payment
  summary.movementCreated = demoResponse.status === 200 && Boolean(movement?.id)
  summary.paymentCreated = demoResponse.status === 200 && Boolean(payment?.id)
  summary.sandboxStarted = Boolean(payment?.provider === 'sandbox' && payment?.status)
  summary.finalPaymentStatus = payment?.status || ''
  summary.finalMovementStatus = normalizeMovementStatus(movement)

  if (!summary.movementCreated || !summary.paymentCreated) {
    addFailure('POST /finance/demo/sandbox-payment no creo movimiento y pago.', {
      status: demoResponse.status,
      body: demoResponse.payload,
    })
    return
  }

  const paymentsResponse = await requestJson('/finance/payments', { token })
  const payments = extractItems(paymentsResponse.payload)
  const paymentVisible = payments.some((candidate) => candidate.id === payment.id)
  if (!paymentVisible) {
    addFailure('El pago creado no aparece en GET /finance/payments.', {
      status: paymentsResponse.status,
      paymentId: payment.id,
    })
  }

  const movementsResponse = await requestJson('/finance/movements', { token })
  const movements = extractItems(movementsResponse.payload)
  const movementVisible = movements.some((candidate) => candidate.id === movement.id)
  if (!movementVisible) {
    addFailure('El movimiento creado no aparece en GET /finance/movements.', {
      status: movementsResponse.status,
      movementId: movement.id,
    })
  }

  const auditResponse = await requestJson(`/finance/payments/${encodeURIComponent(payment.id)}/audit`, { token })
  const auditItems = extractItems(auditResponse.payload)
  summary.auditLogOk = auditResponse.status === 200 && auditItems.length > 0
  if (!summary.auditLogOk) {
    addFailure('GET /finance/payments/:id/audit no devolvio auditoria.', {
      status: auditResponse.status,
      body: auditResponse.payload,
    })
  }

  const financeSummaryAfter = await requestJson('/finance/summary', { token })
  summary.summaryOk =
    financeSummaryAfter.status === 200 &&
    typeof financeSummaryAfter.payload === 'object' &&
    Number(financeSummaryAfter.payload?.totalPaid || 0) >= 0
  if (!summary.summaryOk) {
    addFailure('GET /finance/summary final no devolvio resumen valido.', {
      status: financeSummaryAfter.status,
      body: financeSummaryAfter.payload,
    })
  }
}

main()
  .catch((error) => {
    addFailure(error.message || 'La validacion de pago sandbox fallo.')
  })
  .finally(() => {
    summary.ok =
      summary.failures.length === 0 &&
      summary.loginOk &&
      summary.healthOk &&
      summary.financePermissionOk &&
      summary.movementCreated &&
      summary.paymentCreated &&
      summary.sandboxStarted &&
      summary.auditLogOk &&
      summary.summaryOk

    console.log(JSON.stringify(summary, null, 2))
    process.exitCode = summary.ok ? 0 : 1
  })
