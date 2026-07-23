const crypto = require('node:crypto')

const TOKEN_TYPE = 'rubik-auth'
const DEFAULT_TOKEN_TTL_SECONDS = 60 * 60 * 12

const base64UrlEncode = (value) =>
  Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

const base64UrlDecode = (value = '') => {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
  return Buffer.from(padded, 'base64').toString('utf8')
}

const getTokenTtlSeconds = () => {
  const configuredTtl = Number(process.env.AUTH_TOKEN_TTL_SECONDS || process.env.JWT_EXPIRES_IN_SECONDS)
  return Number.isFinite(configuredTtl) && configuredTtl > 0
    ? Math.trunc(configuredTtl)
    : DEFAULT_TOKEN_TTL_SECONDS
}

const getSigningSecret = () => {
  const secret = String(process.env.JWT_SECRET || '').trim()

  if (secret) return secret
  if (process.env.NODE_ENV !== 'production') return 'rubik-local-development-secret'

  const error = new Error('JWT_SECRET no esta configurado para emitir tokens de autenticacion.')
  error.statusCode = 500
  error.authFailureCategory = 'missing_jwt_secret'
  throw error
}

const sign = (payload, secret) =>
  crypto.createHmac('sha256', secret).update(payload).digest('base64url')

const safeEqual = (firstValue = '', secondValue = '') => {
  const first = Buffer.from(String(firstValue))
  const second = Buffer.from(String(secondValue))

  return first.length === second.length && crypto.timingSafeEqual(first, second)
}

const createAuthToken = (user = {}) => {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = {
    typ: TOKEN_TYPE,
    sub: String(user.id || ''),
    email: String(user.email || '').toLowerCase(),
    iat: now,
    exp: now + getTokenTtlSeconds(),
  }
  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signingInput = `${encodedHeader}.${encodedPayload}`
  const signature = sign(signingInput, getSigningSecret())

  return `${signingInput}.${signature}`
}

const verifyAuthToken = (token = '') => {
  const [encodedHeader, encodedPayload, signature] = String(token || '').split('.')

  if (!encodedHeader || !encodedPayload || !signature) {
    const error = new Error('Token de autenticacion mal formado.')
    error.authFailureCategory = 'malformed_token'
    throw error
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`
  const expectedSignature = sign(signingInput, getSigningSecret())

  if (!safeEqual(signature, expectedSignature)) {
    const error = new Error('Firma de token invalida.')
    error.authFailureCategory = 'invalid_token_signature'
    throw error
  }

  let payload
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload))
  } catch (_error) {
    const error = new Error('Payload de token invalido.')
    error.authFailureCategory = 'invalid_token_payload'
    throw error
  }

  if (payload?.typ !== TOKEN_TYPE || !payload.sub || !payload.email) {
    const error = new Error('Token de autenticacion incompleto.')
    error.authFailureCategory = 'invalid_token_payload'
    throw error
  }

  const now = Math.floor(Date.now() / 1000)
  if (Number(payload.exp || 0) <= now) {
    const error = new Error('Token de autenticacion expirado.')
    error.authFailureCategory = 'expired_token'
    throw error
  }

  return payload
}

module.exports = {
  createAuthToken,
  getTokenTtlSeconds,
  verifyAuthToken,
}
