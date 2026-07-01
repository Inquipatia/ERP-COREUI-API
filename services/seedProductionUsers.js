require('dotenv').config({ quiet: true })

const { getPrisma, disconnectPrisma } = require('./prismaClient')
const { hashPassword } = require('./passwordUtils')

const ALL_PERMISSIONS = [
  'admin.all',
  'dashboard.view',
  'clients.view',
  'clients.manage',
  'quotes.view',
  'quotes.create',
  'quotes.edit',
  'documents.view',
  'documents.manage',
  'tenders.view',
  'workorders.view',
  'workorders.create',
  'workorders.update',
  'workorders.assign',
  'workorders.complete',
  'workorders.delete',
  'users.view',
  'users.manage',
  'finance.view',
  'finance.create',
  'finance.update',
  'finance.manage',
  'finance.payments',
  'payments.view',
  'payments.create',
  'payments.approve',
  'suppliers.view',
  'suppliers.manage',
  'products.view',
  'products.manage',
  'materials.view',
  'materials.manage',
  'ai.chat',
]

const ROLE_PERMISSIONS = {
  owner: ALL_PERMISSIONS,
  finance: [
    'dashboard.view',
    'clients.view',
    'quotes.view',
    'documents.view',
    'tenders.view',
    'workorders.view',
    'workorders.create',
    'workorders.update',
    'finance.view',
    'finance.create',
    'finance.update',
    'finance.manage',
    'finance.payments',
    'payments.view',
    'payments.create',
    'payments.approve',
    'suppliers.view',
    'suppliers.manage',
    'products.view',
    'products.manage',
    'materials.view',
    'materials.manage',
    'ai.chat',
  ],
  sales: [
    'dashboard.view',
    'clients.view',
    'clients.manage',
    'quotes.view',
    'quotes.create',
    'quotes.edit',
    'documents.view',
    'documents.manage',
    'tenders.view',
    'workorders.view',
    'workorders.create',
    'workorders.update',
    'products.view',
    'products.manage',
    'materials.view',
    'ai.chat',
  ],
  production: [
    'dashboard.view',
    'documents.view',
    'workorders.view',
    'workorders.create',
    'workorders.update',
    'workorders.assign',
    'workorders.complete',
    'products.view',
    'materials.view',
    'materials.manage',
    'ai.chat',
  ],
  design: ['dashboard.view', 'documents.view', 'workorders.view', 'workorders.create', 'workorders.update', 'products.view', 'materials.view', 'ai.chat'],
}

const FINANCE_DEMO_EMAILS = [
  'r.rojas@rubikcreaciones.cl',
  'c.guzman@rubikcreaciones.cl',
  'brojas.romero@rubikcreaciones.cl',
  'contacto@rubikcreaciones.cl',
]

const FINANCE_DEMO_PERMISSIONS = [
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

const getSeedPermissions = (user) => {
  const permissions = ROLE_PERMISSIONS[user.permissionProfile] || ROLE_PERMISSIONS.design
  return FINANCE_DEMO_EMAILS.includes(String(user.email || '').toLowerCase())
    ? uniq([...permissions, ...FINANCE_DEMO_PERMISSIONS])
    : permissions
}

const USERS = [
  {
    id: 'usr-rodrigo-sepulveda',
    name: 'Rodrigo Sepúlveda',
    email: 'rsepulveda@rubikcreaciones.cl',
    role: 'Jefe venta',
    area: 'Ventas',
    permissionProfile: 'sales',
  },
  {
    id: 'usr-erick-cabrera',
    name: 'Erick Cabrera',
    email: 'erick@rubikcreaciones.cl',
    role: 'Venta publica',
    area: 'Licitaciones',
    permissionProfile: 'sales',
  },
  {
    id: 'usr-ramon-rojas',
    name: 'Ramón Rojas',
    email: 'r.rojas@rubikcreaciones.cl',
    role: 'Gerencia/finanza',
    area: 'Gerencia/Finanzas',
    permissionProfile: 'owner',
  },
  {
    id: 'usr-christian-guzman',
    name: 'Christian Guzmán',
    email: 'c.guzman@rubikcreaciones.cl',
    role: 'Jefe venta privada/finanza',
    area: 'Ventas/Finanzas',
    permissionProfile: 'finance',
  },
  {
    id: 'usr-ignacio-martinez',
    name: 'Ignacio Martínez',
    email: 'ignacio.m@rubikcreaciones.cl',
    role: 'Jefe taller',
    area: 'Produccion/Taller',
    permissionProfile: 'production',
  },
  {
    id: 'usr-benjamin-rojas',
    name: 'Benjamín Rojas',
    email: 'brojas.romero@rubikcreaciones.cl',
    role: 'Gerencia/dueño',
    area: 'Gerencia',
    permissionProfile: 'owner',
  },
  {
    id: 'usr-ivone-romero',
    name: 'Ivone Romero',
    email: 'contacto@rubikcreaciones.cl',
    role: 'Finanza/dueña',
    area: 'Gerencia/Finanzas',
    permissionProfile: 'owner',
  },
  {
    id: 'usr-mathias-olavarria',
    name: 'Mathias Olavarría',
    email: 'm.olavarria@rubikcreaciones.cl',
    role: 'Diseño/publicidad',
    area: 'Diseño/Marketing',
    permissionProfile: 'design',
  },
  {
    id: 'usr-jorge-gutierrez',
    name: 'Jorge Gutiérrez',
    email: 'jgutierrez@rubikcreaciones.cl',
    role: 'Diseño',
    area: 'Diseño',
    permissionProfile: 'design',
  },
]

const seedProductionUsers = async () => {
  const prisma = getPrisma()
  const initialPassword = process.env.INITIAL_USER_PASSWORD || '123456'
  const passwordHash = hashPassword(initialPassword)
  const summary = { created: 0, updated: 0, users: [] }

  for (const user of USERS) {
    const email = user.email.toLowerCase()
    const existingUser = await prisma.user.findUnique({ where: { email } })
    const permissions = getSeedPermissions(user)

    if (existingUser) {
      await prisma.user.update({
        where: { email },
        data: {
          name: user.name,
          role: user.role,
          status: existingUser.status || 'Activo',
          position: user.role,
          area: user.area,
          permissions,
          payload: {
            ...(existingUser.payload && typeof existingUser.payload === 'object' ? existingUser.payload : {}),
            productionSeed: true,
          },
        },
      })
      summary.updated += 1
    } else {
      await prisma.user.create({
        data: {
          id: user.id,
          name: user.name,
          email,
          password: '',
          passwordHash,
          role: user.role,
          status: 'Activo',
          position: user.role,
          area: user.area,
          permissions,
          payload: { productionSeed: true },
        },
      })
      summary.created += 1
    }

    summary.users.push(email)
  }

  return summary
}

if (require.main === module) {
  seedProductionUsers()
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2))
    })
    .catch((error) => {
      console.error(error)
      process.exitCode = 1
    })
    .finally(async () => {
      await disconnectPrisma()
    })
}

module.exports = {
  seedProductionUsers,
}
