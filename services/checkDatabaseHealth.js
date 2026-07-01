require('dotenv').config({ quiet: true })

const dataAdapter = require('./dataAdapter')
const statisticsService = require('./statisticsService')
const { getPrisma } = require('./prismaClient')

const HEALTH_COUNT_KEYS = [
  'users',
  'clients',
  'quotes',
  'quoteItems',
  'documents',
  'tenders',
  'workOrders',
  'financeMovements',
  'payments',
  'auditLogs',
  'suppliers',
  'materials',
  'products',
]

const emptyCounts = () =>
  HEALTH_COUNT_KEYS.reduce((counts, key) => {
    counts[key] = 0
    return counts
  }, {})

const normalizeCounts = (counts = {}) => ({
  ...emptyCounts(),
  users: Number(counts.users || 0),
  clients: Number(counts.clients || 0),
  quotes: Number(counts.quotes || 0),
  quoteItems: Number(counts.quoteItems || 0),
  documents: Number(counts.documents || 0),
  tenders: Number(counts.tenders || 0),
  workOrders: Number(counts.workOrders || 0),
  financeMovements: Number(counts.financeMovements || 0),
  payments: Number(counts.payments || 0),
  auditLogs: Number(counts.auditLogs || 0),
  suppliers: Number(counts.suppliers || 0),
  materials: Number(counts.materials || 0),
  products: Number(counts.products || 0),
})

const getDatabaseNameFromUrl = () => {
  if (!process.env.DATABASE_URL) return null

  try {
    const databaseUrl = new URL(process.env.DATABASE_URL)
    return decodeURIComponent(databaseUrl.pathname.replace(/^\//, '')) || null
  } catch (_error) {
    return 'DATABASE_URL invalida'
  }
}

const getPrismaCounts = async () => {
  const prisma = getPrisma()
  const [
    users,
    clients,
    quotes,
    quoteItems,
    documents,
    tenders,
    workOrders,
    financeMovements,
    payments,
    auditLogs,
    suppliers,
    materials,
    products,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.client.count(),
    prisma.quote.count(),
    prisma.quoteItem.count(),
    prisma.document.count(),
    prisma.tender.count(),
    prisma.workOrder.count(),
    prisma.financialMovement.count(),
    prisma.payment.count(),
    prisma.auditLog.count(),
    prisma.supplier.count(),
    prisma.material.count(),
    prisma.productService.count(),
  ])

  return normalizeCounts({
    users,
    clients,
    quotes,
    quoteItems,
    documents,
    tenders,
    workOrders,
    financeMovements,
    payments,
    auditLogs,
    suppliers,
    materials,
    products,
  })
}

const getJsonCounts = async () => normalizeCounts(await dataAdapter.getCounts())

const hasJwtSecret = () => Boolean(String(process.env.JWT_SECRET || '').trim())

const normalizeStatus = (value = '') => String(value || '').trim().toLowerCase()

const buildCheck = ({
  name,
  ok,
  details = null,
  error = null,
  required = true,
  status,
  ...extra
}) => ({
  name,
  ok: Boolean(ok),
  required,
  status: status || (ok ? 'pass' : 'fail'),
  details,
  error,
  ...extra,
})

const checkAuthHealth = async () => {
  const adapterStatus = dataAdapter.getAdapterStatus()
  const adapter = adapterStatus.mode
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL)
  const jwtSecretConfigured = hasJwtSecret()
  const baseResult = {
    ok: false,
    adapter,
    hasJwtSecret: jwtSecretConfigured,
    hasDatabaseUrl,
    userCount: 0,
    activeUserCount: 0,
    loginStrategy:
      adapter === 'prisma'
        ? 'prisma-passwordHash-with-legacy-plain-fallback'
        : 'json-password',
    tokenStrategy: 'opaque-bearer-session',
    error: null,
  }

  try {
    if (adapter === 'prisma') {
      if (!hasDatabaseUrl) {
        return {
          ...baseResult,
          error: 'DATABASE_URL no existe para validar usuarios en Prisma/MySQL.',
        }
      }

      const users = await getPrisma().user.findMany({ select: { status: true } })
      const activeUserCount = users.filter((user) => normalizeStatus(user.status) === 'activo').length

      return {
        ...baseResult,
        ok: jwtSecretConfigured && users.length > 0 && activeUserCount > 0,
        userCount: users.length,
        activeUserCount,
      }
    }

    const users = await dataAdapter.list('users')
    const normalizedUsers = Array.isArray(users) ? users : []
    const activeUserCount = normalizedUsers.filter((user) => normalizeStatus(user.status) === 'activo').length

    return {
      ...baseResult,
      ok: jwtSecretConfigured && normalizedUsers.length > 0 && activeUserCount > 0,
      userCount: normalizedUsers.length,
      activeUserCount,
    }
  } catch (error) {
    return {
      ...baseResult,
      error: error.message || 'No se pudo verificar la configuracion de autenticacion.',
    }
  }
}

const checkDatabaseHealth = async () => {
  const adapterStatus = dataAdapter.getAdapterStatus()
  const adapter = adapterStatus.mode
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL)
  const provider = adapter === 'prisma' ? 'mysql' : 'json'

  try {
    if (adapter === 'prisma') {
      if (!hasDatabaseUrl) {
        return {
          ok: false,
          adapter,
          hasDatabaseUrl,
          provider,
          database: null,
          counts: emptyCounts(),
          error: 'DATABASE_URL no existe. Configura MySQL antes de usar RUBIK_DATA_ADAPTER=prisma.',
        }
      }

      const prisma = getPrisma()
      const databaseRows = await prisma.$queryRaw`SELECT DATABASE() AS databaseName`
      const database = databaseRows?.[0]?.databaseName || getDatabaseNameFromUrl()

      return {
        ok: true,
        adapter,
        hasDatabaseUrl,
        provider,
        database,
        counts: await getPrismaCounts(),
        error: null,
      }
    }

    return {
      ok: true,
      adapter,
      hasDatabaseUrl,
      provider,
      database: 'data/rubik-db.json',
      counts: await getJsonCounts(),
      error: null,
    }
  } catch (error) {
    return {
      ok: false,
      adapter,
      hasDatabaseUrl,
      provider,
      database: adapter === 'prisma' ? getDatabaseNameFromUrl() : 'data/rubik-db.json',
      counts: emptyCounts(),
      error: error.message || 'No se pudo verificar la base de datos.',
    }
  }
}

const getMigrationCheck = async (adapter) => {
  if (adapter !== 'prisma') {
    return buildCheck({
      name: 'migrations',
      ok: true,
      required: false,
      status: 'skipped',
      details: { message: 'No aplica en modo json.' },
    })
  }

  try {
    const rows = await getPrisma().$queryRaw`
      SELECT COUNT(*) AS applied
      FROM _prisma_migrations
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    `
    const applied = Number(rows?.[0]?.applied || 0)

    return buildCheck({
      name: 'migrations',
      ok: applied > 0,
      required: true,
      status: applied > 0 ? 'pass' : 'fail',
      details: {
        applied,
        message: applied > 0 ? 'Migraciones aplicadas detectadas.' : 'No hay migraciones aplicadas detectadas.',
      },
    })
  } catch (error) {
    return buildCheck({
      name: 'migrations',
      ok: true,
      required: false,
      status: 'warning',
      details: { message: `No se pudo detectar _prisma_migrations: ${error.message}` },
    })
  }
}

const checkQueryableCollection = async (name, key) => {
  try {
    const items = await dataAdapter.list(key)
    return buildCheck({
      name,
      ok: Array.isArray(items),
      required: true,
      status: Array.isArray(items) ? 'pass' : 'fail',
      details: { count: Array.isArray(items) ? items.length : 0 },
    })
  } catch (error) {
    return buildCheck({
      name,
      ok: false,
      required: true,
      status: 'fail',
      error: error.message,
    })
  }
}

const checkCollectionHasData = (name, count) =>
  buildCheck({
    name,
    ok: count > 0,
    required: true,
    details: { count },
  })

const checkDashboardSummary = async () => {
  try {
    const summary = await statisticsService.getDashboardSummary()
    return buildCheck({
      name: 'dashboard.summary',
      ok: Boolean(summary?.totals && summary?.charts),
      required: true,
      details: {
        hasTotals: Boolean(summary?.totals),
        hasCharts: Boolean(summary?.charts),
      },
    })
  } catch (error) {
    return buildCheck({
      name: 'dashboard.summary',
      ok: false,
      required: true,
      error: error.message,
    })
  }
}

const checkDashboardStats = async () => {
  try {
    const stats = await statisticsService.getDashboardStats()
    return buildCheck({
      name: 'dashboard.stats',
      ok: Boolean(stats?.totals && stats?.charts),
      required: true,
      details: {
        hasTotals: Boolean(stats?.totals),
        hasCharts: Boolean(stats?.charts),
      },
    })
  } catch (error) {
    return buildCheck({
      name: 'dashboard.stats',
      ok: false,
      required: true,
      error: error.message,
    })
  }
}

const checkDashboardActivity = async () => {
  try {
    const activity = await statisticsService.getDashboardActivity()
    return buildCheck({
      name: 'dashboard.activity',
      ok: Boolean(activity?.totals && Array.isArray(activity?.recentActivity)),
      required: true,
      details: {
        hasTotals: Boolean(activity?.totals),
        recentActivityCount: Array.isArray(activity?.recentActivity) ? activity.recentActivity.length : 0,
      },
    })
  } catch (error) {
    return buildCheck({
      name: 'dashboard.activity',
      ok: false,
      required: true,
      error: error.message,
    })
  }
}

const checkPdfHealth = () =>
  buildCheck({
    name: 'pdf.health',
    ok: true,
    required: true,
    details: {
      endpoint: '/api/export/pdf-health',
      engine: 'pdfkit',
      chromeRequired: false,
      libreOfficeRequired: false,
    },
  })

const checkProductionReadiness = async () => {
  const health = await checkDatabaseHealth()
  const authHealth = await checkAuthHealth()
  const adapterStatus = dataAdapter.getAdapterStatus()
  const adapter = health.adapter
  const checks = [
    buildCheck({
      name: 'adapter',
      ok: adapter === 'json' || adapter === 'prisma',
      required: true,
      details: {
        adapter,
        requestedMode: adapterStatus.requestedMode,
        source: adapterStatus.source,
      },
    }),
    buildCheck({
      name: 'databaseUrl',
      ok: adapter !== 'prisma' || health.hasDatabaseUrl,
      required: adapter === 'prisma',
      status: adapter === 'prisma' ? (health.hasDatabaseUrl ? 'pass' : 'fail') : 'skipped',
      details: { hasDatabaseUrl: health.hasDatabaseUrl },
    }),
    buildCheck({
      name: 'databaseConnection',
      ok: adapter !== 'prisma' || health.ok,
      required: adapter === 'prisma',
      status: adapter === 'prisma' ? (health.ok ? 'pass' : 'fail') : 'skipped',
      details: {
        provider: health.provider,
        database: health.database,
      },
      error: adapter === 'prisma' ? health.error : null,
    }),
    await getMigrationCheck(adapter),
    buildCheck({
      name: 'users',
      ok: health.counts.users > 0,
      required: true,
      details: { count: health.counts.users },
    }),
    checkCollectionHasData('clients', health.counts.clients),
    checkCollectionHasData('quotes', health.counts.quotes),
    checkCollectionHasData('documents', health.counts.documents),
    await checkQueryableCollection('tenders.queryable', 'tenders'),
    await checkQueryableCollection('workOrders.queryable', 'workOrders'),
    await checkDashboardSummary(),
    await checkDashboardStats(),
    await checkDashboardActivity(),
    checkPdfHealth(),
    buildCheck({
      name: 'auth.configured',
      ok: authHealth.ok,
      required: true,
      details: {
        userCount: authHealth.userCount,
        activeUserCount: authHealth.activeUserCount,
        loginStrategy: authHealth.loginStrategy,
        tokenStrategy: authHealth.tokenStrategy,
      },
      error: authHealth.error,
    }),
    buildCheck({
      name: 'jwtSecret',
      ok: authHealth.hasJwtSecret,
      required: true,
      details: { hasJwtSecret: authHealth.hasJwtSecret },
    }),
  ]
  const ok = checks.every((check) => !check.required || check.ok)

  return {
    ok,
    adapter,
    hasDatabaseUrl: health.hasDatabaseUrl,
    provider: health.provider,
    database: health.database,
    counts: health.counts,
    checks,
    error: ok ? null : health.error || 'Faltan validaciones obligatorias para activar prisma en produccion.',
  }
}

if (require.main === module) {
  checkDatabaseHealth()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2))
      process.exit(result.ok ? 0 : 1)
    })
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

module.exports = {
  checkAuthHealth,
  checkDatabaseHealth,
  checkProductionReadiness,
}
