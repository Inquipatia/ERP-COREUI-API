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
    suppliers,
    materials,
    products,
  })
}

const getJsonCounts = async () => normalizeCounts(await dataAdapter.getCounts())

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
    return {
      name: 'migrations',
      ok: true,
      required: false,
      status: 'skipped',
      message: 'No aplica en modo json.',
    }
  }

  try {
    const rows = await getPrisma().$queryRaw`
      SELECT COUNT(*) AS applied
      FROM _prisma_migrations
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    `
    const applied = Number(rows?.[0]?.applied || 0)

    return {
      name: 'migrations',
      ok: applied > 0,
      required: true,
      status: applied > 0 ? 'pass' : 'fail',
      applied,
      message: applied > 0 ? 'Migraciones aplicadas detectadas.' : 'No hay migraciones aplicadas detectadas.',
    }
  } catch (error) {
    return {
      name: 'migrations',
      ok: true,
      required: false,
      status: 'warning',
      message: `No se pudo detectar _prisma_migrations: ${error.message}`,
    }
  }
}

const checkQueryableCollection = async (name, key) => {
  try {
    const items = await dataAdapter.list(key)
    return {
      name,
      ok: Array.isArray(items),
      required: true,
      status: Array.isArray(items) ? 'pass' : 'fail',
      count: Array.isArray(items) ? items.length : 0,
    }
  } catch (error) {
    return {
      name,
      ok: false,
      required: true,
      status: 'fail',
      error: error.message,
    }
  }
}

const checkDashboard = async () => {
  try {
    const summary = await statisticsService.getDashboardSummary()
    return {
      name: 'dashboard',
      ok: Boolean(summary?.totals),
      required: true,
      status: summary?.totals ? 'pass' : 'fail',
    }
  } catch (error) {
    return {
      name: 'dashboard',
      ok: false,
      required: true,
      status: 'fail',
      error: error.message,
    }
  }
}

const checkProductionReadiness = async () => {
  const health = await checkDatabaseHealth()
  const adapter = health.adapter
  const checks = [
    {
      name: 'adapter',
      ok: adapter === 'json' || adapter === 'prisma',
      required: true,
      status: adapter === 'json' || adapter === 'prisma' ? 'pass' : 'fail',
      adapter,
    },
    {
      name: 'databaseUrl',
      ok: adapter !== 'prisma' || health.hasDatabaseUrl,
      required: adapter === 'prisma',
      status: adapter === 'prisma' ? (health.hasDatabaseUrl ? 'pass' : 'fail') : 'skipped',
    },
    {
      name: 'databaseConnection',
      ok: adapter !== 'prisma' || health.ok,
      required: adapter === 'prisma',
      status: adapter === 'prisma' ? (health.ok ? 'pass' : 'fail') : 'skipped',
      error: adapter === 'prisma' ? health.error : null,
    },
    await getMigrationCheck(adapter),
    {
      name: 'users',
      ok: health.counts.users > 0,
      required: true,
      status: health.counts.users > 0 ? 'pass' : 'fail',
      count: health.counts.users,
    },
    await checkQueryableCollection('quotes', 'quotes'),
    await checkQueryableCollection('documents', 'documents'),
    {
      name: 'pdf',
      ok: true,
      required: true,
      status: 'pass',
      engine: 'pdfkit',
      chromeRequired: false,
      libreOfficeRequired: false,
    },
    await checkDashboard(),
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
  checkDatabaseHealth,
  checkProductionReadiness,
}
