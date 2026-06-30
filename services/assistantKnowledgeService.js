const dataAdapter = require('./dataAdapter')

const STOP_WORDS = new Set([
  'que',
  'cual',
  'cuales',
  'dame',
  'con',
  'para',
  'por',
  'los',
  'las',
  'una',
  'uno',
  'del',
  'desde',
  'sobre',
  'estan',
  'esta',
  'este',
  'tienen',
  'tiene',
  'hay',
  'mas',
  'resumen',
])

const SCOPE_DEFINITIONS = {
  quotes: {
    key: 'quotes',
    permission: 'quotes.view',
    label: 'Cotizaciones',
    type: 'Cotizacion',
    route: '/erp/cotizaciones',
  },
  documents: {
    key: 'documents',
    permission: 'documents.view',
    label: 'Documentos',
    type: 'Documento',
    route: '/erp/documentos',
  },
  tenders: {
    key: 'tenders',
    permission: 'tenders.view',
    label: 'Licitaciones',
    type: 'Licitacion',
    route: '/erp/licitaciones',
  },
  workOrders: {
    key: 'workOrders',
    permission: 'workorders.view',
    label: 'Ordenes de trabajo',
    type: 'Orden de trabajo',
    route: '/erp/ordenes-trabajo',
  },
  finance: {
    key: 'financeMovements',
    permission: 'finance.view',
    label: 'Finanzas',
    type: 'Movimiento financiero',
    route: '/erp/administracion/finanzas',
    sensitive: true,
  },
  clients: {
    key: 'clients',
    permission: 'clients.view',
    label: 'Clientes',
    type: 'Cliente',
    route: '/erp/clientes',
  },
  suppliers: {
    key: 'suppliers',
    permission: 'suppliers.view',
    label: 'Proveedores',
    type: 'Proveedor',
    route: '/erp/administracion/proveedores',
  },
  materials: {
    key: 'materials',
    permission: 'materials.view',
    label: 'Materiales',
    type: 'Material',
    route: '/erp/materiales',
  },
  products: {
    key: 'products',
    permission: 'products.view',
    label: 'Productos / servicios',
    type: 'Producto / servicio',
    route: '/erp/productos-servicios',
  },
  users: {
    key: 'users',
    permission: 'users.view',
    label: 'Usuarios',
    type: 'Usuario',
    route: '/erp/usuarios',
  },
}

const SCOPE_ALIASES = {
  all: 'all',
  quote: 'quotes',
  quotes: 'quotes',
  cotizaciones: 'quotes',
  documents: 'documents',
  documentos: 'documents',
  tenders: 'tenders',
  licitaciones: 'tenders',
  workorders: 'workOrders',
  workOrders: 'workOrders',
  ordenes: 'workOrders',
  finance: 'finance',
  finanzas: 'finance',
  clients: 'clients',
  clientes: 'clients',
  suppliers: 'suppliers',
  proveedores: 'suppliers',
  materials: 'materials',
  materiales: 'materials',
  products: 'products',
  productos: 'products',
  users: 'users',
  usuarios: 'users',
}

const MONEY_FIELDS = [
  'cost',
  'margin',
  'paid',
  'pending',
  'profit',
  'utility',
  'unitcost',
  'basecost',
  'wastepercent',
]

const normalizeText = (value = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s.-]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

const formatCurrency = (value) => {
  const amount = Number(value) || 0
  return `$${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(Math.round(amount))}`
}

const getNumberValue = (value) => {
  if (value === null || value === undefined || value === '') return 0
  const parsed = Number(String(value).replace(/\$/g, '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

const hasPermission = (user, permission) => {
  if (!permission) return true
  const permissions = Array.isArray(user?.permissions) ? user.permissions : []
  return permissions.includes('admin.all') || permissions.includes(permission)
}

const canViewFinance = (user) => hasPermission(user, 'finance.view') || hasPermission(user, 'ai.finance')

const safeArray = (value) => (Array.isArray(value) ? value : [])

const getDateValue = (record = {}) =>
  record.date ||
  record.fecha ||
  record.closingDate ||
  record.dueDate ||
  record.issueDate ||
  record.createdAt ||
  record.updatedAt ||
  ''

const getTimestamp = (record = {}) => {
  const timestamp = new Date(getDateValue(record)).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

const daysFromNow = (value) => {
  if (!value) return null
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return null
  return Math.ceil((timestamp - Date.now()) / 86400000)
}

const isMoneyField = (key = '') => MONEY_FIELDS.some((field) => normalizeText(key).includes(field))

const stripSensitiveFields = (value, user, scope) => {
  if (canViewFinance(user)) return value
  if (scope === 'finance') return {}
  if (Array.isArray(value)) return value.map((item) => stripSensitiveFields(item, user, scope))
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => {
        if (['materials', 'products', 'suppliers'].includes(scope)) return !isMoneyField(key)
        return true
      })
      .map(([key, nestedValue]) => [key, stripSensitiveFields(nestedValue, user, scope)]),
  )
}

const flattenValue = (value, depth = 0) => {
  if (value === null || value === undefined || depth > 3) return ''
  if (Array.isArray(value)) return value.map((item) => flattenValue(item, depth + 1)).join(' | ')
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, nestedValue]) => `${key}: ${flattenValue(nestedValue, depth + 1)}`)
      .join(' | ')
  }
  return String(value)
}

const tokenize = (query = '') =>
  normalizeText(query)
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))

const detectEntities = (query = '') => {
  const rawQuery = String(query || '')
  const normalizedQuery = normalizeText(rawQuery)

  return {
    tokens: tokenize(query),
    rut: rawQuery.match(/\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/)?.[0] || '',
    quoteNumber: rawQuery.match(/\b(?:cotizacion|cot|n|numero|folio)?\s*#?\s*(\d{4,})\b/i)?.[1] || '',
    tenderId: rawQuery.match(/\b\d{5,}-\d+-[a-z]{2}\d{2}\b/i)?.[0] || '',
    statusWords: ['borrador', 'emitida', 'enviada', 'aprobada', 'adjudicada', 'rechazada', 'pendiente', 'vencido', 'urgente', 'cerrada'].filter(
      (status) => normalizedQuery.includes(status),
    ),
    asksRecent: /reciente|ultim|nuevo|cread/.test(normalizedQuery),
    asksPending: /pendiente|vencid|atrasad|urgente|revision|seguimiento/.test(normalizedQuery),
  }
}

const getTitle = (record = {}, definition = {}) =>
  record.title ||
  record.name ||
  record.subject ||
  record.description ||
  record.documentNumber ||
  record.numeroDocumento ||
  record.quoteNumber ||
  record.tenderId ||
  record.company ||
  record.client ||
  record.email ||
  definition.type

const getStatus = (record = {}) => record.status || record.estado || record.priority || ''

const getClient = (record = {}) =>
  record.client || record.cliente || record.contactName || record.company || record.empresa || record.buyer || record.supplierName || ''

const getResponsible = (record = {}) =>
  record.seller ||
  record.vendedor ||
  record.responsibleName ||
  record.assigneeName ||
  record.requesterName ||
  record.name ||
  ''

const getAmount = (record = {}) =>
  getNumberValue(
    record.totalAmount ??
      record.total ??
      record.montoTotal ??
      record.budget ??
      record.montoNeto ??
      record.netAmount ??
      record.pendingAmount ??
      record.suggestedPrice,
  )

const toKnowledgeRecord = (scope, definition, rawRecord, user) => {
  const sanitized = stripSensitiveFields(rawRecord, user, scope)
  const title = getTitle(sanitized, definition)
  const amount = definition.sensitive && !canViewFinance(user) ? null : getAmount(sanitized)
  const date = getDateValue(sanitized)

  return {
    id: sanitized.id || sanitized.quoteNumber || sanitized.documentNumber || sanitized.tenderId || title,
    scope,
    type: definition.type,
    label: definition.label,
    route: definition.route,
    title,
    status: getStatus(sanitized),
    client: getClient(sanitized),
    date,
    amount,
    responsible: getResponsible(sanitized),
    raw: sanitized,
    searchText: normalizeText(`${definition.label} ${flattenValue(sanitized)}`),
    timestamp: getTimestamp(sanitized),
  }
}

const getAllowedDefinitions = (scope, user) => {
  const normalizedScope = SCOPE_ALIASES[scope] || scope || 'all'
  const definitions =
    normalizedScope === 'all'
      ? Object.entries(SCOPE_DEFINITIONS)
      : Object.entries(SCOPE_DEFINITIONS).filter(([key]) => key === normalizedScope)

  return definitions
    .filter(([, definition]) => hasPermission(user, definition.permission))
    .filter(([key]) => key !== 'finance' || canViewFinance(user))
}

const rankRelevantDocuments = (query, records = []) => {
  const entities = detectEntities(query)

  return records
    .map((record) => {
      let score = 0
      const searchText = record.searchText
      const titleText = normalizeText(record.title)
      const clientText = normalizeText(record.client)
      const statusText = normalizeText(record.status)
      const responsibleText = normalizeText(record.responsible)

      entities.tokens.forEach((token) => {
        if (searchText.includes(token)) score += 2
        if (titleText.includes(token)) score += 4
        if (clientText.includes(token)) score += 5
        if (responsibleText.includes(token)) score += 3
        if (statusText.includes(token)) score += 3
      })

      if (entities.rut && searchText.includes(normalizeText(entities.rut))) score += 20
      if (entities.quoteNumber && searchText.includes(entities.quoteNumber)) score += 18
      if (entities.tenderId && searchText.includes(normalizeText(entities.tenderId))) score += 25
      entities.statusWords.forEach((status) => {
        if (statusText.includes(status) || searchText.includes(status)) score += 8
      })

      const status = normalizeText(record.status)
      if (/(pendiente|vencido|urgente|revision|borrador|rechazad|critico|alto)/.test(status)) score += 4
      if (entities.asksPending && /(pendiente|vencido|urgente|revision|borrador|critico|alto)/.test(searchText)) score += 8

      const dueInDays = daysFromNow(record.raw.closingDate || record.raw.dueDate || record.raw.dueDate)
      if (dueInDays !== null && dueInDays <= 7 && dueInDays >= -3) score += 9
      if (dueInDays !== null && dueInDays < 0 && /(orden|finance|finanzas|work)/.test(record.scope)) score += 7

      const ageDays = record.timestamp ? Math.floor((Date.now() - record.timestamp) / 86400000) : 9999
      if (ageDays <= 30) score += entities.asksRecent ? 8 : 2
      if (record.amount >= 1000000) score += 3

      return { ...record, score }
    })
    .filter((record) => record.score > 0 || !query)
    .sort((first, second) => second.score - first.score || second.timestamp - first.timestamp || second.amount - first.amount)
}

const loadRecordsForDefinitions = async (definitions, user) => {
  const records = []
  const warnings = []

  for (const [scope, definition] of definitions) {
    try {
      const items = await dataAdapter.list(definition.key)
      safeArray(items).forEach((item) => records.push(toKnowledgeRecord(scope, definition, item, user)))
    } catch (error) {
      warnings.push(`No se pudo leer ${definition.label}: ${error.message}`)
    }
  }

  return { records, warnings }
}

const summarizeRecord = (record, user) => {
  const raw = record.raw || {}
  const amountText = record.amount ? `Monto: ${formatCurrency(record.amount)}.` : ''

  if (record.scope === 'tenders') {
    return [
      `${record.title} (${raw.tenderId || 'sin ID'}) para ${raw.buyer || record.client || 'comprador no informado'}.`,
      raw.object ? `Objeto: ${raw.object}.` : '',
      raw.closingDate ? `Cierre: ${raw.closingDate}${raw.closingTime ? ` ${raw.closingTime}` : ''}.` : '',
      raw.riskLevel ? `Riesgo: ${raw.riskLevel}.` : '',
      record.amount ? `Presupuesto: ${formatCurrency(record.amount)}.` : '',
    ]
      .filter(Boolean)
      .join(' ')
  }

  if (record.scope === 'quotes') {
    const items = safeArray(raw.items || raw.quoteItems)
      .map((item) => item.description || item.descripcion || item.name)
      .filter(Boolean)
      .slice(0, 3)
      .join('; ')
    const moneyLine = hasPermission(user, 'quotes.view') && record.amount ? amountText : ''
    return [
      `Cotizacion ${raw.quoteNumber || record.id} para ${record.client || 'cliente no informado'}.`,
      record.status ? `Estado: ${record.status}.` : '',
      record.responsible ? `Vendedor/responsable: ${record.responsible}.` : '',
      moneyLine,
      items ? `Items principales: ${items}.` : '',
    ]
      .filter(Boolean)
      .join(' ')
  }

  if (record.scope === 'workOrders') {
    return [
      `${record.title}.`,
      record.status ? `Estado: ${record.status}.` : '',
      raw.targetArea ? `Area responsable: ${raw.targetArea}.` : '',
      raw.assigneeName ? `Asignado a: ${raw.assigneeName}.` : '',
      raw.dueDate ? `Entrega: ${raw.dueDate}.` : '',
      raw.description ? `Trabajo solicitado: ${raw.description}.` : '',
    ]
      .filter(Boolean)
      .join(' ')
  }

  if (record.scope === 'finance') {
    return [
      `${raw.type || 'Movimiento'} ${raw.documentNumber || record.title}.`,
      record.status ? `Estado: ${record.status}.` : '',
      record.client ? `Relacionado con: ${record.client}.` : '',
      amountText,
      raw.pendingAmount ? `Saldo pendiente: ${formatCurrency(raw.pendingAmount)}.` : '',
      raw.dueDate ? `Vencimiento: ${raw.dueDate}.` : '',
    ]
      .filter(Boolean)
      .join(' ')
  }

  if (record.scope === 'documents') {
    return [
      `${record.type}: ${record.title}.`,
      record.status ? `Estado: ${record.status}.` : '',
      record.client ? `Cliente: ${record.client}.` : '',
      record.date ? `Fecha: ${record.date}.` : '',
      raw.observations ? `Contenido: ${String(raw.observations).slice(0, 240)}.` : '',
    ]
      .filter(Boolean)
      .join(' ')
  }

  return [
    `${record.type}: ${record.title}.`,
    record.status ? `Estado: ${record.status}.` : '',
    record.client ? `Relacionado con: ${record.client}.` : '',
    record.responsible ? `Responsable: ${record.responsible}.` : '',
    amountText,
  ]
    .filter(Boolean)
    .join(' ')
}

const getMissingInfoForRecord = (record) => {
  const raw = record.raw || {}
  const missing = []

  if (record.scope === 'tenders') {
    if (!raw.closingDate) missing.push(`La licitacion "${record.title}" no tiene fecha de cierre registrada.`)
    if (!raw.budget && !raw.totalAmount) missing.push(`La licitacion "${record.title}" no tiene presupuesto detectado.`)
    if (!safeArray(raw.evaluationCriteria).length) missing.push(`Faltan criterios de evaluacion en "${record.title}".`)
    if (!safeArray(raw.essentialDocuments).length) missing.push(`Faltan documentos esenciales en "${record.title}".`)
  }

  if (record.scope === 'quotes') {
    if (!record.status) missing.push(`La cotizacion "${record.title}" no tiene estado definido.`)
    if (!safeArray(raw.items || raw.quoteItems).length) missing.push(`La cotizacion "${record.title}" no tiene items guardados.`)
    if (!record.client) missing.push(`La cotizacion "${record.title}" no tiene cliente asociado.`)
  }

  if (record.scope === 'workOrders') {
    if (!raw.dueDate) missing.push(`La orden "${record.title}" no tiene fecha de entrega.`)
    if (!raw.assigneeName) missing.push(`La orden "${record.title}" no tiene encargado asignado.`)
  }

  return missing
}

const getImportantFindings = (records, user) => {
  const findings = []

  records.forEach((record) => {
    const raw = record.raw || {}
    const status = normalizeText(record.status)
    const dueInDays = daysFromNow(raw.closingDate || raw.dueDate)

    if (record.scope === 'tenders' && dueInDays !== null && dueInDays <= 7 && dueInDays >= 0) {
      findings.push(`Licitacion proxima a cerrar: ${record.title} (${raw.closingDate}).`)
    }
    if (record.scope === 'workOrders' && dueInDays !== null && dueInDays < 0 && !status.includes('finalizada')) {
      findings.push(`Orden atrasada: ${record.title} vencio el ${raw.dueDate}.`)
    }
    if (/(rechazad|vencido|critico|urgente)/.test(status)) {
      findings.push(`${record.type} con atencion prioritaria: ${record.title} (${record.status}).`)
    }
    if (record.scope === 'finance' && canViewFinance(user) && raw.pendingAmount > 0 && status.includes('vencido')) {
      findings.push(`Movimiento financiero vencido: ${record.title} con saldo ${formatCurrency(raw.pendingAmount)}.`)
    }
  })

  return [...new Set(findings)].slice(0, 8)
}

const getSuggestedActions = (records) => {
  const actions = []

  records.forEach((record) => {
    const raw = record.raw || {}
    const status = normalizeText(record.status)

    if (record.scope === 'tenders') {
      actions.push(`Revisar anexos obligatorios y criterios de evaluacion de "${record.title}".`)
      if (raw.closingDate) actions.push(`Confirmar calendario de consultas y cierre antes del ${raw.closingDate}.`)
    }
    if (record.scope === 'quotes' && /(borrador|emitida|enviada|pendiente)/.test(status)) {
      actions.push(`Hacer seguimiento comercial de la cotizacion "${record.title}".`)
    }
    if (record.scope === 'workOrders' && /(pendiente|revision|urgente)/.test(status)) {
      actions.push(`Validar responsable y proximo hito de la orden "${record.title}".`)
    }
    if (record.scope === 'documents') {
      actions.push(`Abrir el documento "${record.title}" y confirmar si requiere actualizacion o respuesta.`)
    }
  })

  return [...new Set(actions)].slice(0, 8)
}

const toRelatedDocument = (record, user) => ({
  id: record.id,
  type: record.type,
  scope: record.scope,
  title: record.title,
  status: record.status,
  client: record.client,
  date: record.date,
  amount: record.amount && (record.scope !== 'finance' || canViewFinance(user)) ? record.amount : null,
  route: record.route,
  score: record.score,
})

const getConfidence = (records, warnings) => {
  if (!records.length) return 'baja'
  if (warnings.length) return 'media'
  if (records[0].score >= 18 || records.length >= 3) return 'alta'
  return 'media'
}

const buildAnswer = ({ query, records, findings, actions, missingInfo, warnings, user }) => {
  if (!records.length) {
    return {
      summary: 'No encontre registros suficientes en los modulos permitidos para responder con precision.',
      answer:
        'No encontre informacion suficiente en los datos guardados del ERP para responder esa consulta. No voy a inventar datos: conviene revisar si el documento fue guardado, importar informacion desde el modulo correspondiente o ampliar el alcance de busqueda.',
      importantFindings: warnings,
      suggestedActions: ['Revisar el modulo relacionado o cargar el documento faltante en el ERP.'],
      missingInfo: missingInfo.length ? missingInfo : ['Faltan registros relacionados con la pregunta o permisos de lectura para consultarlos.'],
    }
  }

  const summary = `Encontre ${records.length} registro(s) relevante(s) para "${query}". Los resultados priorizan coincidencia con cliente, numero, estado, responsable, fechas, urgencia y recencia.`
  const documentLines = records
    .slice(0, 5)
    .map((record, index) => `${index + 1}. ${summarizeRecord(record, user)}`)
    .join('\n')

  const answer = [
    `Resumen ejecutivo: ${summary}`,
    `Documentos encontrados:\n${documentLines}`,
    findings.length ? `Hallazgos importantes:\n- ${findings.join('\n- ')}` : '',
    actions.length ? `Acciones recomendadas:\n- ${actions.join('\n- ')}` : '',
    missingInfo.length ? `Informacion faltante:\n- ${missingInfo.join('\n- ')}` : '',
    warnings.length ? `Advertencias de lectura:\n- ${warnings.join('\n- ')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  return {
    summary,
    answer,
    importantFindings: [...findings, ...warnings].slice(0, 10),
    suggestedActions: actions,
    missingInfo,
  }
}

const buildAssistantContext = async (query, currentUser, options = {}) => {
  const message = String(query || '').trim()
  const limit = Math.min(Math.max(Number(options.limit) || 10, 1), 25)
  const scope = SCOPE_ALIASES[options.scope] || options.scope || 'all'

  if (!hasPermission(currentUser, 'ai.chat')) {
    return {
      answer: 'No tienes permiso para consultar esta informacion.',
      summary: 'Perfil sin acceso al asistente.',
      importantFindings: [],
      relatedDocuments: [],
      suggestedActions: [],
      missingInfo: ['Solicita acceso al asistente a un administrador.'],
      confidence: 'baja',
      permissionDenied: true,
    }
  }

  const requestedDefinition = scope !== 'all' ? SCOPE_DEFINITIONS[scope] : null
  if (requestedDefinition && !hasPermission(currentUser, requestedDefinition.permission)) {
    return {
      answer: 'No tienes permiso para consultar esta informacion.',
      summary: `Tu perfil no tiene acceso a ${requestedDefinition.label}.`,
      importantFindings: [],
      relatedDocuments: [],
      suggestedActions: [],
      missingInfo: [`Solicita acceso al modulo ${requestedDefinition.label} si necesitas revisar estos datos.`],
      confidence: 'baja',
      permissionDenied: true,
    }
  }

  const definitions = getAllowedDefinitions(scope, currentUser)
  const { records, warnings } = await loadRecordsForDefinitions(definitions, currentUser)
  const rankedRecords = rankRelevantDocuments(message, records).slice(0, limit)
  const findings = getImportantFindings(rankedRecords, currentUser)
  const missingInfo = [...new Set(rankedRecords.flatMap(getMissingInfoForRecord))].slice(0, 10)
  const actions = getSuggestedActions(rankedRecords)
  const answerPayload = buildAnswer({
    query: message,
    records: rankedRecords,
    findings,
    actions,
    missingInfo,
    warnings,
    user: currentUser,
  })

  return {
    answer: answerPayload.answer,
    summary: answerPayload.summary,
    importantFindings: answerPayload.importantFindings,
    relatedDocuments: rankedRecords.map((record) => toRelatedDocument(record, currentUser)),
    suggestedActions: answerPayload.suggestedActions,
    missingInfo: answerPayload.missingInfo,
    confidence: getConfidence(rankedRecords, warnings),
    scope,
    matchedCount: rankedRecords.length,
  }
}

module.exports = {
  buildAssistantContext,
  rankRelevantDocuments,
  normalizeText,
}
