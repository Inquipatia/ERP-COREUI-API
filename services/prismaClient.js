require('dotenv').config({ quiet: true })

const DATABASE_URL_ERROR =
  'DATABASE_URL no existe. Configura MySQL en .env, por ejemplo: ' +
  'DATABASE_URL="mysql://usuario:password@host:3306/u415737934_erp_rubik"'

const assertDatabaseUrl = () => {
  if (!process.env.DATABASE_URL) {
    const error = new Error(DATABASE_URL_ERROR)
    error.statusCode = 500
    throw error
  }
}

let PrismaClient
let prismaInstance
let shutdownHandlersRegistered = false

const loadPrismaClient = () => {
  if (PrismaClient) return PrismaClient

  try {
    ;({ PrismaClient } = require('@prisma/client'))
    return PrismaClient
  } catch (error) {
    const prismaError = new Error(
      'No se encontro @prisma/client generado. Ejecuta npm install y luego npm run db:generate.',
    )
    prismaError.cause = error
    throw prismaError
  }
}

const getPrisma = () => {
  assertDatabaseUrl()

  if (prismaInstance) return prismaInstance

  const Client = loadPrismaClient()
  const globalForPrisma = globalThis

  prismaInstance =
    globalForPrisma.rubikPrismaClient ||
    new Client({
      log:
        process.env.PRISMA_QUERY_LOG === 'true'
          ? ['query', 'info', 'warn', 'error']
          : ['warn', 'error'],
    })

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.rubikPrismaClient = prismaInstance
  }

  registerShutdownHandlers()

  return prismaInstance
}

const disconnectPrisma = async () => {
  if (!prismaInstance) return

  await prismaInstance.$disconnect()
  prismaInstance = null

  if (globalThis.rubikPrismaClient) {
    globalThis.rubikPrismaClient = null
  }
}

const registerShutdownHandlers = () => {
  if (shutdownHandlersRegistered || process.env.RUBIK_SKIP_PRISMA_SHUTDOWN_HANDLERS === 'true') {
    return
  }

  shutdownHandlersRegistered = true

  const shutdown = async () => {
    try {
      await disconnectPrisma()
    } catch (error) {
      console.error('Error desconectando Prisma:', error)
    }
  }

  process.once('beforeExit', shutdown)
  process.once('SIGINT', async () => {
    await shutdown()
    process.exit(0)
  })
  process.once('SIGTERM', async () => {
    await shutdown()
    process.exit(0)
  })
}

module.exports = {
  assertDatabaseUrl,
  disconnectPrisma,
  getPrisma,
  get prisma() {
    return getPrisma()
  },
}
