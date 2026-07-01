const express = require('express')
const workOrderService = require('../services/workOrderService')
const { requireAuth, userHasPermission } = require('../middleware/authMiddleware')

const router = express.Router()

const requireAnyPermission = (permissions = []) => (request, response, next) => {
  if (permissions.some((permission) => userHasPermission(request.currentUser, permission))) {
    next()
    return
  }

  response.status(403).json({
    error: 'No tienes permiso para consultar esta informacion.',
    permissions,
  })
}

const canViewWorkOrders = requireAnyPermission(['workorders.view'])
const canCreateWorkOrders = requireAnyPermission(['workorders.create'])
const canUpdateWorkOrders = requireAnyPermission([
  'workorders.update',
  'workorders.create',
  'workorders.assign',
  'workorders.complete',
])
const canDeleteWorkOrders = requireAnyPermission(['workorders.delete', 'workorders.assign'])

router.get('/', requireAuth, canViewWorkOrders, async (request, response, next) => {
  try {
    response.json(await workOrderService.listWorkOrders(request.currentUser))
  } catch (error) {
    next(error)
  }
})

router.get('/stats', requireAuth, canViewWorkOrders, async (request, response, next) => {
  try {
    response.json(await workOrderService.getWorkOrderStats(request.currentUser))
  } catch (error) {
    next(error)
  }
})

router.get('/activity', requireAuth, canViewWorkOrders, async (request, response, next) => {
  try {
    response.json(await workOrderService.getWorkOrderActivity(request.currentUser))
  } catch (error) {
    next(error)
  }
})

router.post('/from-quote/:quoteId', requireAuth, canCreateWorkOrders, async (request, response, next) => {
  try {
    response.status(201).json(
      await workOrderService.createFromQuote(request.params.quoteId, request.body || {}, request.currentUser),
    )
  } catch (error) {
    next(error)
  }
})

router.post('/from-document/:documentId', requireAuth, canCreateWorkOrders, async (request, response, next) => {
  try {
    response.status(201).json(
      await workOrderService.createFromDocument(request.params.documentId, request.body || {}, request.currentUser),
    )
  } catch (error) {
    next(error)
  }
})

router.post('/', requireAuth, canCreateWorkOrders, async (request, response, next) => {
  try {
    response.status(201).json(await workOrderService.createWorkOrder(request.body || {}, request.currentUser))
  } catch (error) {
    next(error)
  }
})

router.get('/:id', requireAuth, canViewWorkOrders, async (request, response, next) => {
  try {
    response.json(await workOrderService.getWorkOrderById(request.params.id, request.currentUser))
  } catch (error) {
    next(error)
  }
})

router.put('/:id', requireAuth, canUpdateWorkOrders, async (request, response, next) => {
  try {
    response.json(await workOrderService.updateWorkOrder(request.params.id, request.body || {}, request.currentUser))
  } catch (error) {
    next(error)
  }
})

router.patch('/:id', requireAuth, canUpdateWorkOrders, async (request, response, next) => {
  try {
    response.json(await workOrderService.updateWorkOrder(request.params.id, request.body || {}, request.currentUser))
  } catch (error) {
    next(error)
  }
})

router.delete('/:id', requireAuth, canDeleteWorkOrders, async (request, response, next) => {
  try {
    await workOrderService.getWorkOrderById(request.params.id, request.currentUser)
    response.json(await workOrderService.deleteWorkOrder(request.params.id))
  } catch (error) {
    next(error)
  }
})

router.post('/:id/movement', requireAuth, canUpdateWorkOrders, async (request, response, next) => {
  try {
    const workOrder = await workOrderService.getWorkOrderById(request.params.id, request.currentUser)
    const movement = {
      id: `movement-${Date.now()}`,
      ...request.body,
      userName: request.currentUser.name,
      userEmail: request.currentUser.email,
      createdAt: new Date().toISOString(),
    }

    response.json(
      await workOrderService.updateWorkOrder(
        request.params.id,
        {
          movements: [movement, ...(workOrder.movements || [])],
          workflowLog: [movement, ...(workOrder.workflowLog || [])],
        },
        request.currentUser,
      ),
    )
  } catch (error) {
    next(error)
  }
})

router.post('/:id/comment', requireAuth, canViewWorkOrders, async (request, response, next) => {
  try {
    const workOrder = await workOrderService.getWorkOrderById(request.params.id, request.currentUser)
    const comment = {
      id: `comment-${Date.now()}`,
      body: request.body?.body || request.body?.comment || request.body?.message || '',
      message: request.body?.message || request.body?.body || request.body?.comment || '',
      userName: request.currentUser.name,
      userEmail: request.currentUser.email,
      createdAt: new Date().toISOString(),
    }

    response.json(
      await workOrderService.updateWorkOrder(
        request.params.id,
        {
          comments: [comment, ...(workOrder.comments || [])],
        },
        request.currentUser,
      ),
    )
  } catch (error) {
    next(error)
  }
})

module.exports = router
