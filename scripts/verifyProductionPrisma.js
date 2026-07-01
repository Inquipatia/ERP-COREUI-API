const DEFAULT_API_URL = 'https://api.rubikcreaciones.com/api'
const DEFAULT_TEST_EMAIL = 'rsepulveda@rubikcreaciones.cl'
const DEFAULT_TEST_PASSWORD = '123456'
const TEST_PREFIX = '[TEST PRISMA]'

const apiUrl = String(process.env.PRODUCTION_API_URL || DEFAULT_API_URL).replace(/\/+$/, '')
const testEmail = process.env.TEST_EMAIL || DEFAULT_TEST_EMAIL
const testPassword = process.env.TEST_PASSWORD || DEFAULT_TEST_PASSWORD
const shouldCleanupTestRecord = String(process.env.CLEANUP_TEST_RECORD || '').toLowerCase() === 'true'

const summary = {
  ok: false,
  apiUrl,
  adapter: null,
  loginOk: false,
  endpointsOk: false,
  writeTestOk: false,
  pdfOk: false,
  warnings: [],
  failures: [],
}

const addFailure = (message, details = {}) => {
  summary.failures.push({ message, ...details })
}

const addWarning = (message, details = {}) => {
  summary.warnings.push({ message, ...details })
}

const buildUrl = (endpoint) => {
  const normalizedEndpoint = String(endpoint).startsWith('/') ? endpoint : `/${endpoint}`
  return `${apiUrl}${normalizedEndpoint}`
}

const parsePayload = async (response) => {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    return response.json().catch(() => null)
  }

  return response.text().catch(() => null)
}

const request = async (endpoint, { method = 'GET', token, body } = {}) => {
  const response = await fetch(buildUrl(endpoint), {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  const payload = await parsePayload(response)
  return {
    ok: response.ok,
    status: response.status,
    payload,
  }
}

const assertCondition = (condition, message, details = {}) => {
  if (!condition) {
    addFailure(message, details)
  }
}

const extractItems = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  return []
}

const isValidPayload = (payload) => payload !== null && typeof payload === 'object'

const failFastLogin = (loginResponse) => {
  if (loginResponse.ok && loginResponse.payload?.token && loginResponse.payload?.user) return

  console.error('Login failed.')
  console.error(`Status: ${loginResponse.status}`)
  console.error(`Body: ${JSON.stringify(loginResponse.payload, null, 2)}`)
  throw new Error('Login real contra Prisma/MySQL fallo; se detiene la prueba.')
}

const createTestClient = async (token) => {
  const timestamp = Date.now()
  const clientId = `test-prisma-client-${timestamp}`
  const clientPayload = {
    id: clientId,
    contactName: `${TEST_PREFIX} Verificacion ${timestamp}`,
    company: `${TEST_PREFIX} Validacion Produccion Prisma`,
    rut: `TEST-PRISMA-${timestamp}`,
    email: `test-prisma-${timestamp}@rubikcreaciones.cl`,
    phone: '000000000',
    commune: 'Test',
    address: 'Registro creado por verifyProductionPrisma.js',
    status: 'Test',
    observations: `${TEST_PREFIX} Registro de prueba controlada`,
  }

  const createResponse = await request('/clients', {
    method: 'POST',
    token,
    body: clientPayload,
  })

  assertCondition(createResponse.status === 201 || createResponse.status === 200, 'POST /clients no creo el registro de prueba.', {
    status: createResponse.status,
    body: createResponse.payload,
  })

  if (!createResponse.ok) {
    return { createdClient: null, clientPayload }
  }

  return { createdClient: createResponse.payload, clientPayload }
}

const cleanupTestClient = async (token, client) => {
  if (!shouldCleanupTestRecord || !client?.id) return

  const isSafeTestRecord =
    String(client.id).startsWith('test-prisma-client-') &&
    String(client.company || '').startsWith(TEST_PREFIX)

  if (!isSafeTestRecord) {
    addWarning('Limpieza omitida: el registro creado no cumple el patron seguro de test.', {
      id: client.id,
      company: client.company,
    })
    return
  }

  const deleteResponse = await request(`/clients/${encodeURIComponent(client.id)}`, {
    method: 'DELETE',
    token,
  })

  if (!deleteResponse.ok) {
    addWarning('No se pudo limpiar el registro de prueba; quedo marcado con prefijo [TEST PRISMA].', {
      status: deleteResponse.status,
      body: deleteResponse.payload,
      id: client.id,
    })
  }
}

const main = async () => {
  if (typeof fetch !== 'function') {
    throw new Error('Este script requiere Node.js 18+ con fetch global.')
  }

  const dbHealth = await request('/health/db')
  summary.adapter = dbHealth.payload?.adapter || null
  if (dbHealth.status !== 200) {
    assertCondition(false, 'GET /health/db no respondio 200.', {
      status: dbHealth.status,
      body: dbHealth.payload,
    })
  } else {
    assertCondition(dbHealth.payload?.ok === true, 'GET /health/db no retorno ok=true.', { body: dbHealth.payload })
    assertCondition(dbHealth.payload?.adapter === 'prisma', 'La API no esta usando adapter prisma.', { body: dbHealth.payload })
    assertCondition(dbHealth.payload?.provider === 'mysql', 'El provider esperado es mysql.', { body: dbHealth.payload })
    assertCondition(Number(dbHealth.payload?.counts?.users || 0) > 0, 'El conteo de users debe ser mayor a 0.', {
      counts: dbHealth.payload?.counts,
    })
  }

  const authHealth = await request('/health/auth')
  if (authHealth.status !== 200) {
    assertCondition(false, 'GET /health/auth no respondio 200.', {
      status: authHealth.status,
      body: authHealth.payload,
    })
  } else {
    assertCondition(authHealth.payload?.ok === true, 'GET /health/auth no retorno ok=true.', { body: authHealth.payload })
    assertCondition(authHealth.payload?.hasJwtSecret === true, 'JWT_SECRET no esta configurado en produccion.', {
      body: authHealth.payload,
    })
    assertCondition(Number(authHealth.payload?.userCount || 0) > 0, 'GET /health/auth debe reportar usuarios.', {
      body: authHealth.payload,
    })
  }

  const loginResponse = await request('/auth/login', {
    method: 'POST',
    body: {
      email: testEmail,
      password: testPassword,
    },
  })

  failFastLogin(loginResponse)

  const token = loginResponse.payload.token
  const loginEmail = String(loginResponse.payload.user.email || '').toLowerCase()
  summary.loginOk = loginResponse.status === 200 && Boolean(token) && loginEmail === testEmail.toLowerCase()
  assertCondition(summary.loginOk, 'El login no devolvio token/user valido o el email no coincide.', {
    status: loginResponse.status,
    userEmail: loginResponse.payload?.user?.email,
  })

  const protectedEndpoints = [
    '/clients',
    '/quotes',
    '/documents',
    '/tenders',
    '/work-orders',
    '/users',
    '/dashboard/summary',
    '/dashboard/stats',
    '/dashboard/activity',
    '/finance/movements',
  ]
  const endpointResults = []

  for (const endpoint of protectedEndpoints) {
    const response = await request(endpoint, { token })
    endpointResults.push({
      endpoint,
      status: response.status,
      ok: response.status === 200 && isValidPayload(response.payload),
    })
    assertCondition(response.status !== 401, `${endpoint} respondio 401 con token Bearer.`, {
      endpoint,
      body: response.payload,
    })
    assertCondition(response.status !== 500, `${endpoint} respondio 500.`, {
      endpoint,
      body: response.payload,
    })
    assertCondition(response.status === 200, `${endpoint} no respondio 200.`, {
      endpoint,
      status: response.status,
      body: response.payload,
    })
    assertCondition(isValidPayload(response.payload), `${endpoint} no devolvio array u objeto valido.`, {
      endpoint,
      body: response.payload,
    })
  }

  summary.endpointsOk = endpointResults.every((result) => result.ok)

  const pdfHealth = await request('/export/pdf-health', { token })
  summary.pdfOk =
    pdfHealth.status === 200 &&
    pdfHealth.payload?.ok === true &&
    pdfHealth.payload?.engine === 'pdfkit' &&
    pdfHealth.payload?.chromeRequired === false
  assertCondition(summary.pdfOk, 'GET /export/pdf-health no cumple la validacion esperada.', {
    status: pdfHealth.status,
    body: pdfHealth.payload,
  })

  const clientCountBefore = Number(dbHealth.payload?.counts?.clients || 0)
  const { createdClient, clientPayload } = await createTestClient(token)
  const createdClientId = createdClient?.id || clientPayload.id
  const clientsAfterCreate = await request('/clients', { token })
  const clients = extractItems(clientsAfterCreate.payload)
  const testClientExists = clients.some((client) => {
    const matchesId = String(client.id || '') === String(createdClientId)
    const hasPrefix =
      String(client.company || '').startsWith(TEST_PREFIX) ||
      String(client.contactName || '').startsWith(TEST_PREFIX)
    return matchesId || hasPrefix
  })

  const dbHealthAfterWrite = await request('/health/db')
  const clientCountAfter = Number(dbHealthAfterWrite.payload?.counts?.clients || 0)
  summary.writeTestOk =
    Boolean(createdClient) &&
    clientsAfterCreate.status === 200 &&
    testClientExists &&
    (clientCountAfter > clientCountBefore || testClientExists)

  assertCondition(summary.writeTestOk, 'La prueba de escritura controlada no quedo visible via API.', {
    createdClientId,
    clientsStatus: clientsAfterCreate.status,
    clientCountBefore,
    clientCountAfter,
  })

  await cleanupTestClient(token, createdClient)
}

main()
  .catch((error) => {
    addFailure(error.message || 'La validacion de produccion fallo.')
  })
  .finally(() => {
    summary.ok =
      summary.failures.length === 0 &&
      summary.loginOk &&
      summary.endpointsOk &&
      summary.writeTestOk &&
      summary.pdfOk

    console.log(JSON.stringify(summary, null, 2))
    process.exitCode = summary.ok ? 0 : 1
  })
