const express = require('express')
const dataAdapter = require('../services/dataAdapter')
const { requireAuth, requirePermission } = require('../middleware/authMiddleware')

const router = express.Router()

router.get('/', requireAuth, requirePermission('products.view'), async (_request, response, next) => {
  try {
    response.json({ items: await dataAdapter.list('products') })
  } catch (error) {
    next(error)
  }
})

router.get('/:id', requireAuth, requirePermission('products.view'), async (request, response, next) => {
  try {
    response.json(await dataAdapter.findById('products', request.params.id))
  } catch (error) {
    next(error)
  }
})

router.post('/', requireAuth, requirePermission('products.manage'), async (request, response, next) => {
  try {
    response.status(201).json(await dataAdapter.create('products', 'prd', request.body || {}))
  } catch (error) {
    next(error)
  }
})

router.put('/:id', requireAuth, requirePermission('products.manage'), async (request, response, next) => {
  try {
    response.json(await dataAdapter.update('products', request.params.id, request.body || {}))
  } catch (error) {
    next(error)
  }
})

router.patch('/:id', requireAuth, requirePermission('products.manage'), async (request, response, next) => {
  try {
    response.json(await dataAdapter.update('products', request.params.id, request.body || {}))
  } catch (error) {
    next(error)
  }
})

router.delete('/:id', requireAuth, requirePermission('products.manage'), async (request, response, next) => {
  try {
    response.json(await dataAdapter.remove('products', request.params.id))
  } catch (error) {
    next(error)
  }
})

module.exports = router
