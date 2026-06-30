const express = require('express')
const { requireAuth, requirePermission } = require('../middleware/authMiddleware')
const { buildAssistantContext } = require('../services/assistantKnowledgeService')

const router = express.Router()

router.post('/query', requireAuth, requirePermission('ai.chat'), async (request, response, next) => {
  try {
    const { message = '', scope = 'all', limit = 10 } = request.body || {}

    if (!String(message).trim()) {
      response.status(400).json({
        error: 'Debes enviar una pregunta para consultar el asistente.',
      })
      return
    }

    const result = await buildAssistantContext(message, request.currentUser, {
      scope,
      limit,
    })

    response.json(result)
  } catch (error) {
    next(error)
  }
})

module.exports = router
