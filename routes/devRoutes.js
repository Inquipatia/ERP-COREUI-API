const express = require('express')
const dataAdapter = require('../services/dataAdapter')
const { requireAuth } = require('../middleware/authMiddleware')

const router = express.Router()

const getStorageLabel = () => {
  const adapterMode = String(process.env.RUBIK_DATA_ADAPTER || '').trim().toLowerCase()
  const usingPrisma =
    adapterMode === 'postgres' ||
    adapterMode === 'prisma' ||
    adapterMode === 'database' ||
    (!adapterMode && Boolean(process.env.DATABASE_URL))

  return usingPrisma ? 'database' : 'data/rubik-db.json'
}

router.get('/status', async (_request, response, next) => {
  try {
    response.json({
      status: 'ok',
      storage: getStorageLabel(),
      counts: await dataAdapter.getCounts(),
    })
  } catch (error) {
    next(error)
  }
})

router.post('/import-local-storage', requireAuth, async (request, response, next) => {
  try {
    response.json(await dataAdapter.importLocalStorage(request.body || {}))
  } catch (error) {
    next(error)
  }
})

module.exports = router
