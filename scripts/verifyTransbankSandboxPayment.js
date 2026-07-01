const DEFAULT_API_URL = 'https://api.rubikcreaciones.com/api'
const DEFAULT_TEST_EMAIL = 'c.guzman@rubikcreaciones.cl'
const DEFAULT_TEST_PASSWORD = '123456'

const apiUrl = String(process.env.PRODUCTION_API_URL || DEFAULT_API_URL).replace(/\/+$/, '')
const testEmail = process.env.TEST_EMAIL || DEFAULT_TEST_EMAIL
const testPassword = process.env.TEST_PASSWORD || DEFAULT_TEST_PASSWORD

const summary = {
  ok: false,
  loginOk: false,
  healthOk: false,
  transactionCreated: false,
  redirectUrlOk: false,
  paymentPendingOk: false,
  movementPendingOk: false,
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

  const demoResponse = await requestJson('/finance/demo/transbank-payment', {
    method: 'POST',
    token,
    body: {},
  })
  const movement = demoResponse.payload?.movement
  const payment = demoResponse.payload?.payment
  const redirect = demoResponse.payload?.redirect

  summary.transactionCreated = demoResponse.status === 200 && Boolean(payment?.id) && Boolean(movement?.id)
  summary.redirectUrlOk =
    summary.transactionCreated &&
    typeof redirect?.url === 'string' &&
    redirect.url.startsWith('http') &&
    typeof redirect?.token === 'string' &&
    redirect.token.length > 0
  summary.paymentPendingOk = payment?.status === 'pending'
  summary.movementPendingOk = Boolean(movement?.id) && normalizeMovementStatus(movement) === 'pending'

  if (!summary.transactionCreated) {
    addFailure('POST /finance/demo/transbank-payment no creo movimiento/pago Transbank.', {
      status: demoResponse.status,
      body: demoResponse.payload,
    })
    return
  }

  if (!summary.redirectUrlOk) {
    addFailure('La transaccion Transbank no devolvio redirect.url y redirect.token validos.', {
      redirect,
    })
  }

  if (!summary.paymentPendingOk) {
    addFailure('El pago Transbank no quedo pending.', {
      payment,
    })
  }

  if (!summary.movementPendingOk) {
    addFailure('El movimiento Transbank no quedo pendiente.', {
      movement,
    })
  }
}

main()
  .catch((error) => {
    addFailure(error.message || 'La validacion Transbank sandbox fallo.')
  })
  .finally(() => {
    summary.ok =
      summary.failures.length === 0 &&
      summary.loginOk &&
      summary.healthOk &&
      summary.transactionCreated &&
      summary.redirectUrlOk &&
      summary.paymentPendingOk &&
      summary.movementPendingOk

    console.log(JSON.stringify(summary, null, 2))
    process.exitCode = summary.ok ? 0 : 1
  })
