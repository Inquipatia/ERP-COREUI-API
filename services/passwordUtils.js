const crypto = require('node:crypto')

const HASH_PREFIX = 'scrypt'
const KEY_LENGTH = 64

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(String(password || ''), salt, KEY_LENGTH).toString('hex')
  return `${HASH_PREFIX}$${salt}$${hash}`
}

const verifyPassword = (password, storedHash = '') => {
  const [algorithm, salt, expectedHash] = String(storedHash || '').split('$')

  if (algorithm !== HASH_PREFIX || !salt || !expectedHash) return false

  const actualHash = crypto.scryptSync(String(password || ''), salt, KEY_LENGTH)
  const expectedBuffer = Buffer.from(expectedHash, 'hex')

  return actualHash.length === expectedBuffer.length && crypto.timingSafeEqual(actualHash, expectedBuffer)
}

module.exports = {
  hashPassword,
  verifyPassword,
}
