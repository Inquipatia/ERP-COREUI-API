const express = require('express')
const dataAdapter = require('../services/dataAdapter')
const { requireAuth } = require('../middleware/authMiddleware')

const router = express.Router()

router.get('/status', async (_request, response, next) => {
  try {
    const counts = await dataAdapter.getCounts()
    const adapterStatus = dataAdapter.getAdapterStatus()

    response.json({
      ok: true,
      status: 'ok',
      mode: adapterStatus.mode,
      db: adapterStatus.db,
      provider: adapterStatus.provider,
      source: adapterStatus.source,
      storage: adapterStatus.mode === 'json' ? 'data/rubik-db.json' : 'database',
      requestedMode: adapterStatus.requestedMode,
      fallbackReason: adapterStatus.fallbackReason,
      counts,
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

router.post('/seed', async (_request, response, next) => {
  try {
    response.json(await dataAdapter.seedInitialData())
  } catch (error) {
    next(error)
  }
})

router.post('/import-json', async (_request, response, next) => {
  try {
    response.json(await dataAdapter.importJsonFile())
  } catch (error) {
    next(error)
  }
})

module.exports = router
