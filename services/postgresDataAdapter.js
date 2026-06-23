const { randomUUID } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { calculateFinanceMovement, getNumberValue, registerMovementPayment } = require('../utils/financeCalculations')
const { getPrisma } = require('./prismaClient')

const TEMP_DEV_PASSWORD = '123456'
const sessions = new Map()
const DB_FILE = path.join(__dirname, '..', 'data', 'rubik-db.json')
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
      'materials.view',
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

  return ['dashboard.view', 'documents.view', 'workorders.view', 'products.view', 'materials.view', 'ai.chat']
}

const modelByKey = {
  users: 'user',
  clients: 'client',
  quotes: 'quote',
  quoteItems: 'quoteItem',
  documents: 'document',
  tenders: 'tender',
  workOrders: 'workOrder',
  workOrderMovements: 'workOrderMovement',
  suppliers: 'supplier',
  financeMovements: 'financialMovement',
  expenses: 'expense',
  products: 'productService',
  productServices: 'productService',
  materials: 'material',
  payments: 'payment',
  auditLogs: 'auditLog',
}

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

const seedUsers = [
  ['usr-rodrigo-sepulveda', 'Rodrigo Sepúlveda', 'rsepulveda@rubikcreaciones.cl', 'Jefe de ventas', 'Ventas'],
  ['usr-erick-cabrera', 'Erick Cabrera', 'erick@rubikcreaciones.cl', 'Ejecutivo venta publica', 'Licitaciones'],
  ['usr-ramon-rojas', 'Ramón Rojas', 'r.rojas@rubikcreaciones.cl', 'Gerencia/Admin', 'Gerencia/Finanzas'],
  ['usr-christian-guzman', 'Christian Guzmán', 'c.guzman@rubikcreaciones.cl', 'Jefe venta privada', 'Ventas/Finanzas'],
  ['usr-ignacio-martinez', 'Ignacio Martínez', 'Ignacio.m@rubikcreaciones.cl', 'Jefe de taller', 'Produccion/Taller'],
  ['usr-benjamin-rojas', 'Benjamín Rojas', 'brojas.romero@rubikcreaciones.cl', 'Gerencia/Admin', 'Gerencia'],
  ['usr-ivone-romero', 'Ivone Romero', 'contacto@rubikcreaciones.cl', 'Gerencia/Admin', 'Gerencia/Finanzas'],
  ['usr-mathias-olavarria', 'Mathias Olavarría', 'm.olavarria@rubikcreaciones.cl', 'Diseno y publicidad', 'Diseno/Marketing'],
  ['usr-jorge-gutierrez', 'Jorge Gutiérrez', 'jgutierrez@rubikcreaciones.cl', 'Disenador imprenta', 'Diseno/Imprenta'],
].map(([id, name, email, role, area]) => ({
  id,
  name,
  email,
  role,
  area,
  status: 'Activo',
  position: role,
  password: TEMP_DEV_PASSWORD,
}))

const seedProducts = [
  {
    id: 'prd-pendon-roller',
    name: 'Pendon roller',
    category: 'Display',
    unit: 'unidad',
    technicalDescription: 'Pendon roller con impresion full color y bolso de transporte.',
    baseCost: 28500,
    suggestedPrice: 49000,
    material: 'PVC 13 oz',
    status: 'Activo',
  },
  {
    id: 'prd-vinilo-impreso',
    name: 'Vinilo impreso',
    category: 'Grafica adhesiva',
    unit: 'm2',
    technicalDescription: 'Impresion en vinilo adhesivo con tintas eco solventes.',
    baseCost: 8900,
    suggestedPrice: 18500,
    material: 'Adhesivo impreso',
    status: 'Activo',
  },
]

const seedMaterials = [
  {
    id: 'mat-pvc-13',
    name: 'PVC 13 oz',
    category: 'Lonas y telas',
    unit: 'm2',
    baseCost: 4200,
    unitCost: 4200,
    wastePercent: 8,
    marginPercent: 35,
    supplierName: 'Proveedor grafico general',
    status: 'Activo',
  },
  {
    id: 'mat-adhesivo-impreso',
    name: 'Adhesivo impreso',
    category: 'Vinilos',
    unit: 'm2',
    baseCost: 6800,
    unitCost: 6800,
    wastePercent: 10,
    marginPercent: 40,
    supplierName: 'Proveedor vinilos',
    status: 'Activo',
  },
]

const createId = (prefix) => `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`

const toDate = (value) => {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const parsedDate = new Date(value)
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

const toDateOnly = (value) => {
  const date = toDate(value)
  return date ? date.toISOString().slice(0, 10) : ''
}

const toIso = (value) => {
  const date = toDate(value)
  return date ? date.toISOString() : ''
}

const toNumber = (value) => Number(value || 0)

const emptyToNull = (value) => (value === '' || value === undefined ? null : value)

const sanitizeUser = (user = {}) => {
  const { password, ...safeUser } = user
  return safeUser
}

const cleanPayload = (payload = {}) =>
  Object.entries(payload).reduce((result, [key, value]) => {
    if (value !== undefined) result[key] = value
    return result
  }, {})

const getModel = (key) => {
  const modelName = modelByKey[key]
  if (!modelName) throw new Error(`Modelo no soportado por Prisma: ${key}`)
  return getPrisma()[modelName]
}

const serializeUser = (record = {}) => ({
  id: record.id,
  name: record.name,
  email: record.email,
  role: record.role,
  status: record.status,
  position: record.position || '',
  area: record.area || '',
  permissions: record.permissions || [],
  createdAt: toIso(record.createdAt),
  updatedAt: toIso(record.updatedAt),
})

const serializeClient = (record = {}) => ({
  id: record.id,
  contactName: record.contactName || record.contact || '',
  contact: record.contact || record.contactName || '',
  company: record.company || '',
  rut: record.rut || '',
  phone: record.phone || '',
  email: record.email || '',
  commune: record.commune || '',
  address: record.address || '',
  status: record.status || 'Activo',
  observations: record.observations || '',
  createdAt: toIso(record.createdAt),
  updatedAt: toIso(record.updatedAt),
})

const serializeQuote = (record = {}) => ({
  id: record.id,
  quoteNumber: record.quoteNumber,
  date: toDateOnly(record.date),
  client: record.client || '',
  company: record.company || '',
  seller: record.seller || '',
  subject: record.subject || '',
  condition: record.condition || '',
  status: record.status || 'Borrador',
  netAmount: toNumber(record.netAmount),
  taxAmount: toNumber(record.taxAmount),
  totalAmount: toNumber(record.totalAmount),
  net: toNumber(record.netAmount),
  iva: toNumber(record.taxAmount),
  total: toNumber(record.totalAmount),
  items: Array.isArray(record.quoteItems) && record.quoteItems.length
    ? record.quoteItems.map(serializeQuoteItem)
    : Array.isArray(record.items)
      ? record.items
      : [],
  quoteItems: Array.isArray(record.quoteItems) && record.quoteItems.length
    ? record.quoteItems.map(serializeQuoteItem)
    : Array.isArray(record.items)
      ? record.items
      : [],
  payload: record.payload || null,
  createdAt: toIso(record.createdAt),
  updatedAt: toIso(record.updatedAt),
})

const serializeQuoteItem = (record = {}) => ({
  id: record.id,
  quoteId: record.quoteId || '',
  quoteNumber: record.quoteNumber || '',
  description: record.description || '',
  quantity: toNumber(record.quantity),
  unitValue: toNumber(record.unitValue),
  total: toNumber(record.total),
  observations: record.observations || '',
  payload: record.payload || null,
  createdAt: toIso(record.createdAt),
  updatedAt: toIso(record.updatedAt),
})

const serializeDocument = (record = {}) => ({
  id: record.id,
  type: record.type,
  tipoDocumento: record.type,
  documentNumber: record.documentNumber,
  numeroDocumento: record.documentNumber,
  date: toDateOnly(record.date),
  fecha: toDateOnly(record.date),
  client: record.client || '',
  cliente: record.client || '',
  company: record.company || '',
  empresa: record.company || '',
  seller: record.seller || '',
  vendedor: record.seller || '',
  netAmount: toNumber(record.netAmount),
  montoNeto: toNumber(record.netAmount),
  taxAmount: toNumber(record.taxAmount),
  iva: toNumber(record.taxAmount),
  totalAmount: toNumber(record.totalAmount),
  total: toNumber(record.totalAmount),
  status: record.status || 'Borrador',
  estado: record.status || 'Borrador',
  origin: record.origin || '',
  origen: record.origin || '',
  tags: Array.isArray(record.tags) ? record.tags : [],
  observations: record.observations || '',
  observaciones: record.observations || '',
  archivoPdfUrl: record.filePdfUrl || '',
  archivoExcelUrl: record.fileExcelUrl || '',
  items: Array.isArray(record.items) ? record.items : [],
  payload: record.payload || null,
  createdAt: toIso(record.createdAt),
  updatedAt: toIso(record.updatedAt),
})

const serializeTender = (record = {}) => ({
  ...record,
  budget: record.budget === null || record.budget === undefined ? null : toNumber(record.budget),
  closingDate: toDateOnly(record.closingDate),
  openingDate: toDateOnly(record.openingDate),
  adjudicationDate: toDateOnly(record.adjudicationDate),
  contractSignDate: toDateOnly(record.contractSignDate),
  createdAt: toIso(record.createdAt),
  updatedAt: toIso(record.updatedAt),
})

const serializeWorkOrder = (record = {}) => ({
  ...record,
  dueDate: toDateOnly(record.dueDate),
  comments: Array.isArray(record.comments) ? record.comments : [],
  movements: Array.isArray(record.workOrderMovements) && record.workOrderMovements.length
    ? record.workOrderMovements.map(serializeWorkOrderMovement)
    : Array.isArray(record.movements)
      ? record.movements
      : [],
  createdAt: toIso(record.createdAt),
  updatedAt: toIso(record.updatedAt),
})

const serializeWorkOrderMovement = (record = {}) => ({
  id: record.id,
  workOrderId: record.workOrderId || '',
  type: record.type || '',
  status: record.status || '',
  fromArea: record.fromArea || '',
  toArea: record.toArea || '',
  userName: record.userName || '',
  userEmail: record.userEmail || '',
  comment: record.comment || '',
  observations: record.observations || '',
  payload: record.payload || null,
  createdAt: toIso(record.createdAt),
  updatedAt: toIso(record.updatedAt),
})

const serializeSupplier = (record = {}) => ({
  ...record,
  observations: record.observations || '',
  createdAt: toIso(record.createdAt),
  updatedAt: toIso(record.updatedAt),
})

const serializeFinancialMovement = (record = {}) =>
  calculateFinanceMovement({
    ...record,
    netAmount: toNumber(record.netAmount),
    taxRate: toNumber(record.taxRate),
    taxAmount: toNumber(record.taxAmount),
    totalAmount: toNumber(record.totalAmount),
    paidAmount: toNumber(record.paidAmount),
    pendingAmount: toNumber(record.pendingAmount),
    issueDate: toDateOnly(record.issueDate),
    dueDate: toDateOnly(record.dueDate),
    paymentDate: toDateOnly(record.paymentDate),
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt),
  })

const serializeExpense = (record = {}) =>
  calculateFinanceMovement({
    id: record.id,
    type: 'Egreso',
    category: record.category || '',
    documentType: record.documentType || '',
    documentNumber: record.documentNumber || '',
    supplierId: record.supplierId || '',
    supplierName: record.supplierName || '',
    description: record.description || '',
    netAmount: toNumber(record.netAmount),
    taxRate: toNumber(record.taxRate),
    taxAmount: toNumber(record.taxAmount),
    totalAmount: toNumber(record.totalAmount),
    paidAmount: toNumber(record.paidAmount),
    pendingAmount: toNumber(record.pendingAmount),
    issueDate: toDateOnly(record.issueDate),
    dueDate: toDateOnly(record.dueDate),
    paymentDate: toDateOnly(record.paymentDate),
    status: record.status || 'Sin pagar',
    paymentMethod: record.paymentMethod || '',
    observations: record.observations || '',
    payload: record.payload || null,
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt),
  })

const serializeProductService = (record = {}) => ({
  id: record.id,
  name: record.name || '',
  category: record.category || '',
  type: record.type || '',
  unit: record.unit || '',
  description: record.description || '',
  technicalDescription: record.technicalDescription || '',
  material: record.material || '',
  suggestedPrice: toNumber(record.suggestedPrice),
  baseCost: toNumber(record.baseCost ?? record.costPrice),
  costPrice: toNumber(record.costPrice),
  status: record.status || 'Activo',
  observations: record.observations || '',
  payload: record.payload || null,
  createdAt: toIso(record.createdAt),
  updatedAt: toIso(record.updatedAt),
})

const serializeMaterial = (record = {}) => ({
  id: record.id,
  name: record.name || '',
  category: record.category || '',
  unit: record.unit || '',
  sku: record.sku || '',
  currentStock: toNumber(record.currentStock),
  minStock: toNumber(record.minStock),
  baseCost: toNumber(record.baseCost ?? record.unitCost),
  unitCost: toNumber(record.unitCost),
  wastePercent: toNumber(record.wastePercent),
  marginPercent: toNumber(record.marginPercent),
  supplierId: record.supplierId || '',
  supplierName: record.supplierName || '',
  supplier: record.supplierName || '',
  status: record.status || 'Activo',
  observations: record.observations || '',
  payload: record.payload || null,
  createdAt: toIso(record.createdAt),
  updatedAt: toIso(record.updatedAt),
})

const serializerByKey = {
  users: serializeUser,
  clients: serializeClient,
  quotes: serializeQuote,
  quoteItems: serializeQuoteItem,
  documents: serializeDocument,
  tenders: serializeTender,
  workOrders: serializeWorkOrder,
  workOrderMovements: serializeWorkOrderMovement,
  suppliers: serializeSupplier,
  financeMovements: serializeFinancialMovement,
  expenses: serializeExpense,
  products: serializeProductService,
  productServices: serializeProductService,
  materials: serializeMaterial,
}

const serialize = (key, record) => (serializerByKey[key] || ((item) => item))(record)

const hasValue = (value) => value !== null && value !== undefined && String(value).trim() !== ''

const getNaturalUniqueWhere = (key, data = {}) => {
  if (key === 'users' && hasValue(data.email)) return { email: data.email }
  if (key === 'quotes' && hasValue(data.quoteNumber)) return { quoteNumber: data.quoteNumber }
  if (key === 'documents' && hasValue(data.type) && hasValue(data.documentNumber)) {
    return { type_documentNumber: { type: data.type, documentNumber: data.documentNumber } }
  }
  if (key === 'tenders' && hasValue(data.tenderId)) return { tenderId: data.tenderId }
  if (key === 'suppliers' && hasValue(data.rut)) return { rut: data.rut }
  if ((key === 'products' || key === 'productServices') && hasValue(data.name)) return { name: data.name }
  if (key === 'materials' && hasValue(data.sku)) return { sku: data.sku }
  if (key === 'materials' && hasValue(data.name)) return { name: data.name }
  return null
}

const getExistingForUpsert = async (model, key, data = {}) => {
  if (hasValue(data.id)) {
    const existingById = await model.findUnique({ where: { id: data.id } })
    if (existingById) return { record: existingById, where: { id: data.id }, matchedById: true }
  }

  const naturalWhere = getNaturalUniqueWhere(key, data)
  if (!naturalWhere) return { record: null, where: null, matchedById: false }

  const existingByNaturalKey = await model.findUnique({ where: naturalWhere })
  return { record: existingByNaturalKey, where: naturalWhere, matchedById: false }
}

const normalizeForPrisma = (key, payload = {}) => {
  const now = new Date()

  if (key === 'users') {
    return cleanPayload({
      id: payload.id || createId('usr'),
      name: payload.name || '',
      email: String(payload.email || '').trim().toLowerCase(),
      password: payload.password || TEMP_DEV_PASSWORD,
      role: payload.role || payload.position || 'Ventas',
      status: payload.status || 'Activo',
      position: payload.position || payload.role || '',
      area: payload.area || '',
      permissions: Array.isArray(payload.permissions)
        ? payload.permissions
        : getPermissionsForRole(payload.role || payload.position || 'Ventas', payload.email),
      payload,
      createdAt: toDate(payload.createdAt) || now,
      updatedAt: toDate(payload.updatedAt) || now,
    })
  }

  if (key === 'clients') {
    return cleanPayload({
      id: payload.id || createId('client'),
      contactName: payload.contactName || payload.contact || payload.cliente || '',
      contact: payload.contact || payload.contactName || '',
      company: payload.company || payload.empresa || '',
      rut: payload.rut || '',
      phone: payload.phone || payload.telefono || '',
      email: payload.email || '',
      commune: payload.commune || payload.comuna || '',
      address: payload.address || payload.direccion || '',
      status: payload.status || payload.estado || 'Activo',
      observations: payload.observations || payload.observaciones || '',
      payload,
      createdAt: toDate(payload.createdAt) || now,
      updatedAt: toDate(payload.updatedAt) || now,
    })
  }

  if (key === 'quotes') {
    return cleanPayload({
      id: payload.id || createId('quote'),
      quoteNumber: String(payload.quoteNumber || payload.numeroDocumento || payload.number || Date.now()),
      date: toDate(payload.date || payload.fecha),
      client: payload.client || payload.cliente || '',
      company: payload.company || payload.empresa || '',
      seller: payload.seller || payload.vendedor || '',
      subject: payload.subject || payload.tema || '',
      condition: payload.condition || payload.condicion || '',
      status: payload.status || payload.estado || 'Borrador',
      netAmount: toNumber(payload.netAmount ?? payload.net ?? payload.montoNeto),
      taxAmount: toNumber(payload.taxAmount ?? payload.iva),
      totalAmount: toNumber(payload.totalAmount ?? payload.total),
      items: Array.isArray(payload.quoteItems)
        ? payload.quoteItems
        : Array.isArray(payload.items)
          ? payload.items
          : [],
      payload: payload.payload || payload,
      createdAt: toDate(payload.createdAt) || now,
      updatedAt: toDate(payload.updatedAt) || now,
    })
  }

  if (key === 'quoteItems') {
    return cleanPayload({
      id: payload.id || createId('qitem'),
      quoteId: emptyToNull(payload.quoteId),
      quoteNumber: payload.quoteNumber || '',
      description: payload.description || payload.descripcion || '',
      quantity: toNumber(payload.quantity ?? payload.cantidad),
      unitValue: toNumber(payload.unitValue ?? payload.unitPrice ?? payload.valorUnitario),
      total: toNumber(payload.total ?? payload.totalValue),
      observations: payload.observations || payload.observaciones || '',
      payload,
      createdAt: toDate(payload.createdAt) || now,
      updatedAt: toDate(payload.updatedAt) || now,
    })
  }

  if (key === 'documents') {
    return cleanPayload({
      id: payload.id || createId('doc'),
      type: payload.type || payload.tipoDocumento || 'Documento',
      documentNumber: String(payload.documentNumber || payload.numeroDocumento || payload.quoteNumber || Date.now()),
      date: toDate(payload.date || payload.fecha),
      client: payload.client || payload.cliente || '',
      company: payload.company || payload.empresa || '',
      seller: payload.seller || payload.vendedor || '',
      netAmount: toNumber(payload.netAmount ?? payload.montoNeto ?? payload.net),
      taxAmount: toNumber(payload.taxAmount ?? payload.iva),
      totalAmount: toNumber(payload.totalAmount ?? payload.total),
      status: payload.status || payload.estado || 'Borrador',
      origin: payload.origin || payload.origen || '',
      tags: Array.isArray(payload.tags) ? payload.tags : [],
      observations: payload.observations || payload.observaciones || '',
      filePdfUrl: payload.filePdfUrl || payload.archivoPdfUrl || '',
      fileExcelUrl: payload.fileExcelUrl || payload.archivoExcelUrl || '',
      items: Array.isArray(payload.items) ? payload.items : [],
      payload: payload.payload || payload,
      createdAt: toDate(payload.createdAt) || now,
      updatedAt: toDate(payload.updatedAt) || now,
    })
  }

  if (key === 'tenders') {
    return cleanPayload({
      id: payload.id || createId('tender'),
      tenderId: emptyToNull(payload.tenderId),
      title: payload.title || payload.name || 'Licitacion',
      buyer: payload.buyer || '',
      buyerRut: payload.buyerRut || '',
      budget: payload.budget === '' ? null : payload.budget,
      closingDate: toDate(payload.closingDate),
      openingDate: toDate(payload.openingDate),
      adjudicationDate: toDate(payload.adjudicationDate),
      contractSignDate: toDate(payload.contractSignDate),
      status: payload.status || 'Borrador',
      riskLevel: payload.riskLevel || 'Medio',
      object: payload.object || '',
      summary: payload.summary || '',
      administrativeRequirements: payload.administrativeRequirements || [],
      technicalRequirements: payload.technicalRequirements || [],
      economicRequirements: payload.economicRequirements || [],
      requiredDocuments: payload.requiredDocuments || [],
      essentialDocuments: payload.essentialDocuments || [],
      evaluationCriteria: payload.evaluationCriteria || [],
      guarantees: payload.guarantees || [],
      paymentTerms: payload.paymentTerms || '',
      penalties: payload.penalties || [],
      risks: payload.risks || [],
      suggestedQuestions: payload.suggestedQuestions || [],
      technicalItems: payload.technicalItems || [],
      observations: payload.observations || '',
      sourceText: payload.sourceText || '',
      sourceFiles: payload.sourceFiles || [],
      fieldSources: payload.fieldSources || {},
      diagnostics: payload.diagnostics || {},
      payload,
      createdAt: toDate(payload.createdAt) || now,
      updatedAt: toDate(payload.updatedAt) || now,
    })
  }

  if (key === 'workOrders') {
    return cleanPayload({
      id: payload.id || createId('wo'),
      title: payload.title || 'Orden de trabajo',
      type: payload.type || 'Administrativo',
      client: payload.client || '',
      company: payload.company || '',
      quoteNumber: payload.quoteNumber || '',
      requesterName: payload.requesterName || payload.requestedBy || '',
      requesterEmail: payload.requesterEmail || '',
      requesterRole: payload.requesterRole || '',
      assigneeName: payload.assigneeName || payload.assignedTo || '',
      assigneeEmail: payload.assigneeEmail || '',
      assigneeRole: payload.assigneeRole || '',
      sourceArea: payload.sourceArea || '',
      targetArea: payload.targetArea || '',
      priority: payload.priority || 'Media',
      status: payload.status || 'Pendiente',
      dueDate: toDate(payload.dueDate),
      description: payload.description || '',
      requirements: payload.requirements || '',
      deliverables: payload.deliverables || '',
      observations: payload.observations || '',
      comments: Array.isArray(payload.comments) ? payload.comments : [],
      movements: Array.isArray(payload.movements) ? payload.movements : [],
      payload,
      createdAt: toDate(payload.createdAt) || now,
      updatedAt: toDate(payload.updatedAt) || now,
    })
  }

  if (key === 'workOrderMovements') {
    return cleanPayload({
      id: payload.id || createId('wom'),
      workOrderId: emptyToNull(payload.workOrderId),
      type: payload.type || payload.action || '',
      status: payload.status || '',
      fromArea: payload.fromArea || payload.sourceArea || '',
      toArea: payload.toArea || payload.targetArea || '',
      userName: payload.userName || payload.user || '',
      userEmail: payload.userEmail || '',
      comment: payload.comment || payload.body || '',
      observations: payload.observations || '',
      payload,
      createdAt: toDate(payload.createdAt) || now,
      updatedAt: toDate(payload.updatedAt) || now,
    })
  }

  if (key === 'suppliers') {
    return cleanPayload({
      id: payload.id || createId('sup'),
      name: payload.name || payload.company || 'Proveedor',
      rut: emptyToNull(payload.rut),
      contactName: payload.contactName || '',
      phone: payload.phone || '',
      email: payload.email || '',
      category: payload.category || 'Proveedor',
      paymentTerms: payload.paymentTerms || '',
      bankName: payload.bankName || '',
      bankAccountType: payload.bankAccountType || '',
      bankAccountNumber: payload.bankAccountNumber || '',
      bankAccountEmail: payload.bankAccountEmail || '',
      status: payload.status || 'Activo',
      observations: payload.observations || payload.notes || '',
      payload,
      createdAt: toDate(payload.createdAt) || now,
      updatedAt: toDate(payload.updatedAt) || now,
    })
  }

  if (key === 'financeMovements') {
    const calculated = calculateFinanceMovement(payload)
    return cleanPayload({
      id: payload.id || createId('fin'),
      type: calculated.type || 'Ingreso',
      category: calculated.category || 'Venta',
      documentType: calculated.documentType || '',
      documentNumber: calculated.documentNumber || '',
      client: calculated.client || '',
      company: calculated.company || '',
      supplierId: emptyToNull(calculated.supplierId),
      supplierName: calculated.supplierName || '',
      quoteId: emptyToNull(calculated.quoteId),
      quoteNumber: calculated.quoteNumber || '',
      tenderId: calculated.tenderId || '',
      workOrderId: calculated.workOrderId || '',
      description: calculated.description || '',
      netAmount: calculated.netAmount,
      taxRate: calculated.taxRate,
      taxAmount: calculated.taxAmount,
      isTaxExempt: Boolean(calculated.isTaxExempt),
      totalAmount: calculated.totalAmount,
      paidAmount: calculated.paidAmount,
      pendingAmount: calculated.pendingAmount,
      issueDate: toDate(calculated.issueDate),
      dueDate: toDate(calculated.dueDate),
      paymentDate: toDate(calculated.paymentDate),
      status: calculated.status,
      paymentMethod: calculated.paymentMethod || '',
      paymentTerms: calculated.paymentTerms || '',
      responsibleName: calculated.responsibleName || '',
      responsibleEmail: calculated.responsibleEmail || '',
      observations: calculated.observations || '',
      sourceType: calculated.sourceType || '',
      quoteSourceLocked: Boolean(calculated.quoteSourceLocked),
      isAdditionalMovement: Boolean(calculated.isAdditionalMovement),
      auditLog: calculated.auditLog || [],
      payload,
      createdAt: toDate(payload.createdAt) || now,
      updatedAt: toDate(payload.updatedAt) || now,
    })
  }

  if (key === 'expenses') {
    const calculated = calculateFinanceMovement({ ...payload, type: 'Egreso' })
    return cleanPayload({
      id: payload.id || createId('exp'),
      category: calculated.category || payload.category || '',
      documentType: calculated.documentType || payload.documentType || '',
      documentNumber: calculated.documentNumber || payload.documentNumber || '',
      supplierId: emptyToNull(calculated.supplierId || payload.supplierId),
      supplierName: calculated.supplierName || payload.supplierName || payload.supplier || '',
      description: calculated.description || payload.description || '',
      netAmount: calculated.netAmount,
      taxRate: calculated.taxRate,
      taxAmount: calculated.taxAmount,
      totalAmount: calculated.totalAmount,
      paidAmount: calculated.paidAmount,
      pendingAmount: calculated.pendingAmount,
      issueDate: toDate(calculated.issueDate || payload.issueDate),
      dueDate: toDate(calculated.dueDate || payload.dueDate),
      paymentDate: toDate(calculated.paymentDate || payload.paymentDate),
      status: calculated.status || payload.status || 'Sin pagar',
      paymentMethod: calculated.paymentMethod || payload.paymentMethod || '',
      observations: calculated.observations || payload.observations || '',
      payload,
      createdAt: toDate(payload.createdAt) || now,
      updatedAt: toDate(payload.updatedAt) || now,
    })
  }

  if (key === 'products' || key === 'productServices') {
    return cleanPayload({
      id: payload.id || createId('prd'),
      name: payload.name || 'Producto / servicio',
      category: payload.category || '',
      type: payload.type || payload.tipo || '',
      unit: payload.unit || '',
      description: payload.description || '',
      technicalDescription: payload.technicalDescription || payload.descripcionTecnica || '',
      material: payload.material || '',
      suggestedPrice: toNumber(payload.suggestedPrice ?? payload.price ?? payload.precioSugerido),
      baseCost: toNumber(payload.baseCost ?? payload.costPrice ?? payload.costoBase),
      costPrice: toNumber(payload.costPrice ?? payload.baseCost ?? payload.costo),
      status: payload.status || 'Activo',
      observations: payload.observations || payload.observaciones || '',
      payload,
      createdAt: toDate(payload.createdAt) || now,
      updatedAt: toDate(payload.updatedAt) || now,
    })
  }

  if (key === 'materials') {
    return cleanPayload({
      id: payload.id || createId('mat'),
      name: payload.name || 'Material',
      category: payload.category || '',
      unit: payload.unit || '',
      sku: emptyToNull(payload.sku),
      currentStock: toNumber(payload.currentStock ?? payload.stock),
      minStock: toNumber(payload.minStock ?? payload.stockMinimo),
      baseCost: toNumber(payload.baseCost ?? payload.unitCost ?? payload.costoBase),
      unitCost: toNumber(payload.unitCost ?? payload.baseCost ?? payload.costoUnitario),
      wastePercent: toNumber(payload.wastePercent ?? payload.merma),
      marginPercent: toNumber(payload.marginPercent ?? payload.margen),
      supplierId: emptyToNull(payload.supplierId),
      supplierName: payload.supplierName || payload.supplier || '',
      status: payload.status || 'Activo',
      observations: payload.observations || payload.observaciones || '',
      payload,
      createdAt: toDate(payload.createdAt) || now,
      updatedAt: toDate(payload.updatedAt) || now,
    })
  }

  return cleanPayload({ ...payload, updatedAt: now })
}

const list = async (key) => {
  const model = getModel(key)
  const records = await model.findMany({
    orderBy: { createdAt: 'desc' },
    ...(key === 'quotes' ? { include: { quoteItems: true } } : {}),
    ...(key === 'workOrders' ? { include: { workOrderMovements: true } } : {}),
  })
  return records.map((record) => serialize(key, record))
}

const findById = async (key, id) => {
  const model = getModel(key)
  const record = await model.findUnique({
    where: { id },
    ...(key === 'quotes' ? { include: { quoteItems: true } } : {}),
    ...(key === 'workOrders' ? { include: { workOrderMovements: true } } : {}),
  })
  if (!record) {
    const error = new Error('Registro no encontrado.')
    error.statusCode = 404
    throw error
  }
  return serialize(key, record)
}

const getQuoteItemsFromPayload = (payload = {}) =>
  Array.isArray(payload.quoteItems)
    ? payload.quoteItems
    : Array.isArray(payload.items)
      ? payload.items
      : []

const syncQuoteItems = async (quote, payload = {}) => {
  const quoteItems = getQuoteItemsFromPayload(payload)

  if (!quote?.id || !Array.isArray(quoteItems)) {
    return
  }

  await getPrisma().quoteItem.deleteMany({ where: { quoteId: quote.id } })

  if (!quoteItems.length) {
    return
  }

  await getPrisma().quoteItem.createMany({
    data: quoteItems.map((item, index) => ({
      ...normalizeForPrisma('quoteItems', {
        ...item,
        id: item.id || `${quote.id}-item-${index + 1}`,
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber,
      }),
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
    })),
  })
}

const getQuoteDocumentStatus = (quoteStatus = '') => {
  if (['Aprobada', 'Adjudicada'].includes(quoteStatus)) return 'Adjudicada'
  if (quoteStatus === 'Borrador') return 'Borrador'
  return 'Emitida'
}

const buildQuoteDocumentPayload = (quote = {}) => ({
  id: `doc-${quote.quoteNumber || quote.id || Date.now()}`,
  type: 'Cotizacion',
  documentNumber: String(quote.quoteNumber || Date.now()),
  date: quote.date,
  client: quote.client || '',
  company: quote.company || '',
  seller: quote.seller || '',
  netAmount: toNumber(quote.netAmount),
  taxAmount: toNumber(quote.taxAmount),
  totalAmount: toNumber(quote.totalAmount),
  status: getQuoteDocumentStatus(quote.status),
  origin: 'quotes',
  tags: ['cotizacion'],
  observations: quote.subject || '',
  items: Array.isArray(quote.items) ? quote.items : [],
  payload: {
    quoteId: quote.id || '',
    quoteNumber: quote.quoteNumber || '',
  },
  createdAt: quote.createdAt,
  updatedAt: new Date(),
})

const syncQuoteDocument = async (quoteRecord = {}) => {
  if (!quoteRecord?.quoteNumber) return null

  const data = normalizeForPrisma('documents', buildQuoteDocumentPayload(serializeQuote(quoteRecord)))
  const updateData = { ...data }
  delete updateData.id
  delete updateData.createdAt

  const document = await getPrisma().document.upsert({
    where: {
      type_documentNumber: {
        type: data.type,
        documentNumber: data.documentNumber,
      },
    },
    create: data,
    update: updateData,
  })

  return serializeDocument(document)
}

const getChartLabel = (value, fallback = 'Sin clasificar') => {
  const label = String(value || '').trim()
  return label || fallback
}

const toChartRows = (rows = [], field, fallback) =>
  rows
    .map((row) => {
      const value = row?._count?._all || 0
      return { label: getChartLabel(row?.[field], fallback), value, count: value }
    })
    .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label))

const groupByCount = async (model, field, fallback) => {
  const rows = await model.groupBy({
    by: [field],
    _count: { _all: true },
  })

  return toChartRows(rows, field, fallback)
}

const fetchCreatedOrUpdatedRecord = async (key, id) => findById(key, id)

const create = async (key, prefix, payload) => {
  const model = getModel(key)
  const data = normalizeForPrisma(key, { id: payload.id || createId(prefix), ...payload })
  const record = await model.create({ data })
  if (key === 'quotes') {
    await syncQuoteItems(record, payload)
    await syncQuoteDocument(record)
    return fetchCreatedOrUpdatedRecord(key, record.id)
  }

  return serialize(key, record)
}

const update = async (key, id, payload) => {
  const model = getModel(key)
  const data = normalizeForPrisma(key, { ...payload, id })
  delete data.createdAt
  const record = await model.update({ where: { id }, data })
  if (key === 'quotes') {
    await syncQuoteItems(record, payload)
    await syncQuoteDocument(record)
    return fetchCreatedOrUpdatedRecord(key, record.id)
  }

  return serialize(key, record)
}

const remove = async (key, id) => {
  const model = getModel(key)
  await model.delete({ where: { id } })
  return { id, deleted: true }
}

const upsertMany = async (key, items = []) => {
  const model = getModel(key)
  let inserted = 0
  let updated = 0

  for (const item of Array.isArray(items) ? items : []) {
    const data = normalizeForPrisma(key, item)
    const { record: existing, where, matchedById } = await getExistingForUpsert(model, key, data)

    if (existing) {
      const updateData = { ...data }
      delete updateData.createdAt
      if (!matchedById) delete updateData.id
      const updatedRecord = await model.update({ where, data: updateData })
      if (key === 'quotes') {
        await syncQuoteItems(updatedRecord, item)
        await syncQuoteDocument(updatedRecord)
      }
      updated += 1
    } else {
      const createdRecord = await model.create({ data })
      if (key === 'quotes') {
        await syncQuoteItems(createdRecord, item)
        await syncQuoteDocument(createdRecord)
      }
      inserted += 1
    }
  }

  return { inserted, updated }
}

const login = async ({ email, password }) => {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const prisma = getPrisma()

  if ((await prisma.user.count()) === 0) {
    await seedInitialData()
  }

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })

  if (!user || user.status !== 'Activo' || String(user.password || TEMP_DEV_PASSWORD) !== String(password || '')) {
    const error = new Error('Credenciales invalidas.')
    error.statusCode = 401
    throw error
  }

  const token = `rubik-token-${randomUUID()}`
  const safeUser = sanitizeUser(serializeUser(user))
  sessions.set(token, safeUser)
  return { token, user: safeUser }
}

const getUserByToken = (token) => sessions.get(token) || null

const getDashboard = async (user) => {
  const prisma = getPrisma()
  const canViewFinance = user.permissions?.includes('finance.view') || user.permissions?.includes('admin.all')
  const [quotes, documents, tenders, workOrders, clients, latestDocuments, latestWorkOrders] = await Promise.all([
    prisma.quote.findMany(),
    prisma.document.count(),
    prisma.tender.count(),
    prisma.workOrder.count(),
    prisma.client.count(),
    prisma.document.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.workOrder.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
  ])
  const movements = canViewFinance ? await prisma.financialMovement.findMany() : []

  return {
    quotes: quotes.length,
    documents,
    tenders,
    workOrders,
    clients,
    totalQuoted: canViewFinance ? quotes.reduce((sum, quote) => sum + toNumber(quote.totalAmount), 0) : null,
    pendingFinance: canViewFinance
      ? movements.reduce((sum, movement) => sum + toNumber(movement.pendingAmount), 0)
      : null,
    latestDocuments: latestDocuments.map(serializeDocument),
    latestWorkOrders: latestWorkOrders.map(serializeWorkOrder),
  }
}

const getDashboardSummary = async () => {
  const prisma = getPrisma()
  const [
    counts,
    clientsByStatus,
    quotesByStatus,
    quotesBySeller,
    documentsByStatus,
    documentsByType,
    tendersByStatus,
    tendersByRiskLevel,
    workOrdersByStatus,
    workOrdersByPriority,
    usersByStatus,
    usersByRole,
    recentQuotes,
    recentDocuments,
    recentTenders,
    recentWorkOrders,
    recentUsers,
  ] = await Promise.all([
    getCounts(),
    groupByCount(prisma.client, 'status', 'Sin estado'),
    groupByCount(prisma.quote, 'status', 'Sin estado'),
    groupByCount(prisma.quote, 'seller', 'Sin vendedor'),
    groupByCount(prisma.document, 'status', 'Sin estado'),
    groupByCount(prisma.document, 'type', 'Sin tipo'),
    groupByCount(prisma.tender, 'status', 'Sin estado'),
    groupByCount(prisma.tender, 'riskLevel', 'Sin riesgo'),
    groupByCount(prisma.workOrder, 'status', 'Sin estado'),
    groupByCount(prisma.workOrder, 'priority', 'Sin prioridad'),
    groupByCount(prisma.user, 'status', 'Sin estado'),
    groupByCount(prisma.user, 'role', 'Sin rol'),
    prisma.quote.findMany({ orderBy: { createdAt: 'desc' }, take: 5, include: { quoteItems: true } }),
    prisma.document.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.tender.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.workOrder.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
  ])

  return {
    totals: {
      clients: counts.clients,
      quotes: counts.quotes,
      documents: counts.documents,
      tenders: counts.tenders,
      workOrders: counts.workOrders,
      users: counts.users,
    },
    charts: {
      clients: {
        byStatus: clientsByStatus,
      },
      quotes: {
        byStatus: quotesByStatus,
        bySeller: quotesBySeller,
      },
      documents: {
        byStatus: documentsByStatus,
        byType: documentsByType,
      },
      tenders: {
        byStatus: tendersByStatus,
        byRiskLevel: tendersByRiskLevel,
      },
      workOrders: {
        byStatus: workOrdersByStatus,
        byPriority: workOrdersByPriority,
      },
      users: {
        byStatus: usersByStatus,
        byRole: usersByRole,
      },
    },
    recent: {
      quotes: recentQuotes.map(serializeQuote),
      documents: recentDocuments.map(serializeDocument),
      tenders: recentTenders.map(serializeTender),
      workOrders: recentWorkOrders.map(serializeWorkOrder),
      users: recentUsers.map(serializeUser),
    },
  }
}

const getDocumentStats = async () => {
  const prisma = getPrisma()
  const [total, byStatus, byType, lastDocuments] = await Promise.all([
    prisma.document.count(),
    groupByCount(prisma.document, 'status', 'Sin estado'),
    groupByCount(prisma.document, 'type', 'Sin tipo'),
    prisma.document.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
  ])

  return {
    total,
    byStatus,
    byType,
    lastDocuments: lastDocuments.map(serializeDocument),
  }
}

const getFinanceSummary = async () => {
  const movements = (await getPrisma().financialMovement.findMany()).map(serializeFinancialMovement)
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

const createReceivableFromQuote = async (quoteId, user) => {
  const quote = await findById('quotes', quoteId)
  const duplicated = await getPrisma().financialMovement.findFirst({
    where: { quoteNumber: quote.quoteNumber, isAdditionalMovement: false },
  })

  if (duplicated) {
    const error = new Error('La cotizacion ya tiene una cuenta por cobrar.')
    error.statusCode = 409
    throw error
  }

  return create('financeMovements', 'fin', {
    type: 'Ingreso',
    category: 'Venta',
    documentType: 'Sin documento',
    documentNumber: `COT-${quote.quoteNumber}`,
    client: quote.client,
    company: quote.company,
    quoteId: quote.id,
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
  })
}

const registerPayment = async (movementId, payment, user) => {
  const movement = await findById('financeMovements', movementId)
  const nextMovement = registerMovementPayment(movement, payment, user)
  const updatedMovement = await update('financeMovements', movementId, nextMovement)
  const amount = getNumberValue(payment.amount ?? payment.paidAmount)

  if (amount > 0) {
    await getPrisma().payment.create({
      data: {
        id: createId('pay'),
        financialMovementId: movementId,
        amount,
        paymentDate: toDate(payment.paymentDate) || new Date(),
        paymentMethod: payment.paymentMethod || nextMovement.paymentMethod || '',
        responsibleName: user?.name || '',
        responsibleEmail: user?.email || '',
        observations: payment.observations || '',
        auditLog: nextMovement.auditLog || [],
        payload: payment,
      },
    })
  }

  return updatedMovement
}

const importLocalStorage = async (payload = {}) => {
  const importMap = [
    ['users', ['rubik.erp.users']],
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
  const localStorageDump = payload.localStorage || payload.storage || payload
  const result = {}

  for (const [key, storageKeys] of importMap) {
    const rawItems = payload[key] || storageKeys.map((storageKey) => localStorageDump?.[storageKey]).find(Boolean)
    const items = typeof rawItems === 'string' ? JSON.parse(rawItems || '[]') : rawItems
    result[key] = await upsertMany(key, Array.isArray(items) ? items : [])
  }

  return { importedAt: new Date().toISOString(), counts: await getCounts(), result }
}

const readJsonFilePayload = () => {
  if (!fs.existsSync(DB_FILE)) {
    const error = new Error(`No existe ${DB_FILE}.`)
    error.statusCode = 404
    throw error
  }

  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))
}

const importJsonPayload = async (payload = {}) => {
  const result = {}

  for (const key of COLLECTION_KEYS) {
    result[key] = await upsertMany(key, Array.isArray(payload[key]) ? payload[key] : [])
  }

  return {
    importedAt: new Date().toISOString(),
    counts: await getCounts(),
    result,
  }
}

const importJsonFile = async () => importJsonPayload(readJsonFilePayload())

const seedInitialData = async () => {
  const filePayload = fs.existsSync(DB_FILE) ? readJsonFilePayload() : {}
  const payload = {
    ...filePayload,
    users: [...seedUsers, ...(Array.isArray(filePayload.users) ? filePayload.users : [])],
    products: [
      ...seedProducts,
      ...(Array.isArray(filePayload.products) ? filePayload.products : []),
    ],
    materials: [
      ...seedMaterials,
      ...(Array.isArray(filePayload.materials) ? filePayload.materials : []),
    ],
    expenses: Array.isArray(filePayload.expenses) ? filePayload.expenses : [],
  }

  return importJsonPayload(payload)
}

const getCounts = async () => {
  const prisma = getPrisma()
  const [
    users,
    clients,
    quotes,
    documents,
    tenders,
    workOrders,
    financeMovements,
    suppliers,
    products,
    materials,
    expenses,
  ] =
    await Promise.all([
      prisma.user.count(),
      prisma.client.count(),
      prisma.quote.count(),
      prisma.document.count(),
      prisma.tender.count(),
      prisma.workOrder.count(),
      prisma.financialMovement.count(),
      prisma.supplier.count(),
      prisma.productService.count(),
      prisma.material.count(),
      prisma.expense.count(),
    ])

  return {
    users,
    clients,
    quotes,
    documents,
    tenders,
    workOrders,
    financeMovements,
    suppliers,
    products,
    materials,
    expenses,
  }
}

module.exports = {
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
  upsertMany,
}
