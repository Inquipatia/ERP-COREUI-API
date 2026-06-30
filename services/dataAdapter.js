const { randomUUID } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const {
  calculateFinanceMovement,
  getNumberValue,
  registerMovementPayment,
} = require('../utils/financeCalculations')

const TEMP_DEV_PASSWORD = '123456'

const PERMISSIONS = [
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
  'users.view',
  'users.manage',
  'finance.view',
  'finance.manage',
  'finance.payments',
  'suppliers.view',
  'suppliers.manage',
  'products.view',
  'products.manage',
  'materials.view',
  'materials.manage',
  'ai.chat',
]

const OWNER_EMAILS = [
  'r.rojas@rubikcreaciones.cl',
  'brojas.romero@rubikcreaciones.cl',
  'contacto@rubikcreaciones.cl',
]

const uniq = (values) => [...new Set((values || []).filter(Boolean))]

const normalizeText = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

const getPermissionsForRole = (role = '', email = '') => {
  if (OWNER_EMAILS.includes(String(email).toLowerCase())) return PERMISSIONS

  const normalizedRole = normalizeText(role)

  if (normalizedRole.includes('finanzas')) {
    return [
      'dashboard.view',
      'clients.view',
      'quotes.view',
      'documents.view',
      'tenders.view',
      'workorders.view',
      'finance.view',
      'finance.manage',
      'finance.payments',
      'suppliers.view',
      'suppliers.manage',
      'products.view',
      'products.manage',
      'materials.view',
      'materials.manage',
      'ai.chat',
    ]
  }

  if (normalizedRole.includes('venta') || normalizedRole.includes('licitaciones')) {
    return [
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
      'products.view',
      'products.manage',
      'materials.view',
      'ai.chat',
    ]
  }

  if (normalizedRole.includes('taller') || normalizedRole.includes('produccion')) {
    return [
      'dashboard.view',
      'documents.view',
      'workorders.view',
      'workorders.create',
      'products.view',
      'materials.view',
      'materials.manage',
      'ai.chat',
    ]
  }

  return ['dashboard.view', 'documents.view', 'workorders.view', 'ai.chat']
}

const sanitizeUser = (user) => {
  const { password, ...safeUser } = user
  return safeUser
}

const createId = (prefix) => `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`

const DATA_DIR = path.join(__dirname, '..', 'data')
const DB_FILE = path.join(DATA_DIR, 'rubik-db.json')
const COLLECTION_KEYS = [
  'users',
  'clients',
  'quotes',
  'documents',
  'tenders',
  'workOrders',
  'suppliers',
  'financeMovements',
  'products',
  'materials',
  'expenses',
]

const getDateOffset = (days) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

const seedClients = [
  ['client-expo-lanas', 'Maria Gonzalez', 'Expo Lanas Chile', '76.111.111-1', '+56911111111', 'contacto@expolanas.cl', 'Santiago'],
  ['client-cafe-sur', 'Valentina Soto', 'Cafe Sur SPA', '77.222.222-2', '+56922222222', 'ventas@cafesur.cl', 'Providencia'],
  ['client-agua-santiago', 'Diego Herrera', 'Fondo de Agua de Santiago', '65.333.333-3', '+56933333333', 'licitaciones@aguasantiago.cl', 'Las Condes'],
  ['client-municipalidad-norte', 'Paula Marin', 'Municipalidad Norte', '69.444.444-4', '+56944444444', 'compras@muninorte.cl', 'Huechuraba'],
  ['client-retail-pop', 'Camila Rivas', 'Retail POP Chile', '76.555.555-5', '+56955555555', 'marketing@retailpop.cl', 'Nunoa'],
  ['client-feria-industrial', 'Jorge Araya', 'Feria Industrial SPA', '77.666.666-6', '+56966666666', 'operaciones@feriaindustrial.cl', 'Maipu'],
  ['client-clinica-visual', 'Daniela Vera', 'Clinica Visual', '76.777.777-7', '+56977777777', 'admin@clinicavisual.cl', 'La Florida'],
  ['client-constructora-andes', 'Hector Pizarro', 'Constructora Andes', '77.888.888-8', '+56988888888', 'contacto@andes.cl', 'Quilicura'],
  ['client-universidad-sur', 'Fernanda Leiva', 'Universidad del Sur', '70.999.999-9', '+56999999999', 'extension@universidadsur.cl', 'Santiago'],
  ['client-eventos-corporativos', 'Matias Fuentes', 'Eventos Corporativos SPA', '76.101.101-0', '+56910101010', 'produccion@eventoscorp.cl', 'Vitacura'],
]

const createSeedClients = () =>
  seedClients.map(([id, contactName, company, rut, phone, email, commune]) => ({
    id,
    contactName,
    company,
    rut,
    phone,
    email,
    commune,
    address: commune,
    status: 'Activo',
    observations: '',
  }))

const createSeedQuotes = () =>
  [
    ['quote-8105', '8105', '2026-06-11', 'Valentina Soto', 'Cafe Sur SPA', 'Christian Guzman', 'Vinilo impreso para POP', 320000, 60800, 'Aprobada'],
    ['quote-8106', '8106', '2026-06-12', 'Maria Gonzalez', 'Expo Lanas Chile', 'Rodrigo Sepulveda', 'Stand modular feria', 1850000, 351500, 'Emitida'],
    ['quote-8107', '8107', '2026-06-13', 'Diego Herrera', 'Fondo de Agua de Santiago', 'Erick Cabrera', 'Arriendo de stands Expo Agua', 4200000, 798000, 'Borrador'],
    ['quote-8108', '8108', '2026-06-14', 'Paula Marin', 'Municipalidad Norte', 'Erick Cabrera', 'Grafica licitacion municipal', 980000, 186200, 'Enviada'],
    ['quote-8109', '8109', '2026-06-15', 'Camila Rivas', 'Retail POP Chile', 'Christian Guzman', 'Campana POP retail', 1450000, 275500, 'Aprobada'],
    ['quote-8110', '8110', '2026-06-16', 'Jorge Araya', 'Feria Industrial SPA', 'Rodrigo Sepulveda', 'Totems y senaletica', 2650000, 503500, 'Emitida'],
    ['quote-8111', '8111', '2026-06-17', 'Daniela Vera', 'Clinica Visual', 'Christian Guzman', 'Letrero acrilico recepcion', 760000, 144400, 'Borrador'],
    ['quote-8112', '8112', '2026-06-18', 'Hector Pizarro', 'Constructora Andes', 'Rodrigo Sepulveda', 'Letreros de obra', 1180000, 224200, 'Adjudicada'],
    ['quote-8113', '8113', '2026-06-19', 'Fernanda Leiva', 'Universidad del Sur', 'Erick Cabrera', 'Pendones institucionales', 540000, 102600, 'Emitida'],
    ['quote-8114', '8114', '2026-06-20', 'Matias Fuentes', 'Eventos Corporativos SPA', 'Rodrigo Sepulveda', 'Backing fotografico evento', 890000, 169100, 'Borrador'],
  ].map(([id, quoteNumber, date, client, company, seller, subject, netAmount, taxAmount, status]) => ({
    id,
    quoteNumber,
    date,
    client,
    company,
    seller,
    subject,
    condition: '30 dias',
    netAmount,
    taxAmount,
    totalAmount: netAmount + taxAmount,
    status,
    items: [{ quantity: 1, description: subject, unitValue: netAmount, total: netAmount }],
  }))

const createSeedDocuments = (quotes) =>
  quotes.map((quote) => ({
    id: `doc-${quote.quoteNumber}`,
    type: 'Cotizacion',
    documentNumber: quote.quoteNumber,
    date: quote.date,
    client: quote.client,
    company: quote.company,
    seller: quote.seller,
    totalAmount: quote.totalAmount,
    status: ['Aprobada', 'Adjudicada'].includes(quote.status) ? 'Adjudicada' : quote.status === 'Borrador' ? 'Borrador' : 'Emitida',
    tags: ['cotizacion'],
    observations: quote.subject,
    createdAt: `${quote.date}T12:00:00.000Z`,
    updatedAt: `${quote.date}T12:00:00.000Z`,
  }))

const createSeedWorkOrders = () =>
  [
    ['wo-001', 'Arte final Cafe Sur', 'Diseno grafico', 'Ventas', 'Diseno', 'Alta', 'En proceso', -1],
    ['wo-002', 'Produccion stand Expo Lanas', 'Produccion grafica', 'Diseno', 'Produccion', 'Media', 'Pendiente', 5],
    ['wo-003', 'Revision tecnica Expo Agua', 'Licitacion', 'Licitaciones', 'Produccion', 'Urgente', 'En revision', 2],
    ['wo-004', 'Instalacion municipal', 'Instalacion', 'Produccion', 'Instalaciones', 'Alta', 'Pendiente', 7],
    ['wo-005', 'Compra acrilicos Clinica Visual', 'Compra', 'Produccion', 'Compras', 'Media', 'Finalizada', -3],
    ['wo-006', 'Mockups Retail POP', 'Diseno grafico', 'Marketing', 'Diseno', 'Media', 'En proceso', 4],
    ['wo-007', 'Totems Feria Industrial', 'Produccion grafica', 'Ventas', 'Taller', 'Alta', 'Pendiente', 8],
    ['wo-008', 'Facturacion Constructora Andes', 'Administrativo', 'Ventas', 'Administracion', 'Baja', 'Aprobada', 1],
    ['wo-009', 'Pendones Universidad Sur', 'Produccion grafica', 'Diseno', 'Produccion', 'Media', 'En revision', 3],
    ['wo-010', 'Backing Eventos Corporativos', 'Instalacion', 'Ventas', 'Instalaciones', 'Urgente', 'Pendiente', 1],
  ].map(([id, title, type, sourceArea, targetArea, priority, status, offset]) => ({
    id,
    title,
    type,
    client: '',
    company: '',
    quoteNumber: '',
    requesterName: 'Rodrigo Sepulveda',
    assigneeName: 'Mathias Olavarria',
    sourceArea,
    targetArea,
    priority,
    status,
    dueDate: getDateOffset(offset),
    description: title,
    comments: [],
    movements: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))

const createSeedSuppliers = () =>
  [
    ['sup-grafica-santiago', 'Proveedor Grafica Santiago', '76.000.000-0', 'Insumos'],
    ['sup-acrilicos-center', 'Acrilicos Center', '76.000.001-9', 'Materiales rigidos'],
    ['sup-lonas-pro', 'Lonas Pro', '76.000.002-7', 'PVC y telas'],
    ['sup-taller-metal', 'Taller Metal Norte', '76.000.003-5', 'Estructuras'],
    ['sup-instalaciones-rubik', 'Servicios Instalacion Rubik', '76.000.004-3', 'Instalacion'],
    ['sup-transporte-rapido', 'Transporte Rapido SPA', '76.000.005-1', 'Despacho'],
    ['sup-impresion-digital', 'Insumos Impresion Digital', '76.000.006-K', 'Tintas'],
    ['sup-ferreteria-central', 'Ferreteria Central', '76.000.007-8', 'Herramientas'],
    ['sup-software-diseno', 'Software Diseno Pro', '76.000.008-6', 'Software'],
    ['sup-servicios-contables', 'Servicios Contables Rubik', '76.000.009-4', 'Contabilidad'],
  ].map(([id, name, rut, category]) => ({
    id,
    name,
    rut,
    contactName: 'Contacto proveedor',
    email: `${id.replace('sup-', '')}@example.com`,
    category,
    status: 'Activo',
  }))

const createSeedProducts = () =>
  [
    ['prd-pendon-roller', 'Pendon roller', 'Display', 'unidad', 'Pendon roller con impresion full color y bolso de transporte.', 28500, 49000, 'PVC 13 oz', 'Activo'],
    ['prd-letrero-acrilico', 'Letrero acrilico', 'Letreros', 'unidad', 'Letrero en acrilico cortado con grafica o vinilo aplicado.', 68000, 118000, 'Acrilico 4 mm', 'Activo'],
    ['prd-vinilo-impreso', 'Vinilo impreso', 'Grafica adhesiva', 'm2', 'Impresion en vinilo adhesivo con tintas eco solventes.', 8900, 18500, 'Adhesivo impreso', 'Activo'],
    ['prd-instalacion-grafica', 'Instalacion grafica', 'Servicio', 'hora', 'Servicio de instalacion en terreno con equipo tecnico.', 18000, 32000, 'No aplica', 'Activo'],
  ].map(([id, name, category, unit, technicalDescription, baseCost, suggestedPrice, material, status]) => ({
    id,
    name,
    category,
    unit,
    technicalDescription,
    baseCost,
    suggestedPrice,
    material,
    status,
  }))

const createSeedMaterials = () =>
  [
    ['mat-pvc-13', 'PVC 13 oz', 'Lonas y telas', 'm2', 4200, 8, 35, 'Proveedor grafico general'],
    ['mat-acrilico-4', 'Acrilico 4 mm', 'Acrilicos', 'plancha', 58000, 15, 42, 'Proveedor acrilicos'],
    ['mat-sintra-3', 'Sintra 3 mm', 'Rigidos', 'plancha', 16500, 10, 36, 'Distribuidor de sustratos'],
    ['mat-adhesivo-impreso', 'Adhesivo impreso', 'Vinilos', 'm2', 6800, 10, 40, 'Proveedor vinilos'],
  ].map(([id, name, category, unit, baseCost, wastePercent, marginPercent, supplier]) => ({
    id,
    name,
    category,
    unit,
    baseCost,
    unitCost: baseCost,
    wastePercent,
    marginPercent,
    supplier,
    supplierName: supplier,
    status: 'Activo',
  }))

const createSeedFinanceMovements = () =>
  [
    ['fin-001', 'Ingreso', 'Venta', 'COT-8105', 'Cafe Sur SPA', '', 'Vinilo impreso POP', 320000, 0, -12],
    ['fin-002', 'Ingreso', 'Venta', 'COT-8106', 'Expo Lanas Chile', '', 'Stand modular feria', 1850000, 900000, 8],
    ['fin-003', 'Ingreso', 'Venta', 'COT-8108', 'Municipalidad Norte', '', 'Grafica licitacion municipal', 980000, 0, -4],
    ['fin-004', 'Ingreso', 'Venta', 'COT-8109', 'Retail POP Chile', '', 'Campana POP retail', 1450000, 1725500, 3],
    ['fin-005', 'Ingreso', 'Venta', 'COT-8112', 'Constructora Andes', '', 'Letreros de obra', 1180000, 700000, 12],
    ['fin-006', 'Egreso', 'Insumos', 'F-2001', '', 'Proveedor Grafica Santiago', 'Compra PVC y tintas', 350000, 416500, -2],
    ['fin-007', 'Egreso', 'Materiales', 'F-2002', '', 'Acrilicos Center', 'Acrilicos 4 mm', 520000, 0, 6],
    ['fin-008', 'Egreso', 'Instalacion', 'F-2003', '', 'Servicios Instalacion Rubik', 'Equipo instalacion retail', 280000, 150000, 4],
    ['fin-009', 'Egreso', 'Software', 'F-2004', '', 'Software Diseno Pro', 'Licencias diseno', 190000, 226100, 1],
    ['fin-010', 'Egreso', 'Transporte', 'F-2005', '', 'Transporte Rapido SPA', 'Despachos junio', 140000, 0, -7],
  ].map(([id, type, category, documentNumber, company, supplierName, description, netAmount, paidAmount, dueOffset]) =>
    calculateFinanceMovement({
      id,
      type,
      category,
      documentType: 'Factura afecta',
      documentNumber,
      client: type === 'Ingreso' ? company : '',
      company: type === 'Ingreso' ? company : '',
      supplierName: type === 'Egreso' ? supplierName : '',
      description,
      netAmount,
      taxRate: 19,
      paidAmount,
      issueDate: getDateOffset(-10),
      dueDate: getDateOffset(dueOffset),
      paymentMethod: 'Transferencia',
      responsibleName: type === 'Ingreso' ? 'Christian Guzman' : 'Ivone Romero',
      responsibleEmail: type === 'Ingreso' ? 'c.guzman@rubikcreaciones.cl' : 'contacto@rubikcreaciones.cl',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
  )

const createSeedTenders = () =>
  [
    ['tender-001', '1425521-3-LE26', 'Arriendo de stands para Feria Expo Agua 2026', 'Fondo de Agua de Santiago', 31000000, 11, 'En analisis', 'Medio'],
    ['tender-002', '1057493-12-LP26', 'Senaletica interior edificio municipal', 'Municipalidad Norte', 18500000, 7, 'Cotizando', 'Alto'],
    ['tender-003', '998877-8-LE26', 'Produccion grafica campana salud', 'Servicio de Salud Metropolitano', 12500000, 18, 'Consultas', 'Medio'],
    ['tender-004', '774411-4-LQ26', 'Implementacion stand feria empleo', 'Universidad del Sur', 22000000, 25, 'Lista para ofertar', 'Bajo'],
    ['tender-005', '665544-2-LE26', 'Vinilos y letreros para dependencias', 'Ministerio de Cultura', 9600000, 3, 'En analisis', 'Critico'],
    ['tender-006', '553322-7-LP26', 'Totems informativos centros comunitarios', 'Gobierno Regional', 44000000, 32, 'Borrador', 'Medio'],
    ['tender-007', '441100-9-LE26', 'Material POP para campana reciclaje', 'Municipalidad de Providencia', 7800000, 14, 'Postulada', 'Bajo'],
    ['tender-008', '337799-1-LQ26', 'Grafica vehicular institucional', 'Empresa Portuaria', 16800000, 21, 'Cotizando', 'Medio'],
    ['tender-009', '220011-5-LE26', 'Pendones y estructuras para seminario', 'CORFO', 5400000, -2, 'Perdida', 'Alto'],
    ['tender-010', '119900-6-LP26', 'Sistema de exhibicion modular', 'Subsecretaria de Turismo', 36500000, 40, 'Adjudicada', 'Bajo'],
  ].map(([id, tenderId, title, buyer, budget, closingOffset, status, riskLevel]) => ({
    id,
    tenderId,
    title,
    buyer,
    buyerRut: '',
    budget,
    closingDate: getDateOffset(closingOffset),
    status,
    riskLevel,
    object: title,
    summary: `${title} para ${buyer}.`,
    administrativeRequirements: 'Declaraciones juradas, antecedentes legales y anexos administrativos.',
    technicalRequirements: 'Cumplimiento de especificaciones tecnicas, plazos y experiencia demostrable.',
    economicRequirements: 'Oferta economica valorizada por item.',
    requiredDocuments: ['Anexo administrativo', 'Oferta tecnica', 'Oferta economica'],
    essentialDocuments: ['Oferta economica', 'Declaracion jurada'],
    evaluationCriteria: ['Precio', 'Experiencia', 'Calidad tecnica'],
    guarantees: 'Revisar garantia de seriedad y fiel cumplimiento segun bases.',
    paymentTerms: 'Pago contra recepcion conforme.',
    penalties: 'Multas por atraso segun bases.',
    risks: riskLevel === 'Critico' ? ['Cierre proximo', 'Requisitos excluyentes'] : ['Revisar anexos obligatorios'],
    suggestedQuestions: ['Confirmar medidas finales', 'Validar formato de oferta economica'],
    technicalItems: [{ description: title, quantity: 1, unit: 'servicio' }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))

const createSeedUsers = () =>
  [
    ['usr-rodrigo-sepulveda', 'Rodrigo Sepulveda', 'rsepulveda@rubikcreaciones.cl', 'Jefe de ventas', 'Ventas'],
    ['usr-erick-cabrera', 'Erick Cabrera', 'erick@rubikcreaciones.cl', 'Ejecutivo venta publica', 'Licitaciones'],
    ['usr-ramon-rojas', 'Ramon Rojas', 'r.rojas@rubikcreaciones.cl', 'Gerencia/Admin', 'Gerencia/Finanzas'],
    ['usr-christian-guzman', 'Christian Guzman', 'c.guzman@rubikcreaciones.cl', 'Jefe venta privada', 'Ventas/Finanzas'],
    ['usr-ignacio-martinez', 'Ignacio Martinez', 'Ignacio.m@rubikcreaciones.cl', 'Jefe de taller', 'Produccion/Taller'],
    ['usr-benjamin-rojas', 'Benjamin Rojas', 'brojas.romero@rubikcreaciones.cl', 'Gerencia/Admin', 'Gerencia'],
    ['usr-ivone-romero', 'Ivone Romero', 'contacto@rubikcreaciones.cl', 'Gerencia/Admin', 'Gerencia/Finanzas'],
    ['usr-mathias-olavarria', 'Mathias Olavarria', 'm.olavarria@rubikcreaciones.cl', 'Diseno y publicidad', 'Diseno/Marketing'],
    ['usr-jorge-gutierrez', 'Jorge Gutierrez', 'jgutierrez@rubikcreaciones.cl', 'Disenador imprenta', 'Diseno/Imprenta'],
  ].map(([id, name, email, role, area]) => ({
    id,
    name,
    email,
    role,
    area,
    status: 'Activo',
    position: role,
    permissions: getPermissionsForRole(role, email),
    password: TEMP_DEV_PASSWORD,
  }))

const createInitialDatabase = () => {
  const seedQuotes = createSeedQuotes()

  return {
    users: createSeedUsers(),
    clients: createSeedClients(),
    quotes: seedQuotes,
    documents: createSeedDocuments(seedQuotes),
    tenders: createSeedTenders(),
    workOrders: createSeedWorkOrders(),
    suppliers: createSeedSuppliers(),
    financeMovements: createSeedFinanceMovements(),
    products: createSeedProducts(),
    materials: createSeedMaterials(),
    expenses: [],
  }
}

const serializeDatabase = (database) =>
  COLLECTION_KEYS.reduce((payload, key) => {
    payload[key] = Array.isArray(database[key]) ? database[key] : []
    return payload
  }, {})

const persistDatabase = () => {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(DB_FILE, `${JSON.stringify(serializeDatabase(state), null, 2)}\n`, 'utf8')
}

const loadDatabase = () => {
  const seedDatabase = createInitialDatabase()

  if (!fs.existsSync(DB_FILE)) {
    return seedDatabase
  }

  try {
    const storedDatabase = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))
    return COLLECTION_KEYS.reduce((database, key) => {
      const storedCollection = storedDatabase?.[key]
      database[key] = Array.isArray(storedCollection) && storedCollection.length > 0 ? storedCollection : seedDatabase[key]
      return database
    }, {})
  } catch (error) {
    console.error(`No se pudo leer ${DB_FILE}. Se usaran datos seed.`, error)
    return seedDatabase
  }
}

const state = {
  sessions: new Map(),
  ...loadDatabase(),
}

const login = ({ email, password }) => {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const user = state.users.find((candidate) => candidate.email.toLowerCase() === normalizedEmail)

  if (!user || user.status !== 'Activo' || String(user.password) !== String(password || '')) {
    const error = new Error('Credenciales invalidas.')
    error.statusCode = 401
    throw error
  }

  const token = `rubik-token-${randomUUID()}`
  const safeUser = sanitizeUser(user)
  state.sessions.set(token, safeUser)

  return { token, user: safeUser }
}

const getUserByToken = (token) => state.sessions.get(token) || null

const list = (key) => state[key] || []

const getBusinessKey = (key, item = {}) => {
  if (item.id) return `id:${item.id}`
  if (key === 'users' && item.email) return `email:${String(item.email).toLowerCase()}`
  if (key === 'clients' && item.rut) return `rut:${String(item.rut).toLowerCase()}`
  if (key === 'quotes' && item.quoteNumber) return `quote:${String(item.quoteNumber)}`
  if (key === 'documents') {
    const type = item.tipoDocumento || item.type || 'Documento'
    const number = item.numeroDocumento || item.documentNumber || item.quoteNumber || ''
    if (number) return `doc:${type}:${number}`
  }
  if (key === 'tenders' && item.tenderId) return `tender:${String(item.tenderId).toLowerCase()}`
  if (key === 'suppliers' && item.rut) return `rut:${String(item.rut).toLowerCase()}`
  return ''
}

const mergeCollectionItem = (currentItem = {}, nextItem = {}) => ({
  ...currentItem,
  ...nextItem,
  id: currentItem.id || nextItem.id,
  createdAt: currentItem.createdAt || nextItem.createdAt || new Date().toISOString(),
  updatedAt: nextItem.updatedAt || new Date().toISOString(),
})

const getQuoteDocumentStatus = (quoteStatus = '') => {
  if (['Aprobada', 'Adjudicada'].includes(quoteStatus)) return 'Adjudicada'
  if (quoteStatus === 'Borrador') return 'Borrador'
  return 'Emitida'
}

const buildQuoteDocumentPayload = (quote = {}) => ({
  id: `doc-${quote.quoteNumber || quote.id || Date.now()}`,
  type: 'Cotizacion',
  documentNumber: String(quote.quoteNumber || quote.documentNumber || Date.now()),
  date: quote.date || new Date().toISOString(),
  client: quote.client || '',
  company: quote.company || '',
  seller: quote.seller || '',
  netAmount: getNumberValue(quote.netAmount ?? quote.net),
  taxAmount: getNumberValue(quote.taxAmount ?? quote.iva),
  totalAmount: getNumberValue(quote.totalAmount ?? quote.total),
  status: getQuoteDocumentStatus(quote.status || quote.estado),
  origin: 'quotes',
  tags: ['cotizacion'],
  observations: quote.subject || quote.observations || '',
  items: Array.isArray(quote.items) ? quote.items : [],
  payload: {
    quoteId: quote.id || '',
    quoteNumber: quote.quoteNumber || '',
  },
  createdAt: quote.createdAt || new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

const syncQuoteDocument = (quote = {}) => {
  if (!quote?.quoteNumber) return null

  const documentPayload = buildQuoteDocumentPayload(quote)
  const index = state.documents.findIndex((document) => {
    const sameDocument =
      document.type === documentPayload.type && String(document.documentNumber) === documentPayload.documentNumber
    const sameQuote = document.origin === 'quotes' && document.payload?.quoteId && document.payload.quoteId === quote.id
    return sameDocument || sameQuote
  })

  if (index === -1) {
    state.documents = [documentPayload, ...list('documents')]
    return documentPayload
  }

  state.documents[index] = mergeCollectionItem(state.documents[index], documentPayload)
  return state.documents[index]
}

const getTimestamp = (item = {}) => {
  const timestamp = new Date(item.updatedAt || item.createdAt || item.date || item.fecha || 0).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

const getChartLabel = (value, fallback = 'Sin clasificar') => {
  const label = String(value || '').trim()
  return label || fallback
}

const countBy = (items = [], selector, fallback) =>
  Object.entries(
    items.reduce((summary, item) => {
      const label = getChartLabel(selector(item), fallback)
      summary[label] = (summary[label] || 0) + 1
      return summary
    }, {}),
  )
    .map(([label, value]) => ({ label, value, count: value }))
    .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label))

const getLastItems = (items = [], limit = 5) =>
  [...items].sort((first, second) => getTimestamp(second) - getTimestamp(first)).slice(0, limit)

const upsertMany = (key, items = []) => {
  const incomingItems = Array.isArray(items) ? items : []
  let inserted = 0
  let updated = 0

  incomingItems.forEach((item) => {
    if (!item || typeof item !== 'object') return

    const collection = list(key)
    const nextItem = {
      ...item,
      id: item.id || createId(key.slice(0, 4)),
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString(),
    }
    const nextBusinessKey = getBusinessKey(key, nextItem)
    const index = collection.findIndex((currentItem) => {
      const sameId = currentItem.id && nextItem.id && currentItem.id === nextItem.id
      const currentBusinessKey = getBusinessKey(key, currentItem)
      return sameId || (nextBusinessKey && currentBusinessKey === nextBusinessKey)
    })

    if (index === -1) {
      state[key] = [nextItem, ...collection]
      inserted += 1
      return
    }

    collection[index] = mergeCollectionItem(collection[index], nextItem)
    updated += 1
  })

  if (inserted || updated) persistDatabase()
  return { inserted, updated }
}

const create = (key, prefix, payload) => {
  const baseItem = {
    id: payload.id || createId(prefix),
    ...payload,
    createdAt: payload.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  const item = key === 'financeMovements' ? calculateFinanceMovement(baseItem) : baseItem
  state[key] = [item, ...list(key)]
  if (key === 'quotes') syncQuoteDocument(item)
  persistDatabase()
  return item
}

const update = (key, id, payload) => {
  const items = list(key)
  const index = items.findIndex((item) => item.id === id)
  if (index === -1) {
    const error = new Error('Registro no encontrado.')
    error.statusCode = 404
    throw error
  }
  const nextItem = { ...items[index], ...payload, updatedAt: new Date().toISOString() }
  items[index] = key === 'financeMovements' ? calculateFinanceMovement(nextItem) : nextItem
  if (key === 'quotes') syncQuoteDocument(items[index])
  persistDatabase()
  return items[index]
}

const remove = (key, id) => {
  const items = list(key)
  const nextItems = items.filter((item) => item.id !== id)

  if (nextItems.length === items.length) {
    const error = new Error('Registro no encontrado.')
    error.statusCode = 404
    throw error
  }

  state[key] = nextItems
  persistDatabase()
  return { id, deleted: true }
}

const findById = (key, id) => {
  const item = list(key).find((candidate) => candidate.id === id)
  if (!item) {
    const error = new Error('Registro no encontrado.')
    error.statusCode = 404
    throw error
  }
  return item
}

const getDashboard = (user) => {
  const canViewFinance = user.permissions.includes('finance.view') || user.permissions.includes('admin.all')
  const totalQuoted = state.quotes.reduce((sum, quote) => sum + getNumberValue(quote.totalAmount), 0)
  const pendingFinance = state.financeMovements.reduce((sum, movement) => sum + getNumberValue(movement.pendingAmount), 0)

  return {
    quotes: state.quotes.length,
    documents: state.documents.length,
    tenders: state.tenders.length,
    workOrders: state.workOrders.length,
    clients: state.clients.length,
    totalQuoted: canViewFinance ? totalQuoted : null,
    pendingFinance: canViewFinance ? pendingFinance : null,
    latestDocuments: state.documents.slice(0, 5),
    latestWorkOrders: state.workOrders.slice(0, 5),
  }
}

const getDashboardSummary = () => {
  const clients = list('clients')
  const quotes = list('quotes')
  const documents = list('documents')
  const tenders = list('tenders')
  const workOrders = list('workOrders')
  const users = list('users')

  return {
    totals: {
      clients: clients.length,
      quotes: quotes.length,
      documents: documents.length,
      tenders: tenders.length,
      workOrders: workOrders.length,
      users: users.length,
    },
    charts: {
      clients: {
        byStatus: countBy(clients, (client) => client.status || client.estado, 'Sin estado'),
      },
      quotes: {
        byStatus: countBy(quotes, (quote) => quote.status || quote.estado, 'Sin estado'),
        bySeller: countBy(quotes, (quote) => quote.seller || quote.vendedor, 'Sin vendedor'),
      },
      documents: {
        byStatus: countBy(documents, (document) => document.status || document.estado, 'Sin estado'),
        byType: countBy(documents, (document) => document.type || document.tipoDocumento, 'Sin tipo'),
      },
      tenders: {
        byStatus: countBy(tenders, (tender) => tender.status, 'Sin estado'),
        byRiskLevel: countBy(tenders, (tender) => tender.riskLevel, 'Sin riesgo'),
      },
      workOrders: {
        byStatus: countBy(workOrders, (workOrder) => workOrder.status, 'Sin estado'),
        byPriority: countBy(workOrders, (workOrder) => workOrder.priority, 'Sin prioridad'),
      },
      users: {
        byStatus: countBy(users, (user) => user.status, 'Sin estado'),
        byRole: countBy(users, (user) => user.role, 'Sin rol'),
      },
    },
    recent: {
      quotes: getLastItems(quotes),
      documents: getLastItems(documents),
      tenders: getLastItems(tenders),
      workOrders: getLastItems(workOrders),
      users: getLastItems(users),
    },
  }
}

const getDocumentStats = () => {
  const documents = list('documents')

  return {
    total: documents.length,
    byStatus: countBy(documents, (document) => document.status || document.estado, 'Sin estado'),
    byType: countBy(documents, (document) => document.type || document.tipoDocumento, 'Sin tipo'),
    lastDocuments: getLastItems(documents),
  }
}

const createReceivableFromQuote = (quoteId, user) => {
  const quote = findById('quotes', quoteId)
  const duplicated = state.financeMovements.some(
    (movement) => movement.quoteNumber === quote.quoteNumber && !movement.isAdditionalMovement,
  )

  if (duplicated) {
    const error = new Error('La cotizacion ya tiene una cuenta por cobrar.')
    error.statusCode = 409
    throw error
  }

  const movement = calculateFinanceMovement({
    id: createId('fin'),
    type: 'Ingreso',
    category: 'Venta',
    documentType: 'Sin documento',
    documentNumber: `COT-${quote.quoteNumber}`,
    client: quote.client,
    company: quote.company,
    quoteNumber: quote.quoteNumber,
    description: quote.subject || `Cuenta por cobrar cotizacion ${quote.quoteNumber}`,
    netAmount: quote.netAmount,
    taxRate: quote.netAmount ? (getNumberValue(quote.taxAmount) / getNumberValue(quote.netAmount)) * 100 : 19,
    paidAmount: 0,
    issueDate: quote.date,
    dueDate: quote.date,
    paymentMethod: 'Transferencia',
    responsibleName: quote.seller || user.name,
    responsibleEmail: user.email,
    sourceType: 'quote',
    quoteSourceLocked: true,
    auditLog: [{ action: 'Cuenta por cobrar desde cotizacion', userEmail: user.email, createdAt: new Date().toISOString() }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  state.financeMovements = [movement, ...state.financeMovements]
  persistDatabase()
  return movement
}

const getFinanceSummary = () => {
  const movements = state.financeMovements.map(calculateFinanceMovement)
  return movements.reduce(
    (summary, movement) => {
      if (movement.type === 'Ingreso') summary.receivable += movement.pendingAmount
      if (movement.type === 'Egreso') summary.payable += movement.pendingAmount
      summary.totalPending += movement.pendingAmount
      summary.totalPaid += movement.paidAmount
      if (movement.status === 'Vencido') summary.overdue += 1
      return summary
    },
    { receivable: 0, payable: 0, totalPending: 0, totalPaid: 0, overdue: 0 },
  )
}

const registerPayment = (movementId, payment, user) => {
  const movement = findById('financeMovements', movementId)
  const nextMovement = registerMovementPayment(movement, payment, user)
  return update('financeMovements', movementId, nextMovement)
}

const parseMaybeJson = (value, fallbackValue = []) => {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== 'string') return fallbackValue

  try {
    const parsedValue = JSON.parse(value)
    return Array.isArray(parsedValue) ? parsedValue : fallbackValue
  } catch (_error) {
    return fallbackValue
  }
}

const readImportCollection = (payload = {}, key, storageKeys = []) => {
  if (Array.isArray(payload[key])) return payload[key]

  const localStorageDump = payload.localStorage || payload.storage || payload
  const candidates = [key, ...storageKeys]

  for (const candidate of candidates) {
    const value = localStorageDump?.[candidate]
    const parsedValue = parseMaybeJson(value, null)
    if (Array.isArray(parsedValue)) return parsedValue
  }

  return []
}

const importLocalStorage = (payload = {}) => {
  const importMap = [
    ['clients', ['rubik.erp.clients']],
    ['quotes', ['rubik.erp.quotes']],
    ['documents', ['rubik.erp.documents']],
    ['tenders', ['rubik.erp.tenders']],
    ['workOrders', ['rubik.erp.workOrders']],
    ['financeMovements', ['rubik.erp.finance.movements']],
    ['suppliers', ['rubik.erp.finance.suppliers']],
    ['products', ['rubik.erp.products']],
    ['materials', ['rubik.erp.materials']],
    ['expenses', ['rubik.erp.expenses']],
  ]

  const result = importMap.reduce((summary, [key, storageKeys]) => {
    const items = readImportCollection(payload, key, storageKeys)
    summary[key] = upsertMany(key, items)
    return summary
  }, {})

  return {
    importedAt: new Date().toISOString(),
    counts: getCounts(),
    result,
  }
}

const seedInitialData = () => {
  const seedDatabase = createInitialDatabase()
  const result = COLLECTION_KEYS.reduce((summary, key) => {
    summary[key] = upsertMany(key, seedDatabase[key] || [])
    return summary
  }, {})

  return {
    importedAt: new Date().toISOString(),
    counts: getCounts(),
    result,
  }
}

const importJsonFile = () => {
  if (!fs.existsSync(DB_FILE)) {
    const error = new Error(`No existe ${DB_FILE}.`)
    error.statusCode = 404
    throw error
  }

  const jsonPayload = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))
  const result = COLLECTION_KEYS.reduce((summary, key) => {
    summary[key] = upsertMany(key, jsonPayload[key] || [])
    return summary
  }, {})

  return {
    importedAt: new Date().toISOString(),
    counts: getCounts(),
    result,
  }
}

const getCounts = () => ({
  users: list('users').length,
  clients: list('clients').length,
  quotes: list('quotes').length,
  quoteItems: list('quotes').reduce(
    (total, quote) => total + (Array.isArray(quote.quoteItems) ? quote.quoteItems.length : Array.isArray(quote.items) ? quote.items.length : 0),
    0,
  ),
  documents: list('documents').length,
  tenders: list('tenders').length,
  workOrders: list('workOrders').length,
  financeMovements: list('financeMovements').length,
  suppliers: list('suppliers').length,
  products: list('products').length,
  materials: list('materials').length,
  expenses: list('expenses').length,
})

const jsonDataAdapter = {
  login,
  getUserByToken,
  list,
  create,
  update,
  remove,
  findById,
  getDashboard,
  getDashboardSummary,
  getDocumentStats,
  createReceivableFromQuote,
  getFinanceSummary,
  registerPayment,
  importLocalStorage,
  seedInitialData,
  importJsonFile,
  getCounts,
}

const getRequestedAdapterMode = () =>
  String(process.env.DATA_ADAPTER_MODE || process.env.RUBIK_DATA_ADAPTER || '').trim().toLowerCase()

const requestedAdapterMode = getRequestedAdapterMode()
const shouldUsePrismaAdapter = requestedAdapterMode === 'prisma'
const shouldUseJsonAdapter = !requestedAdapterMode || ['json', 'file', 'local', 'mock'].includes(requestedAdapterMode)

let prismaDataAdapter = null
let activeAdapterMode = shouldUsePrismaAdapter ? 'prisma' : 'json'
let adapterFallbackReason = shouldUseJsonAdapter
  ? ''
  : `unsupported RUBIK_DATA_ADAPTER="${requestedAdapterMode}"; using json`

const loadPrismaDataAdapter = () => {
  if (!prismaDataAdapter) {
    prismaDataAdapter = require('./prismaDataAdapter')
  }

  return prismaDataAdapter
}

const runWithSelectedAdapter = async (methodName, args = []) => {
  if (!shouldUsePrismaAdapter || activeAdapterMode === 'json') {
    return jsonDataAdapter[methodName](...args)
  }

  const prismaAdapter = loadPrismaDataAdapter()
  const method = prismaAdapter[methodName]

  if (typeof method !== 'function') {
    throw new Error(`Metodo no soportado por Prisma adapter: ${methodName}`)
  }

  return method(...args)
}

const getUserByTokenWithFallback = (token) => {
  if (!token) return null

  if (!shouldUsePrismaAdapter || activeAdapterMode === 'json') {
    return jsonDataAdapter.getUserByToken(token)
  }

  return loadPrismaDataAdapter().getUserByToken(token)
}

const getAdapterStatus = () => ({
  db: activeAdapterMode === 'prisma' ? 'mysql' : 'json-file',
  fallbackReason: adapterFallbackReason || undefined,
  hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
  mode: activeAdapterMode,
  provider: activeAdapterMode === 'prisma' ? 'prisma/mysql' : 'json',
  requestedMode: requestedAdapterMode || 'json-default',
  source: activeAdapterMode === 'prisma' ? 'database' : 'local-json',
})

module.exports = {
  login: (payload) => runWithSelectedAdapter('login', [payload]),
  getUserByToken: getUserByTokenWithFallback,
  list: (key) => runWithSelectedAdapter('list', [key]),
  create: (key, prefix, payload) => runWithSelectedAdapter('create', [key, prefix, payload]),
  update: (key, id, payload) => runWithSelectedAdapter('update', [key, id, payload]),
  remove: (key, id) => runWithSelectedAdapter('remove', [key, id]),
  findById: (key, id) => runWithSelectedAdapter('findById', [key, id]),
  getDashboard: (user) => runWithSelectedAdapter('getDashboard', [user]),
  getDashboardSummary: () => runWithSelectedAdapter('getDashboardSummary'),
  getDocumentStats: () => runWithSelectedAdapter('getDocumentStats'),
  createReceivableFromQuote: (quoteId, user) => runWithSelectedAdapter('createReceivableFromQuote', [quoteId, user]),
  getFinanceSummary: () => runWithSelectedAdapter('getFinanceSummary'),
  registerPayment: (movementId, payment, user) => runWithSelectedAdapter('registerPayment', [movementId, payment, user]),
  importLocalStorage: (payload) => runWithSelectedAdapter('importLocalStorage', [payload]),
  seedInitialData: () => runWithSelectedAdapter('seedInitialData'),
  importJsonFile: () => runWithSelectedAdapter('importJsonFile'),
  getCounts: () => runWithSelectedAdapter('getCounts'),
  getAdapterStatus,
}
