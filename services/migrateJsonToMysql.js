require('dotenv').config({ quiet: true })

const fs = require('node:fs')
const path = require('node:path')
const prismaDataAdapter = require('./prismaDataAdapter')
const { disconnectPrisma } = require('./prismaClient')

const DEFAULT_JSON_FILE = path.join(__dirname, '..', 'data', 'rubik-db.json')

const MIGRATION_STEPS = [
  ['users', 'users'],
  ['clients', 'clients'],
  ['quotes', 'quotes'],
  ['documents', 'documents'],
  ['tenders', 'tenders'],
  ['workOrders', 'workOrders'],
  ['financeMovements', 'financeMovements'],
  ['suppliers', 'suppliers'],
  ['materials', 'materials'],
  ['products', 'products'],
]

const readJsonDatabase = () => {
  const jsonFile = process.env.RUBIK_JSON_DB_FILE || DEFAULT_JSON_FILE

  if (!fs.existsSync(jsonFile)) {
    throw new Error(`No existe la base JSON: ${jsonFile}`)
  }

  return JSON.parse(fs.readFileSync(jsonFile, 'utf8'))
}

const countQuoteItems = (quotes = []) =>
  (Array.isArray(quotes) ? quotes : []).reduce((total, quote) => {
    const items = Array.isArray(quote.quoteItems) ? quote.quoteItems : Array.isArray(quote.items) ? quote.items : []
    return total + items.length
  }, 0)

const migrateJsonToMysql = async () => {
  const jsonPayload = readJsonDatabase()
  const summary = {
    users: { inserted: 0, updated: 0 },
    clients: { inserted: 0, updated: 0 },
    quotes: { inserted: 0, updated: 0 },
    quoteItems: { inserted: 0, updated: 0, total: countQuoteItems(jsonPayload.quotes) },
    documents: { inserted: 0, updated: 0 },
    tenders: { inserted: 0, updated: 0 },
    workOrders: { inserted: 0, updated: 0 },
    financeMovements: { inserted: 0, updated: 0 },
    suppliers: { inserted: 0, updated: 0 },
    materials: { inserted: 0, updated: 0 },
    products: { inserted: 0, updated: 0 },
    errors: [],
  }

  for (const [summaryKey, collectionKey] of MIGRATION_STEPS) {
    try {
      const items = Array.isArray(jsonPayload[collectionKey]) ? jsonPayload[collectionKey] : []
      summary[summaryKey] = {
        ...summary[summaryKey],
        ...(await prismaDataAdapter.upsertMany(collectionKey, items)),
        total: items.length,
      }
    } catch (error) {
      summary.errors.push({
        collection: collectionKey,
        error: error.message,
      })
    }
  }

  return summary
}

if (require.main === module) {
  migrateJsonToMysql()
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2))
      process.exitCode = summary.errors.length ? 1 : 0
    })
    .catch((error) => {
      console.error(error)
      process.exitCode = 1
    })
    .finally(async () => {
      await disconnectPrisma()
    })
}

module.exports = {
  migrateJsonToMysql,
}
