const express = require('express')
const dataAdapter = require('../services/dataAdapter')
const { requireAuth, requirePermission } = require('../middleware/authMiddleware')

const router = express.Router()

router.get('/', requireAuth, requirePermission('materials.view'), async (_request, response, next) => {
  try {
    response.json({ items: await dataAdapter.list('materials') })
  } catch (error) {
    next(error)
  }
})

router.get('/:id', requireAuth, requirePermission('materials.view'), async (request, response, next) => {
  try {
    response.json(await dataAdapter.findById('materials', request.params.id))
  } catch (error) {
    next(error)
  }
})

router.post('/', requireAuth, requirePermission('materials.manage'), async (request, response, next) => {
  try {
    response.status(201).json(await dataAdapter.create('materials', 'mat', request.body || {}))
  } catch (error) {
    next(error)
  }
})

router.put('/:id', requireAuth, requirePermission('materials.manage'), async (request, response, next) => {
  try {
    response.json(await dataAdapter.update('materials', request.params.id, request.body || {}))
  } catch (error) {
    next(error)
  }
})

router.patch('/:id', requireAuth, requirePermission('materials.manage'), async (request, response, next) => {
  try {
    response.json(await dataAdapter.update('materials', request.params.id, request.body || {}))
  } catch (error) {
    next(error)
  }
})

router.delete('/:id', requireAuth, requirePermission('materials.manage'), async (request, response, next) => {
  try {
    response.json(await dataAdapter.remove('materials', request.params.id))
  } catch (error) {
    next(error)
  }
})

module.exports = router
