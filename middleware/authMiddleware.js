const dataAdapter = require('../services/dataAdapter')

const AUTH_DEBUG_ENABLED = process.env.AUTH_DEBUG === 'true' && process.env.NODE_ENV !== 'production'

const logAuthDebug = (request, details = {}) => {
  if (!AUTH_DEBUG_ENABLED) return

  console.debug('[Rubik auth]', {
    method: request.method,
    path: request.originalUrl || request.path,
    ...details,
  })
}

const getBearerToken = (request) => {
  const authorization = request.header('authorization') || ''
  if (!authorization.toLowerCase().startsWith('bearer ')) return ''
  return authorization.slice(7).trim()
}

const attachUser = (request, _response, next) => {
  const authorization = request.header('authorization') || ''
  const token = getBearerToken(request)
  const currentUser = token ? dataAdapter.getUserByToken(token) : null

  request.authToken = token
  request.currentUser = currentUser

  if (!currentUser && request.path.startsWith('/api')) {
    logAuthDebug(request, {
      authMethod: token ? 'bearer' : 'none',
      hasAuthorizationHeader: Boolean(authorization),
      hasBearerToken: Boolean(token),
      reason: !authorization
        ? 'missing_authorization_header'
        : !token
          ? 'malformed_bearer_header'
          : 'unknown_or_expired_token',
    })
  }

  next()
}

const requireAuth = (request, response, next) => {
  if (request.currentUser) {
    next()
    return
  }

  response.status(401).json({ error: 'Sesion requerida.' })
}

const userHasPermission = (user, permission) => {
  if (!permission) return true
  const permissions = Array.isArray(user?.permissions) ? user.permissions : []
  return permissions.includes('admin.all') || permissions.includes(permission)
}

const requirePermission = (permission) => (request, response, next) => {
  if (userHasPermission(request.currentUser, permission)) {
    next()
    return
  }

  response.status(403).json({
    error: 'No tienes permiso para consultar esta informacion.',
    permission,
  })
}

module.exports = {
  attachUser,
  requireAuth,
  requirePermission,
  userHasPermission,
}
