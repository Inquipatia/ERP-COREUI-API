require('dotenv').config({ quiet: true })

const prismaAdapter = require('../services/postgresDataAdapter')
const { getPrisma } = require('../services/prismaClient')

const main = async () => {
  const result = await prismaAdapter.seedInitialData()
  console.log(JSON.stringify(result, null, 2))
}

main()
  .catch((error) => {
    console.error('No se pudo ejecutar seed Prisma:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      await getPrisma().$disconnect()
    } catch (_error) {
      // Si DATABASE_URL falta, el error principal ya fue reportado.
    }
  })
