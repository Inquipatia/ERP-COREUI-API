const DEFAULT_API_URL = 'https://api.rubikcreaciones.com/api'
const DEFAULT_TEST_EMAIL = 'rsepulveda@rubikcreaciones.cl'
const DEFAULT_TEST_PASSWORD = '123456'
const TEST_TITLE = '[TEST OT] Orden de trabajo demo'

const apiUrl = String(process.env.PRODUCTION_API_URL || DEFAULT_API_URL).replace(/\/+$/, '')
const testEmail = process.env.TEST_EMAIL || DEFAULT_TEST_EMAIL
const testPassword = process.env.TEST_PASSWORD || DEFAULT_TEST_PASSWORD
const shouldCleanupTestRecord = String(process.env.CLEANUP_TEST_WORK_ORDERS || '').toLowerCase() === 'true'

const summary = {
  ok: false,
  loginOk: false,
  healthOk: false,
  listOk: false,
  createOk: false,
  updateOk: false,
  completeOk: false,
  statsOk: false,
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

const extractToken = (payload = {}) =>
  payload.token || payload.accessToken || payload.sessionToken || payload.data?.token || payload.data?.accessToken || null

const extractItems = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  return []
}

const getStatusCode = (workOrder = {}) => String(workOrder.status || workOrder.statusLabel || '').toLowerCase()

const cleanupTestWorkOrder = async (token, workOrder) => {
  if (!shouldCleanupTestRecord || !workOrder?.id) return
  if (!String(workOrder.title || '').startsWith(TEST_TITLE)) return

  const response = await requestJson(`/work-orders/${encodeURIComponent(workOrder.id)}`, {
    method: 'DELETE',
    token,
  })

  if (!response.ok) {
    addFailure('La limpieza opcional del registro [TEST OT] fallo.', {
      status: response.status,
      body: response.payload,
      id: workOrder.id,
    })
  }
}

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
  const token = extractToken(login.payload)
  const userEmail = String(login.payload?.user?.email || login.payload?.data?.user?.email || '').toLowerCase()
  summary.loginOk = login.status === 200 && Boolean(token) && userEmail === testEmail.toLowerCase()
  if (!summary.loginOk) {
    addFailure('Login fallo.', {
      status: login.status,
      hasToken: Boolean(token),
      userEmail,
      body: login.payload,
    })
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

  const listResponse = await requestJson('/work-orders', { token })
  const listItems = extractItems(listResponse.payload)
  summary.listOk = listResponse.status === 200 && Array.isArray(listItems)
  if (!summary.listOk) {
    addFailure('GET /work-orders no devolvio listado valido.', {
      status: listResponse.status,
      body: listResponse.payload,
    })
  }

  const timestamp = Date.now()
  const createResponse = await requestJson('/work-orders', {
    method: 'POST',
    token,
    body: {
      title: TEST_TITLE,
      clientName: 'Cliente Demo Rubik',
      client: 'Cliente Demo Rubik',
      assignedArea: 'Diseño',
      targetArea: 'Diseño',
      priority: 'media',
      status: 'pending',
      description: `Registro de prueba controlada ${timestamp}`,
      details: 'Validacion automatica verifyWorkOrdersPrisma.js',
      notes: '[TEST OT] Registro seguro de prueba',
    },
  })
  const createdWorkOrder = createResponse.payload
  summary.createOk =
    (createResponse.status === 201 || createResponse.status === 200) &&
    Boolean(createdWorkOrder?.id) &&
    String(createdWorkOrder?.title || '') === TEST_TITLE
  if (!summary.createOk) {
    addFailure('POST /work-orders no creo la orden de prueba.', {
      status: createResponse.status,
      body: createResponse.payload,
    })
    return
  }

  const getResponse = await requestJson(`/work-orders/${encodeURIComponent(createdWorkOrder.id)}`, { token })
  if (getResponse.status !== 200 || !getResponse.payload?.id) {
    addFailure('GET /work-orders/:id no encontro la orden creada.', {
      status: getResponse.status,
      body: getResponse.payload,
      id: createdWorkOrder.id,
    })
  }

  const updateResponse = await requestJson(`/work-orders/${encodeURIComponent(createdWorkOrder.id)}`, {
    method: 'PATCH',
    token,
    body: {
      status: 'in_progress',
      startDate: new Date().toISOString(),
    },
  })
  summary.updateOk = updateResponse.status === 200 && getStatusCode(updateResponse.payload).includes('in_progress')
  if (!summary.updateOk) {
    addFailure('PATCH /work-orders/:id no actualizo a in_progress.', {
      status: updateResponse.status,
      body: updateResponse.payload,
    })
  }

  const completeResponse = await requestJson(`/work-orders/${encodeURIComponent(createdWorkOrder.id)}`, {
    method: 'PATCH',
    token,
    body: {
      status: 'completed',
      completedAt: new Date().toISOString(),
    },
  })
  const completedStatus = getStatusCode(completeResponse.payload)
  summary.completeOk =
    completeResponse.status === 200 && (completedStatus.includes('completed') || completedStatus.includes('finalizada'))
  if (!summary.completeOk) {
    addFailure('PATCH /work-orders/:id no actualizo a completed.', {
      status: completeResponse.status,
      body: completeResponse.payload,
    })
  }

  const statsResponse = await requestJson('/work-orders/stats', { token })
  summary.statsOk = statsResponse.status === 200 && statsResponse.payload && typeof statsResponse.payload === 'object'
  if (!summary.statsOk) {
    addFailure('GET /work-orders/stats no devolvio estadisticas validas.', {
      status: statsResponse.status,
      body: statsResponse.payload,
    })
  }

  await cleanupTestWorkOrder(token, completeResponse.payload || createdWorkOrder)
}

main()
  .catch((error) => {
    addFailure(error.message || 'La validacion de ordenes de trabajo fallo.')
  })
  .finally(() => {
    summary.ok =
      summary.failures.length === 0 &&
      summary.loginOk &&
      summary.healthOk &&
      summary.listOk &&
      summary.createOk &&
      summary.updateOk &&
      summary.completeOk &&
      summary.statsOk

    console.log(JSON.stringify(summary, null, 2))
    process.exitCode = summary.ok ? 0 : 1
  })
