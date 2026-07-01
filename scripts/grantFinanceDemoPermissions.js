require('dotenv').config({ quiet: true })

const { getPrisma, disconnectPrisma } = require('../services/prismaClient')

const DEMO_EMAILS = [
  'r.rojas@rubikcreaciones.cl',
  'c.guzman@rubikcreaciones.cl',
  'brojas.romero@rubikcreaciones.cl',
  'contacto@rubikcreaciones.cl',
]

const SALES_EMAILS_WITHOUT_FINANCE = ['rsepulveda@rubikcreaciones.cl']

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
    revoked: 0,
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

  for (const email of SALES_EMAILS_WITHOUT_FINANCE) {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      summary.missing.push(email)
      continue
    }

    const roleText = `${user.role || ''} ${user.position || ''} ${user.area || ''}`.toLowerCase()
    const isSalesUser = roleText.includes('venta') || roleText.includes('sales')
    const before = Array.isArray(user.permissions) ? user.permissions : []
    const after = isSalesUser
      ? before.filter((permission) => !DEMO_PERMISSIONS.includes(permission))
      : before
    const removed = before.filter((permission) => !after.includes(permission))

    if (removed.length > 0) {
      await prisma.user.update({
        where: { email },
        data: {
          permissions: after,
          payload: {
            ...(user.payload && typeof user.payload === 'object' ? user.payload : {}),
            financeDemoPermissionsRevokedAt: new Date().toISOString(),
          },
        },
      })
      summary.revoked += 1
    }

    summary.users.push({
      email,
      before,
      after,
      removed,
      skipped: isSalesUser ? undefined : 'Usuario no parece ser ventas; no se revocaron permisos.',
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
