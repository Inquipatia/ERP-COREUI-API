require('dotenv').config({ quiet: true })

const { getPrisma, disconnectPrisma } = require('../services/prismaClient')

const DEMO_EMAILS = [
  'rsepulveda@rubikcreaciones.cl',
  'r.rojas@rubikcreaciones.cl',
  'c.guzman@rubikcreaciones.cl',
  'brojas.romero@rubikcreaciones.cl',
  'contacto@rubikcreaciones.cl',
]

const DEMO_PERMISSIONS = [
  'finance.view',
  'finance.create',
  'finance.update',
  'finance.manage',
  'finance.payments',
  'payments.view',
  'payments.create',
  'payments.approve',
]

const uniq = (values) => [...new Set((values || []).filter(Boolean))]

const main = async () => {
  const adapterMode = String(process.env.DATA_ADAPTER_MODE || process.env.RUBIK_DATA_ADAPTER || '').toLowerCase()
  const prisma = getPrisma()
  const summary = {
    ok: true,
    adapter: adapterMode || 'prisma',
    updated: 0,
    missing: [],
    users: [],
  }

  for (const email of DEMO_EMAILS) {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      summary.missing.push(email)
      continue
    }

    const before = Array.isArray(user.permissions) ? user.permissions : []
    const after = uniq([...before, ...DEMO_PERMISSIONS])
    const added = after.filter((permission) => !before.includes(permission))

    if (added.length > 0) {
      await prisma.user.update({
        where: { email },
        data: {
          permissions: after,
          payload: {
            ...(user.payload && typeof user.payload === 'object' ? user.payload : {}),
            financeDemoPermissionsGrantedAt: new Date().toISOString(),
          },
        },
      })
      summary.updated += 1
    }

    summary.users.push({
      email,
      before,
      after,
      added,
    })
  }

  console.log(JSON.stringify(summary, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectPrisma()
  })
