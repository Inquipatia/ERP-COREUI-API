const express = require('express')
const dataAdapter = require('../services/dataAdapter')
const paymentService = require('../services/paymentService')
const statisticsService = require('../services/statisticsService')
const { requireAuth, requirePermission, userHasPermission } = require('../middleware/authMiddleware')

const router = express.Router()

const requireAnyPermission = (permissions = []) => (request, response, next) => {
  if (permissions.some((permission) => userHasPermission(request.currentUser, permission))) {
    next()
    return
  }

  response.status(403).json({
    error: 'No tienes permiso para consultar esta informacion.',
    permission: permissions[0],
    permissions,
  })
}

const canViewPayments = requireAnyPermission(['payments.view', 'finance.view'])
const canCreatePayments = requireAnyPermission(['payments.create', 'finance.payments', 'finance.manage'])
const canApprovePayments = requireAnyPermission(['payments.approve', 'finance.payments', 'finance.manage'])

const getTransbankReturnToken = (request) => {
  const tokenWs = request.body?.token_ws || request.query?.token_ws
  if (tokenWs) return { token: tokenWs, tokenType: 'token_ws' }

  const abortedToken = request.body?.TBK_TOKEN || request.query?.TBK_TOKEN
  if (abortedToken) return { token: abortedToken, tokenType: 'TBK_TOKEN' }

  return { token: '', tokenType: '' }
}

const handleTransbankReturn = async (request, response, next) => {
  try {
    const { token, tokenType } = getTransbankReturnToken(request)
    const result = await paymentService.confirmTransbankPayment({ token, tokenType }, request.currentUser || {})

    if (request.query?.format === 'json' || request.body?.format === 'json') {
      response.json(result)
      return
    }

    response.redirect(303, result.frontendUrl)
  } catch (error) {
    next(error)
  }
}

router.get('/summary', requireAuth, requirePermission('finance.view'), async (_request, response, next) => {
  try {
    response.json(await paymentService.getFinanceSummary())
  } catch (error) {
    next(error)
  }
})

router.get('/stats', requireAuth, requirePermission('finance.view'), async (_request, response, next) => {
  try {
    response.json(await statisticsService.getFinanceStats())
  } catch (error) {
    next(error)
  }
})

router.get('/movements', requireAuth, requirePermission('finance.view'), async (_request, response, next) => {
  try {
    response.json({ items: await dataAdapter.list('financeMovements') })
  } catch (error) {
    next(error)
  }
})

router.get('/movements/:id', requireAuth, requirePermission('finance.view'), async (request, response, next) => {
  try {
    response.json(await dataAdapter.findById('financeMovements', request.params.id))
  } catch (error) {
    next(error)
  }
})

router.post('/movements', requireAuth, requirePermission('finance.manage'), async (request, response, next) => {
  try {
    response.status(201).json(await dataAdapter.create('financeMovements', 'fin', request.body || {}))
  } catch (error) {
    next(error)
  }
})

router.put('/movements/:id', requireAuth, requirePermission('finance.manage'), async (request, response, next) => {
  try {
    response.json(await dataAdapter.update('financeMovements', request.params.id, request.body || {}))
  } catch (error) {
    next(error)
  }
})

router.patch('/movements/:id', requireAuth, requirePermission('finance.manage'), async (request, response, next) => {
  try {
    response.json(await dataAdapter.update('financeMovements', request.params.id, request.body || {}))
  } catch (error) {
    next(error)
  }
})

router.delete('/movements/:id', requireAuth, requirePermission('finance.manage'), async (request, response, next) => {
  try {
    response.json(await dataAdapter.remove('financeMovements', request.params.id))
  } catch (error) {
    next(error)
  }
})

router.post(
  '/movements/:id/payment',
  requireAuth,
  canCreatePayments,
  async (request, response, next) => {
    try {
      response.json(await dataAdapter.registerPayment(request.params.id, request.body || {}, request.currentUser))
    } catch (error) {
      next(error)
    }
  },
)

router.get('/payments', requireAuth, canViewPayments, async (request, response, next) => {
  try {
    response.json(
      await paymentService.listPayments({
        limit: request.query.limit,
        status: request.query.status,
        provider: request.query.provider,
        movementId: request.query.movementId,
      }),
    )
  } catch (error) {
    next(error)
  }
})

router.get('/payments/transbank/return', handleTransbankReturn)

router.post('/payments/transbank/return', handleTransbankReturn)

router.get('/payments/:id', requireAuth, canViewPayments, async (request, response, next) => {
  try {
    response.json(await paymentService.getPaymentById(request.params.id))
  } catch (error) {
    next(error)
  }
})

router.post('/payments', requireAuth, canCreatePayments, async (request, response, next) => {
  try {
    const result = await paymentService.createPayment(request.body || {}, request.currentUser)
    response.status(201).json(result)
  } catch (error) {
    next(error)
  }
})

router.post('/payments/:id/transbank/create', requireAuth, canCreatePayments, async (request, response, next) => {
  try {
    response.json(await paymentService.createTransbankPaymentTransaction(request.params.id, request.currentUser))
  } catch (error) {
    next(error)
  }
})

router.post('/payments/:id/start-sandbox', requireAuth, canCreatePayments, async (request, response, next) => {
  try {
    response.json(await paymentService.startSandboxPayment(request.params.id, request.currentUser))
  } catch (error) {
    next(error)
  }
})

router.post('/payments/:id/approve', requireAuth, canApprovePayments, async (request, response, next) => {
  try {
    response.json(await paymentService.approvePayment(request.params.id, request.currentUser))
  } catch (error) {
    next(error)
  }
})

router.post('/payments/:id/reject', requireAuth, canApprovePayments, async (request, response, next) => {
  try {
    response.json(
      await paymentService.rejectPayment(request.params.id, request.currentUser, request.body?.reason || ''),
    )
  } catch (error) {
    next(error)
  }
})

router.post('/payments/:id/cancel', requireAuth, canApprovePayments, async (request, response, next) => {
  try {
    response.json(
      await paymentService.cancelPayment(request.params.id, request.currentUser, request.body?.reason || ''),
    )
  } catch (error) {
    next(error)
  }
})

router.post('/payments/:id/reconcile', requireAuth, canApprovePayments, async (request, response, next) => {
  try {
    response.json(await paymentService.reconcilePayment(request.params.id, request.currentUser))
  } catch (error) {
    next(error)
  }
})

router.get('/payments/:id/audit', requireAuth, canViewPayments, async (request, response, next) => {
  try {
    response.json(await paymentService.getPaymentAudit(request.params.id))
  } catch (error) {
    next(error)
  }
})

router.post('/demo/sandbox-payment', requireAuth, canCreatePayments, async (request, response, next) => {
  try {
    response.json(await paymentService.createSandboxPaymentDemo(request.currentUser))
  } catch (error) {
    next(error)
  }
})

router.post('/demo/transbank-payment', requireAuth, canCreatePayments, async (request, response, next) => {
  try {
    response.json(await paymentService.createTransbankPaymentDemo(request.currentUser))
  } catch (error) {
    next(error)
  }
})

module.exports = router
