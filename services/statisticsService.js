const dataAdapter = require('./dataAdapter')

const COLLECTION_KEYS = {
  clients: 'clients',
  documents: 'documents',
  financeMovements: 'financeMovements',
  materials: 'materials',
  products: 'products',
  quotes: 'quotes',
  suppliers: 'suppliers',
  tenders: 'tenders',
  users: 'users',
  workOrders: 'workOrders',
}

const nowIso = () => new Date().toISOString()

const toNumber = (value) => {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

const normalizeText = (value, fallback = 'Sin clasificar') => {
  const text = String(value || '').trim()
  return text || fallback
}

const getDate = (item = {}) =>
  item.updatedAt ||
  item.createdAt ||
  item.date ||
  item.fecha ||
  item.issueDate ||
  item.dueDate ||
  item.closingDate ||
  ''

const getTimestamp = (item = {}) => {
  const timestamp = new Date(getDate(item) || 0).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

const getMonthKey = (value) => {
  const parsedDate = new Date(value || 0)
  if (Number.isNaN(parsedDate.getTime())) return ''
  return `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}`
}

const getRecentMonths = (count = 6) => {
  const today = new Date()

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - (count - 1 - index), 1)

    return {
      key: getMonthKey(date),
      label: new Intl.DateTimeFormat('es-CL', { month: 'short' }).format(date),
    }
  })
}

const getQuoteNumber = (quote = {}) =>
  String(quote.quoteNumber || quote.number || quote.numeroDocumento || quote.documentNumber || quote.id || '')

const getQuoteClient = (quote = {}) =>
  quote.client || quote.clientName || quote.cliente || quote.payload?.client?.client || quote.payload?.client?.attention || ''

const getQuoteCompany = (quote = {}) => quote.company || quote.empresa || quote.payload?.client?.company || ''

const getQuoteSeller = (quote = {}) => quote.seller || quote.vendedor || quote.payload?.seller?.name || ''

const getQuoteStatus = (quote = {}) => quote.status || quote.estado || 'Borrador'

const getQuoteNet = (quote = {}) =>
  toNumber(quote.netAmount ?? quote.net ?? quote.montoNeto ?? quote.amounts?.net ?? quote.payload?.amounts?.net)

const getQuoteTax = (quote = {}) =>
  toNumber(quote.taxAmount ?? quote.iva ?? quote.amounts?.iva ?? quote.payload?.amounts?.iva)

const getQuoteTotal = (quote = {}) =>
  toNumber(quote.totalAmount ?? quote.total ?? quote.amounts?.total ?? quote.payload?.amounts?.total)

const getDocumentStatus = (document = {}) => document.status || document.estado || 'Borrador'

const getDocumentType = (document = {}) =>
  document.type || document.tipoDocumento || document.documentType || 'Documento'

const getDocumentNumber = (document = {}) =>
  String(document.documentNumber || document.numeroDocumento || document.quoteNumber || document.id || '')

const getTenderStatus = (tender = {}) => tender.status || tender.estado || 'Detectada'

const getTenderRisk = (tender = {}) => tender.riskLevel || tender.riesgo || 'Sin riesgo'

const getWorkOrderStatus = (workOrder = {}) => workOrder.status || workOrder.estado || 'Pendiente'

const getWorkOrderArea = (workOrder = {}) =>
  workOrder.targetArea || workOrder.areaResponsable || workOrder.assignedArea || 'Sin área'

const getWorkOrderResponsible = (workOrder = {}) =>
  workOrder.assigneeName || workOrder.assignedTo || workOrder.responsibleName || 'Sin responsable'

const getFinanceStatus = (movement = {}) => movement.status || movement.estado || 'Sin pagar'

const getFinanceType = (movement = {}) => movement.type || movement.tipo || 'Sin tipo'

const countBy = (items = [], selector, fallback = 'Sin clasificar') =>
  Object.entries(
    items.reduce((summary, item) => {
      const label = normalizeText(selector(item), fallback)
      summary[label] = (summary[label] || 0) + 1
      return summary
    }, {}),
  )
    .map(([label, value]) => ({ label, value, count: value }))
    .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label, 'es'))

const sumBy = (items = [], selector, fallback = 'Sin clasificar', valueSelector = () => 0) =>
  Object.entries(
    items.reduce((summary, item) => {
      const label = normalizeText(selector(item), fallback)
      summary[label] = (summary[label] || 0) + toNumber(valueSelector(item))
      return summary
    }, {}),
  )
    .map(([label, value]) => ({ label, value, total: value, count: value }))
    .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label, 'es'))

const getLastItems = (items = [], limit = 6) =>
  [...items].sort((first, second) => getTimestamp(second) - getTimestamp(first)).slice(0, limit)

const safeList = async (key) => {
  try {
    const items = await dataAdapter.list(key)
    return Array.isArray(items) ? items : []
  } catch (error) {
    console.warn(`[statisticsService] No se pudo listar ${key}:`, error.message)
    return []
  }
}

const loadCollections = async () => {
  const entries = await Promise.all(
    Object.entries(COLLECTION_KEYS).map(async ([alias, key]) => [alias, await safeList(key)]),
  )

  return Object.fromEntries(entries)
}

const buildMonthlyStats = ({ financeMovements, quotes, documents, workOrders }) => {
  const months = getRecentMonths(6)

  return {
    labels: months.map((month) => month.label),
    keys: months.map((month) => month.key),
    quoteTotals: months.map((month) =>
      quotes
        .filter((quote) => getMonthKey(quote.date || quote.fecha || quote.createdAt) === month.key)
        .reduce((total, quote) => total + getQuoteTotal(quote), 0),
    ),
    quoteCounts: months.map(
      (month) => quotes.filter((quote) => getMonthKey(quote.date || quote.fecha || quote.createdAt) === month.key).length,
    ),
    income: months.map((month) =>
      financeMovements
        .filter((movement) => getFinanceType(movement) === 'Ingreso' && getMonthKey(movement.issueDate || movement.createdAt) === month.key)
        .reduce((total, movement) => total + toNumber(movement.totalAmount), 0),
    ),
    expenses: months.map((month) =>
      financeMovements
        .filter((movement) => getFinanceType(movement) === 'Egreso' && getMonthKey(movement.issueDate || movement.createdAt) === month.key)
        .reduce((total, movement) => total + toNumber(movement.totalAmount), 0),
    ),
    activity: months.map((month) => {
      const quoteCount = quotes.filter((quote) => getMonthKey(quote.date || quote.fecha || quote.createdAt) === month.key).length
      const documentCount = documents.filter((document) => getMonthKey(document.date || document.fecha || document.createdAt) === month.key).length
      const orderCount = workOrders.filter((order) => getMonthKey(order.createdAt || order.updatedAt || order.dueDate) === month.key).length
      return quoteCount + documentCount + orderCount
    }),
  }
}

const buildFinanceSummary = (financeMovements = []) => {
  const incomeMovements = financeMovements.filter((movement) => getFinanceType(movement) === 'Ingreso')
  const expenseMovements = financeMovements.filter((movement) => getFinanceType(movement) === 'Egreso')
  const receivable = incomeMovements.reduce((total, movement) => total + toNumber(movement.pendingAmount), 0)
  const payable = expenseMovements.reduce((total, movement) => total + toNumber(movement.pendingAmount), 0)
  const income = incomeMovements.reduce((total, movement) => total + toNumber(movement.totalAmount), 0)
  const expenses = expenseMovements.reduce((total, movement) => total + toNumber(movement.totalAmount), 0)
  const totalPending = financeMovements.reduce((total, movement) => total + toNumber(movement.pendingAmount), 0)
  const totalPaid = financeMovements.reduce((total, movement) => total + toNumber(movement.paidAmount), 0)
  const overdue = financeMovements.filter((movement) => getFinanceStatus(movement) === 'Vencido').length

  return {
    income,
    expenses,
    netFlow: income - expenses,
    overdue,
    payable,
    projectedFlow: receivable - payable,
    receivable,
    totalPaid,
    totalPending,
  }
}

const buildRecentActivity = ({ documents, financeMovements, quotes, tenders, workOrders }, limit = 12) => {
  const quoteActivity = quotes.map((quote) => ({
    id: `quote-${quote.id || getQuoteNumber(quote)}`,
    amount: getQuoteTotal(quote),
    date: quote.updatedAt || quote.createdAt || quote.date || quote.fecha || '',
    module: 'Cotizaciones',
    status: getQuoteStatus(quote),
    subtitle: [getQuoteClient(quote), getQuoteSeller(quote)].filter(Boolean).join(' / '),
    title: `Cotización ${getQuoteNumber(quote)}`,
    type: 'quote',
  }))
  const documentActivity = documents.map((document) => ({
    id: `document-${document.id || getDocumentNumber(document)}`,
    amount: toNumber(document.totalAmount ?? document.total ?? document.montoTotal),
    date: document.updatedAt || document.createdAt || document.date || document.fecha || '',
    module: 'Documentos',
    status: getDocumentStatus(document),
    subtitle: [document.company || document.empresa, document.seller || document.vendedor].filter(Boolean).join(' / '),
    title: `${getDocumentType(document)} ${getDocumentNumber(document)}`.trim(),
    type: 'document',
  }))
  const tenderActivity = tenders.map((tender) => ({
    id: `tender-${tender.id || tender.tenderId}`,
    amount: toNumber(tender.budget),
    date: tender.updatedAt || tender.createdAt || tender.closingDate || '',
    module: 'Licitaciones',
    status: getTenderStatus(tender),
    subtitle: tender.buyer || '',
    title: tender.title || tender.tenderId || 'Licitación',
    type: 'tender',
  }))
  const workOrderActivity = workOrders.map((workOrder) => ({
    id: `work-order-${workOrder.id}`,
    date: workOrder.updatedAt || workOrder.createdAt || workOrder.dueDate || '',
    module: 'Órdenes de trabajo',
    status: getWorkOrderStatus(workOrder),
    subtitle: [workOrder.sourceArea, getWorkOrderArea(workOrder)].filter(Boolean).join(' → '),
    title: workOrder.title || 'Orden de trabajo',
    type: 'workOrder',
  }))
  const financeActivity = financeMovements.map((movement) => ({
    id: `finance-${movement.id}`,
    amount: toNumber(movement.totalAmount),
    date: movement.updatedAt || movement.createdAt || movement.issueDate || movement.dueDate || '',
    module: 'Finanzas',
    status: getFinanceStatus(movement),
    subtitle: [movement.client || movement.company || movement.supplierName, getFinanceType(movement)].filter(Boolean).join(' / '),
    title: movement.description || movement.documentNumber || 'Movimiento financiero',
    type: 'finance',
  }))

  return [...quoteActivity, ...documentActivity, ...tenderActivity, ...workOrderActivity, ...financeActivity]
    .sort((first, second) => new Date(second.date || 0).getTime() - new Date(first.date || 0).getTime())
    .slice(0, limit)
}

const buildStandardStats = async () => {
  const collections = await loadCollections()
  const {
    clients,
    documents,
    financeMovements,
    materials,
    products,
    quotes,
    suppliers,
    tenders,
    users,
    workOrders,
  } = collections
  const financialSummary = buildFinanceSummary(financeMovements)
  const monthly = buildMonthlyStats({ financeMovements, quotes, documents, workOrders })
  const quoteNetAmount = quotes.reduce((total, quote) => total + getQuoteNet(quote), 0)
  const quoteTaxAmount = quotes.reduce((total, quote) => total + getQuoteTax(quote), 0)
  const quoteTotalAmount = quotes.reduce((total, quote) => total + getQuoteTotal(quote), 0)
  const activeClients = clients.filter((client) => (client.status || client.estado || 'Activo') === 'Activo').length
  const activeUsers = users.filter((user) => (user.status || user.estado || 'Activo') === 'Activo').length
  const quotesByStatus = countBy(quotes, getQuoteStatus, 'Sin estado')
  const quotesBySeller = sumBy(quotes, getQuoteSeller, 'Sin vendedor', getQuoteTotal)
  const quotesByClient = sumBy(quotes, (quote) => getQuoteCompany(quote) || getQuoteClient(quote), 'Sin cliente', getQuoteTotal)
  const documentsByStatus = countBy(documents, getDocumentStatus, 'Sin estado')
  const documentsByType = countBy(documents, getDocumentType, 'Sin tipo')
  const tendersByStatus = countBy(tenders, getTenderStatus, 'Sin estado')
  const tendersByRisk = countBy(tenders, getTenderRisk, 'Sin riesgo')
  const workOrdersByStatus = countBy(workOrders, getWorkOrderStatus, 'Sin estado')
  const workOrdersByArea = countBy(workOrders, getWorkOrderArea, 'Sin área')
  const workOrdersByResponsible = countBy(workOrders, getWorkOrderResponsible, 'Sin responsable')
  const financeByType = countBy(financeMovements, getFinanceType, 'Sin tipo')
  const financeByStatus = countBy(financeMovements, getFinanceStatus, 'Sin estado')
  const clientsByStatus = countBy(clients, (client) => client.status || client.estado, 'Sin estado')
  const suppliersByStatus = countBy(suppliers, (supplier) => supplier.status || supplier.estado, 'Sin estado')
  const usersByStatus = countBy(users, (user) => user.status || user.estado, 'Sin estado')
  const usersByRole = countBy(users, (user) => user.role || user.rol || user.position, 'Sin rol')
  const recentActivity = buildRecentActivity(collections)

  return {
    totals: {
      activeClients,
      activeUsers,
      clients: clients.length,
      documents: documents.length,
      expenses: financialSummary.expenses,
      financeMovements: financeMovements.length,
      income: financialSummary.income,
      materials: materials.length,
      products: products.length,
      quoteNetAmount,
      quoteTaxAmount,
      quoteTotalAmount,
      quotes: quotes.length,
      suppliers: suppliers.length,
      tenders: tenders.length,
      users: users.length,
      workOrders: workOrders.length,
    },
    byStatus: [
      ...quotesByStatus.map((item) => ({ ...item, module: 'quotes' })),
      ...documentsByStatus.map((item) => ({ ...item, module: 'documents' })),
      ...tendersByStatus.map((item) => ({ ...item, module: 'tenders' })),
      ...workOrdersByStatus.map((item) => ({ ...item, module: 'workOrders' })),
      ...financeByStatus.map((item) => ({ ...item, module: 'finance' })),
    ],
    byType: [
      ...documentsByType.map((item) => ({ ...item, module: 'documents' })),
      ...financeByType.map((item) => ({ ...item, module: 'finance' })),
    ],
    byUser: [...quotesBySeller, ...workOrdersByResponsible],
    byClient: quotesByClient,
    charts: {
      clients: { byStatus: clientsByStatus },
      documents: { byStatus: documentsByStatus, byType: documentsByType },
      finance: { byStatus: financeByStatus, byType: financeByType },
      materials: { byStatus: countBy(materials, (material) => material.status || material.estado, 'Sin estado') },
      products: { byStatus: countBy(products, (product) => product.status || product.estado, 'Sin estado') },
      quotes: { byStatus: quotesByStatus, byClient: quotesByClient, bySeller: quotesBySeller },
      tenders: { byRisk: tendersByRisk, byRiskLevel: tendersByRisk, byStatus: tendersByStatus },
      suppliers: { byStatus: suppliersByStatus },
      users: { byRole: usersByRole, byStatus: usersByStatus },
      workOrders: {
        byArea: workOrdersByArea,
        byResponsible: workOrdersByResponsible,
        byStatus: workOrdersByStatus,
      },
    },
    clientsByStatus,
    collections: {
      documents: getLastItems(documents, 12),
      quotes: getLastItems(quotes, 12),
      tenders: getLastItems(tenders, 12),
      workOrders: getLastItems(workOrders, 12),
    },
    documentsByStatus,
    documentsByType,
    financeByStatus,
    financeByType,
    financialSummary,
    monthly,
    quotesByClient,
    quotesBySeller,
    quotesByStatus,
    recent: {
      documents: getLastItems(documents),
      financeMovements: getLastItems(financeMovements),
      quotes: getLastItems(quotes),
      tenders: getLastItems(tenders),
      users: getLastItems(users),
      workOrders: getLastItems(workOrders),
    },
    recentActivity,
    suppliersByStatus,
    tendersByRisk,
    tendersByStatus,
    updatedAt: nowIso(),
    usersByRole,
    usersByStatus,
    workOrdersByArea,
    workOrdersByResponsible,
    workOrdersByStatus,
  }
}

const getDashboardSummary = () => buildStandardStats()

const getDashboardStats = () => buildStandardStats()

const getDashboardActivity = async () => {
  const stats = await buildStandardStats()

  return {
    totals: stats.totals,
    byStatus: [],
    byType: [],
    byUser: [],
    byClient: [],
    recentActivity: stats.recentActivity,
    financialSummary: stats.financialSummary,
    updatedAt: stats.updatedAt,
  }
}

const getQuoteStats = async () => {
  const stats = await buildStandardStats()

  return {
    totals: {
      quotes: stats.totals.quotes,
      quoteNetAmount: stats.totals.quoteNetAmount,
      quoteTaxAmount: stats.totals.quoteTaxAmount,
      quoteTotalAmount: stats.totals.quoteTotalAmount,
    },
    byStatus: stats.quotesByStatus,
    byType: [],
    byUser: stats.quotesBySeller,
    byClient: stats.quotesByClient,
    quotesByClient: stats.quotesByClient,
    quotesBySeller: stats.quotesBySeller,
    quotesByStatus: stats.quotesByStatus,
    recentActivity: stats.recent.quotes,
    financialSummary: stats.financialSummary,
    updatedAt: stats.updatedAt,
  }
}

const getDocumentStats = async () => {
  const stats = await buildStandardStats()

  return {
    total: stats.totals.documents,
    totals: { documents: stats.totals.documents },
    byStatus: stats.documentsByStatus,
    byType: stats.documentsByType,
    byUser: [],
    byClient: [],
    documentsByStatus: stats.documentsByStatus,
    documentsByType: stats.documentsByType,
    lastDocuments: stats.recent.documents,
    recentActivity: stats.recent.documents,
    financialSummary: stats.financialSummary,
    updatedAt: stats.updatedAt,
  }
}

const getTenderStats = async () => {
  const stats = await buildStandardStats()

  return {
    totals: { tenders: stats.totals.tenders },
    byStatus: stats.tendersByStatus,
    byType: stats.tendersByRisk,
    byUser: [],
    byClient: [],
    tendersByRisk: stats.tendersByRisk,
    tendersByStatus: stats.tendersByStatus,
    recentActivity: stats.recent.tenders,
    financialSummary: stats.financialSummary,
    updatedAt: stats.updatedAt,
  }
}

const getWorkOrderStats = async () => {
  const stats = await buildStandardStats()

  return {
    totals: { workOrders: stats.totals.workOrders },
    byStatus: stats.workOrdersByStatus,
    byType: stats.workOrdersByArea,
    byUser: stats.workOrdersByResponsible,
    byClient: [],
    recentActivity: stats.recent.workOrders,
    financialSummary: stats.financialSummary,
    updatedAt: stats.updatedAt,
    workOrdersByArea: stats.workOrdersByArea,
    workOrdersByResponsible: stats.workOrdersByResponsible,
    workOrdersByStatus: stats.workOrdersByStatus,
  }
}

const getFinanceStats = async () => {
  const stats = await buildStandardStats()

  return {
    totals: {
      expenses: stats.totals.expenses,
      financeMovements: stats.totals.financeMovements,
      income: stats.totals.income,
    },
    byStatus: stats.financeByStatus,
    byType: stats.financeByType,
    byUser: [],
    byClient: [],
    financeByStatus: stats.financeByStatus,
    financeByType: stats.financeByType,
    recentActivity: stats.recent.financeMovements,
    financialSummary: stats.financialSummary,
    monthly: stats.monthly,
    updatedAt: stats.updatedAt,
  }
}

const getClientStats = async () => {
  const stats = await buildStandardStats()

  return {
    totals: { activeClients: stats.totals.activeClients, clients: stats.totals.clients },
    byStatus: stats.clientsByStatus,
    byType: [],
    byUser: [],
    byClient: stats.quotesByClient,
    clientsByStatus: stats.clientsByStatus,
    recentActivity: [],
    financialSummary: stats.financialSummary,
    updatedAt: stats.updatedAt,
  }
}

const getUserStats = async () => {
  const stats = await buildStandardStats()

  return {
    totals: { activeUsers: stats.totals.activeUsers, users: stats.totals.users },
    byStatus: stats.usersByStatus,
    byType: stats.usersByRole,
    byUser: stats.usersByRole,
    byClient: [],
    recentActivity: stats.recent.users,
    financialSummary: stats.financialSummary,
    updatedAt: stats.updatedAt,
    usersByRole: stats.usersByRole,
    usersByStatus: stats.usersByStatus,
  }
}

const getSupplierStats = async () => {
  const stats = await buildStandardStats()

  return {
    totals: { suppliers: stats.totals.suppliers },
    byStatus: stats.suppliersByStatus,
    byType: [],
    byUser: [],
    byClient: [],
    recentActivity: [],
    financialSummary: stats.financialSummary,
    suppliersByStatus: stats.suppliersByStatus,
    updatedAt: stats.updatedAt,
  }
}

const getInventoryStats = async (collectionKey) => {
  const stats = await buildStandardStats()
  const isMaterial = collectionKey === 'materials'
  const totalKey = isMaterial ? 'materials' : 'products'
  const statusKey = isMaterial ? 'materials' : 'products'
  const status = stats.charts[statusKey]?.byStatus || []

  return {
    totals: { [totalKey]: stats.totals[totalKey] },
    byStatus: status,
    byType: [],
    byUser: [],
    byClient: [],
    recentActivity: [],
    financialSummary: stats.financialSummary,
    updatedAt: stats.updatedAt,
  }
}

module.exports = {
  getClientStats,
  getDashboardActivity,
  getDashboardStats,
  getDashboardSummary,
  getDocumentStats,
  getFinanceStats,
  getInventoryStats,
  getQuoteStats,
  getSupplierStats,
  getTenderStats,
  getUserStats,
  getWorkOrderStats,
}
