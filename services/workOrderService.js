const { randomUUID } = require('crypto')
const dataAdapter = require('./dataAdapter')
const {
  buildPreparationCatalog,
  buildWorkOrderPreparation,
  createChecklistFromRecommendation,
  createMaterialFromRecommendation,
  getPreparationDecisions,
} = require('./workOrderPreparationRules')

const WORK_ORDER_TYPES = {
  TALLER_INSTALACION: 'TALLER_INSTALACION',
}

const createLocalId = (prefix) => `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`

const STATUS_LABELS = {
  draft: 'Borrador',
  pending: 'Pendiente',
  assigned: 'Recibida',
  in_progress: 'En proceso',
  paused: 'Pausada',
  completed: 'Finalizada',
  cancelled: 'Rechazada',
}

const STATUS_ALIASES = {
  borrador: 'draft',
  draft: 'draft',
  pendiente: 'pending',
  pending: 'pending',
  recibida: 'assigned',
  assigned: 'assigned',
  asignada: 'assigned',
  'en proceso': 'in_progress',
  en_proceso: 'in_progress',
  in_progress: 'in_progress',
  pausada: 'paused',
  paused: 'paused',
  finalizada: 'completed',
  aprobada: 'completed',
  completed: 'completed',
  completada: 'completed',
  rechazada: 'cancelled',
  cancelada: 'cancelled',
  cancelled: 'cancelled',
  canceled: 'cancelled',
}

const PRIORITY_LABELS = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  urgente: 'Urgente',
}

const createError = (message, statusCode = 400) => {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

const normalizeText = (value = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

const normalizeStatus = (status = '') => {
  const normalized = normalizeText(status).replace(/\s+/g, ' ')
  return STATUS_ALIASES[normalized] || STATUS_ALIASES[normalized.replace(/\s/g, '_')] || 'pending'
}

const normalizePriority = (priority = '') => {
  const normalized = normalizeText(priority)
  return ['baja', 'media', 'alta', 'urgente'].includes(normalized) ? normalized : 'media'
}

const normalizeWorkOrderType = (type = '') => {
  const rawType = String(type || '').trim()
  const normalized = normalizeText(rawType).replace(/[\s-]+/g, '_')

  if (['taller_instalacion', 'instalacion_taller', 'taller'].includes(normalized)) {
    return WORK_ORDER_TYPES.TALLER_INSTALACION
  }

  return rawType || 'Produccion grafica'
}

const isTallerInstallationWorkOrder = (workOrder = {}) =>
  normalizeWorkOrderType(workOrder.type || workOrder.workOrderType) === WORK_ORDER_TYPES.TALLER_INSTALACION

const getDateOnly = (value) => {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString().slice(0, 10)
}

const isOverdue = (workOrder = {}) => {
  const status = normalizeStatus(workOrder.status)
  if (!workOrder.dueDate || ['completed', 'cancelled'].includes(status)) return false

  const dueDate = new Date(workOrder.dueDate)
  if (Number.isNaN(dueDate.getTime())) return false
  dueDate.setHours(0, 0, 0, 0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return dueDate < today
}

const getUserPermissions = (user = {}) => (Array.isArray(user.permissions) ? user.permissions : [])
const hasPermission = (user, permission) => getUserPermissions(user).includes('admin.all') || getUserPermissions(user).includes(permission)

const getUserArea = (user = {}) => normalizeText(`${user.area || ''} ${user.role || ''} ${user.position || ''}`)

const canViewAllWorkOrders = (user = {}) =>
  hasPermission(user, 'admin.all') ||
  hasPermission(user, 'workorders.assign') ||
  hasPermission(user, 'workorders.delete') ||
  hasPermission(user, 'workorders.complete')

const canViewWorkOrder = (workOrder = {}, user = {}) => {
  if (canViewAllWorkOrders(user)) return true

  const email = normalizeText(user.email)
  const area = getUserArea(user)
  const assignedArea = normalizeText(workOrder.assignedArea || workOrder.targetArea)
  const sourceArea = normalizeText(workOrder.sourceArea)

  if (email && [workOrder.requesterEmail, workOrder.assigneeEmail].some((value) => normalizeText(value) === email)) return true
  if (area.includes('finanza') && hasPermission(user, 'finance.view')) return true
  if (area.includes('taller') && assignedArea.includes('taller')) return true
  if (area.includes('diseno') && (assignedArea.includes('diseno') || assignedArea.includes('diseño'))) return true
  if (area && (assignedArea.includes(area) || sourceArea.includes(area))) return true

  return false
}

const countBy = (items = [], selector, fallback = 'Sin clasificar') =>
  Object.entries(
    items.reduce((summary, item) => {
      const label = selector(item) || fallback
      summary[label] = (summary[label] || 0) + 1
      return summary
    }, {}),
  )
    .map(([label, count]) => ({ label, count, value: count }))
    .sort((first, second) => second.count - first.count || first.label.localeCompare(second.label))

const ensurePayloadObject = (payload = {}) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw createError('El cuerpo de la orden de trabajo debe ser un objeto JSON valido.', 400)
  }
}

const getFirstArray = (...values) => values.find((value) => Array.isArray(value)) || []

const uniq = (values = []) => [...new Set(values.filter(Boolean))]

const toPayloadObject = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}

const getWorkOrderPayload = (workOrder = {}) => toPayloadObject(workOrder.payload)

const validateArrayField = (payload = {}, fieldName, aliases = []) => {
  const fieldNames = [fieldName, ...aliases]
  const provided = fieldNames.find((name) => payload[name] !== undefined)
  if (!provided) return

  if (!Array.isArray(payload[provided])) {
    throw createError(`El campo ${provided} debe ser un arreglo.`, 400)
  }

  if (payload[provided].length > 200) {
    throw createError(`El campo ${provided} no puede superar 200 registros.`, 400)
  }

  payload[provided].forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw createError(`El campo ${provided}[${index}] debe ser un objeto.`, 400)
    }
  })
}

const validateWorkOrderPayload = (payload = {}) => {
  ensurePayloadObject(payload)
  validateArrayField(payload, 'materials')
  validateArrayField(payload, 'checklistItems')
  validateArrayField(payload, 'evidence', ['photographicEvidence'])
  validateArrayField(payload, 'signatures')
  validateArrayField(payload, 'statusHistory')

  getFirstArray(payload.materials).forEach((item, index) => {
    const quantity = Number(item.quantity ?? item.cantidad ?? 0)
    if (!Number.isFinite(quantity) || quantity < 0) {
      throw createError(`materials[${index}].quantity debe ser un numero mayor o igual a 0.`, 400)
    }

    const unitCost = Number(item.unitCost ?? item.cost ?? item.costoUnitario ?? 0)
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      throw createError(`materials[${index}].unitCost debe ser un numero mayor o igual a 0.`, 400)
    }

    const totalCost = Number(item.totalCost ?? item.total ?? quantity * unitCost)
    if (!Number.isFinite(totalCost) || totalCost < 0) {
      throw createError(`materials[${index}].totalCost debe ser un numero mayor o igual a 0.`, 400)
    }
  })

  const evidenceItems = getFirstArray(payload.evidence, payload.photographicEvidence)
  const duplicatedEvidence = evidenceItems.reduce((seen, item, index) => {
    const duplicateKey = normalizeText(`${item.fileUrl || item.url || ''}|${item.fileName || item.filename || ''}|${item.sizeBytes || item.size || ''}`)
    if (!duplicateKey || duplicateKey === '||') return seen
    if (seen.keys.has(duplicateKey)) seen.duplicates.push(index)
    seen.keys.add(duplicateKey)
    return seen
  }, { keys: new Set(), duplicates: [] })

  if (duplicatedEvidence.duplicates.length) {
    throw createError('La evidencia fotografica contiene archivos duplicados.', 400)
  }
}

const normalizeMaterialItems = (items = []) =>
  getFirstArray(items).map((item, index) => {
    const itemPayload = toPayloadObject(item.payload)
    const quantity = Number(item.quantity ?? item.cantidad ?? 0)
    const unitCost = Number(item.unitCost ?? item.cost ?? item.costoUnitario ?? 0)
    const totalCost = Number(item.totalCost ?? item.total ?? quantity * unitCost)

    return {
      ...item,
      id: item.id || createLocalId(`wom-${index + 1}`),
      materialId: item.materialId || '',
      name: item.name || item.materialName || item.description || item.descripcion || `Material ${index + 1}`,
      sku: item.sku || '',
      unit: item.unit || item.unidad || '',
      quantity,
      unitCost,
      totalCost,
      observations: item.observations || item.observaciones || '',
      status: item.status || itemPayload.status || '',
      availability: item.availability || item.disponibilidad || itemPayload.availability || '',
      isRequired: Boolean(item.isRequired ?? item.required ?? itemPayload.isRequired ?? itemPayload.required),
      isRecommended: Boolean(item.isRecommended ?? item.recommended ?? itemPayload.isRecommended ?? itemPayload.recommended),
      confirmedForLoading: Boolean(item.confirmedForLoading ?? item.confirmadoCarga ?? itemPayload.confirmedForLoading),
      loadedInVehicle: Boolean(item.loadedInVehicle ?? item.cargadoVehiculo ?? itemPayload.loadedInVehicle),
    }
  })

const normalizeChecklistItems = (items = []) =>
  getFirstArray(items).map((item, index) => {
    const itemPayload = toPayloadObject(item.payload)

    return {
      ...item,
      id: item.id || createLocalId(`woc-${index + 1}`),
      label: item.label || item.name || item.title || `Checklist ${index + 1}`,
      category: item.category || item.section || itemPayload.category || '',
      sortOrder: Number.isFinite(Number(item.sortOrder ?? item.order ?? index)) ? Number(item.sortOrder ?? item.order ?? index) : index,
      isChecked: Boolean(item.isChecked ?? item.checked ?? item.done),
      observations: item.observations || item.notes || '',
      itemType: item.itemType || itemPayload.itemType || 'checklist',
      status: item.status || itemPayload.status || '',
      isRequired: Boolean(item.isRequired ?? item.required ?? itemPayload.isRequired ?? itemPayload.required),
      isRecommended: Boolean(item.isRecommended ?? item.recommended ?? itemPayload.isRecommended ?? itemPayload.recommended),
      confirmedForLoading: Boolean(item.confirmedForLoading ?? itemPayload.confirmedForLoading),
      loadedInVehicle: Boolean(item.loadedInVehicle ?? itemPayload.loadedInVehicle),
    }
  })

const normalizeEvidenceItems = (items = []) =>
  getFirstArray(items).map((item, index) => ({
    ...item,
    id: item.id || createLocalId(`woe-${index + 1}`),
    type: item.type || item.kind || 'photo',
    fileName: item.fileName || item.filename || item.name || '',
    fileUrl: item.fileUrl || item.url || item.publicUrl || '',
    mimeType: item.mimeType || item.mimetype || '',
    description: item.description || item.observations || '',
    category: item.category || item.evidenceType || toPayloadObject(item.payload).category || '',
  }))

const normalizeSignatureItems = (items = []) =>
  getFirstArray(items).map((item, index) => ({
    ...item,
    id: item.id || createLocalId(`wos-${index + 1}`),
    role: item.role || item.type || '',
    signerName: item.signerName || item.name || `Firmante ${index + 1}`,
    signerRut: item.signerRut || item.rut || '',
    signerEmail: item.signerEmail || item.email || '',
    signedAt: item.signedAt || '',
  }))

const normalizeStatusHistoryItems = (items = []) =>
  getFirstArray(items).map((item, index) => ({
    ...item,
    id: item.id || createLocalId(`woh-${index + 1}`),
    fromStatus: item.fromStatus || '',
    toStatus: normalizeStatus(item.toStatus || item.status),
    comment: item.comment || item.observations || '',
    userName: item.userName || '',
    userEmail: item.userEmail || '',
    createdAt: item.createdAt || new Date().toISOString(),
  }))

const createStatusHistoryItem = ({ fromStatus = '', toStatus = 'draft', comment = '', user = {} } = {}) => ({
  id: createLocalId('woh'),
  fromStatus,
  toStatus: normalizeStatus(toStatus),
  comment,
  userName: user.name || '',
  userEmail: user.email || '',
  createdAt: new Date().toISOString(),
})

const normalizeWorkOrderPayload = (payload = {}, user = {}) => {
  const status = normalizeStatus(payload.status || payload.statusLabel)
  const priority = normalizePriority(payload.priority || payload.priorityLabel)
  const type = normalizeWorkOrderType(payload.type || payload.workOrderType)
  const now = new Date().toISOString()
  const assignedArea = payload.assignedArea || payload.targetArea || payload.areaResponsable || 'Diseño'
  const assignedToName = payload.assignedToName || payload.assigneeName || payload.assignedTo || ''
  const createdByName = payload.createdByName || payload.requesterName || user.name || ''
  const workOrderNumber = payload.workOrderNumber || payload.number || `OT-${Date.now()}`
  const evidence = normalizeEvidenceItems(getFirstArray(payload.evidence, payload.photographicEvidence))

  return {
    ...payload,
    workOrderNumber,
    title: payload.title || 'Orden de trabajo',
    type,
    client: payload.clientName || payload.client || payload.cliente || '',
    clientName: payload.clientName || payload.client || payload.cliente || '',
    company: payload.company || payload.empresa || '',
    requesterName: createdByName,
    requesterEmail: payload.requesterEmail || user.email || '',
    requesterRole: payload.requesterRole || user.role || user.position || '',
    assigneeName: assignedToName,
    assigneeEmail: payload.assigneeEmail || '',
    assigneeRole: payload.assigneeRole || '',
    sourceArea: payload.sourceArea || user.area || 'Ventas',
    targetArea: assignedArea,
    assignedArea,
    assignedToName,
    priority,
    priorityLabel: PRIORITY_LABELS[priority],
    status,
    statusLabel: STATUS_LABELS[status],
    dueDate: getDateOnly(payload.dueDate) || payload.dueDate || '',
    startDate: payload.startDate || (status === 'in_progress' ? now : ''),
    completedAt: status === 'completed' ? payload.completedAt || now : payload.completedAt || '',
    createdById: payload.createdById || user.id || '',
    createdByName,
    description: payload.description || '',
    requirements: payload.details || payload.requirements || '',
    details: payload.details || payload.requirements || '',
    observations: payload.notes || payload.observations || '',
    notes: payload.notes || payload.observations || '',
    items: Array.isArray(payload.items) ? payload.items : [],
    tasks: Array.isArray(payload.tasks) ? payload.tasks : [],
    attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
    materials: normalizeMaterialItems(payload.materials),
    checklistItems: normalizeChecklistItems(payload.checklistItems),
    evidence,
    photographicEvidence: evidence,
    signatures: normalizeSignatureItems(payload.signatures),
    statusHistory: normalizeStatusHistoryItems(payload.statusHistory),
    preparationDecisions: payload.preparationDecisions || getWorkOrderPayload(payload).preparationDecisions || {},
    preparationStatus: payload.preparationStatus || getWorkOrderPayload(payload).preparationStatus || {},
    createdAt: payload.createdAt || now,
    updatedAt: now,
  }
}

const listWorkOrders = async (user = {}) => {
  const items = (await dataAdapter.list('workOrders')).map((item) => normalizeWorkOrderPayload(item, user))
  return { items: items.filter((item) => canViewWorkOrder(item, user)) }
}

const getWorkOrderById = async (id, user = {}) => {
  const item = normalizeWorkOrderPayload(await dataAdapter.findById('workOrders', id), user)
  if (!canViewWorkOrder(item, user)) throw createError('No tienes permiso para consultar esta orden de trabajo.', 403)
  return item
}

const ensureInitialStatusHistory = (workOrder = {}, user = {}) => {
  if (Array.isArray(workOrder.statusHistory) && workOrder.statusHistory.length) return workOrder

  return {
    ...workOrder,
    statusHistory: [
      createStatusHistoryItem({
        toStatus: workOrder.status || 'pending',
        comment: 'Orden de trabajo creada.',
        user,
      }),
    ],
  }
}

const createWorkOrder = async (payload = {}, user = {}) => {
  validateWorkOrderPayload(payload)
  const workOrder = ensureInitialStatusHistory(normalizeWorkOrderPayload(payload, user), user)
  return normalizeWorkOrderPayload(await dataAdapter.create('workOrders', 'wo', workOrder), user)
}

const updateWorkOrder = async (id, payload = {}, user = {}) => {
  validateWorkOrderPayload(payload)
  const current = await getWorkOrderById(id, user)
  const next = normalizeWorkOrderPayload({ ...current, ...payload, id }, user)
  const currentStatus = normalizeStatus(current.status)
  const nextStatus = normalizeStatus(next.status)

  if (currentStatus !== nextStatus) {
    next.statusHistory = [
      createStatusHistoryItem({
        fromStatus: currentStatus,
        toStatus: nextStatus,
        comment: payload.statusComment || payload.comment || 'Cambio de estado.',
        user,
      }),
      ...normalizeStatusHistoryItems(getFirstArray(payload.statusHistory, current.statusHistory)),
    ]
  }

  return normalizeWorkOrderPayload(await dataAdapter.update('workOrders', id, next), user)
}

const listTallerInstallationDrafts = async (user = {}) => {
  const { items } = await listWorkOrders(user)
  return {
    items: items.filter(
      (item) => isTallerInstallationWorkOrder(item) && normalizeStatus(item.status || item.statusLabel) === 'draft',
    ),
  }
}

const createTallerInstallationDraft = async (payload = {}, user = {}) =>
  createWorkOrder(
    {
      ...payload,
      title: payload.title || 'OT Taller Instalacion',
      type: WORK_ORDER_TYPES.TALLER_INSTALACION,
      status: 'draft',
      priority: payload.priority || 'media',
      sourceArea: payload.sourceArea || user.area || 'Ventas',
      assignedArea: payload.assignedArea || payload.targetArea || 'Taller/Instalacion',
      targetArea: payload.targetArea || payload.assignedArea || 'Taller/Instalacion',
    },
    user,
  )

const getTallerInstallationDraftById = async (id, user = {}) => {
  const workOrder = await getWorkOrderById(id, user)

  if (!isTallerInstallationWorkOrder(workOrder) || normalizeStatus(workOrder.status || workOrder.statusLabel) !== 'draft') {
    throw createError('Borrador TALLER_INSTALACION no encontrado.', 404)
  }

  return workOrder
}

const updateTallerInstallationDraft = async (id, payload = {}, user = {}) => {
  const current = await getTallerInstallationDraftById(id, user)
  return updateWorkOrder(
    id,
    {
      ...payload,
      id: current.id,
      type: WORK_ORDER_TYPES.TALLER_INSTALACION,
      status: 'draft',
    },
    user,
  )
}

const getMaterialCatalog = async () => {
  try {
    return await dataAdapter.list('materials')
  } catch (error) {
    console.error('[workOrderService] No se pudo cargar catalogo de materiales para preparacion.', error.stack || error)
    return []
  }
}

const getPreparationCatalog = async () => buildPreparationCatalog(await getMaterialCatalog())

const previewWorkOrderPreparation = async (payload = {}, user = {}) => {
  ensurePayloadObject(payload)
  const materialCatalog = await getMaterialCatalog()
  const workOrder = normalizeWorkOrderPayload(payload, user)
  return buildWorkOrderPreparation(workOrder, { materialCatalog })
}

const getWorkOrderPreparationById = async (id, user = {}) => {
  const workOrder = await getWorkOrderById(id, user)
  const materialCatalog = await getMaterialCatalog()
  const preparation = buildWorkOrderPreparation(workOrder, { materialCatalog })

  return {
    workOrder,
    ...preparation,
  }
}

const getSelectedRecommendations = (preparation = {}, payload = {}) => {
  const actionable = Array.isArray(preparation.actionableRecommendations) ? preparation.actionableRecommendations : []
  const requestedIds = new Set(getFirstArray(payload.recommendationIds, payload.ids, payload.selectedRecommendationIds))
  const acceptAll = Boolean(payload.acceptAll || payload.all)

  if (acceptAll) return actionable
  if (requestedIds.size === 0) return []
  return actionable.filter((item) => requestedIds.has(item.id))
}

const mergePreparationDecisions = (workOrder = {}, patch = {}) => {
  const current = getPreparationDecisions(workOrder)

  return {
    ...current,
    ...patch,
    acceptedRecommendationIds: uniq([
      ...getFirstArray(current.acceptedRecommendationIds),
      ...getFirstArray(patch.acceptedRecommendationIds),
    ]),
    discardedRecommendationIds: uniq([
      ...getFirstArray(current.discardedRecommendationIds).filter(
        (id) => !getFirstArray(patch.acceptedRecommendationIds).includes(id),
      ),
      ...getFirstArray(patch.discardedRecommendationIds),
    ]),
  }
}

const acceptWorkOrderPreparationRecommendations = async (id, payload = {}, user = {}) => {
  ensurePayloadObject(payload)
  const current = await getWorkOrderById(id, user)
  const materialCatalog = await getMaterialCatalog()
  const preparation = buildWorkOrderPreparation(current, { materialCatalog })
  const selected = getSelectedRecommendations(preparation, payload)

  if (!selected.length) {
    return {
      workOrder: current,
      accepted: [],
      preparation,
    }
  }

  const materialItems = selected
    .filter((item) => item.itemType === 'material')
    .map((item, index) => createMaterialFromRecommendation(item, user, index))
  const checklistItems = selected
    .filter((item) => item.itemType !== 'material')
    .map((item, index) => createChecklistFromRecommendation(item, user, index))
  const acceptedRecommendationIds = selected.map((item) => item.id)
  const nextDecisions = mergePreparationDecisions(current, {
    acceptedRecommendationIds,
    lastAcceptedAt: new Date().toISOString(),
    lastAcceptedByName: user.name || '',
    lastAcceptedByEmail: user.email || '',
  })
  const updatedWorkOrder = await updateWorkOrder(
    id,
    {
      materials: [...getFirstArray(current.materials), ...materialItems],
      checklistItems: [...getFirstArray(current.checklistItems), ...checklistItems],
      preparationDecisions: nextDecisions,
    },
    user,
  )
  const updatedPreparation = buildWorkOrderPreparation(updatedWorkOrder, { materialCatalog })

  return {
    workOrder: updatedWorkOrder,
    accepted: selected,
    preparation: updatedPreparation,
  }
}

const discardWorkOrderPreparationRecommendations = async (id, payload = {}, user = {}) => {
  ensurePayloadObject(payload)
  const current = await getWorkOrderById(id, user)
  const materialCatalog = await getMaterialCatalog()
  const preparation = buildWorkOrderPreparation(current, { materialCatalog })
  const selected = getSelectedRecommendations(preparation, payload)
  const discardedRecommendationIds = selected.map((item) => item.id)
  const nextDecisions = mergePreparationDecisions(current, {
    discardedRecommendationIds,
    lastDiscardedAt: new Date().toISOString(),
    lastDiscardedByName: user.name || '',
    lastDiscardedByEmail: user.email || '',
  })
  const updatedWorkOrder = await updateWorkOrder(id, { preparationDecisions: nextDecisions }, user)
  const updatedPreparation = buildWorkOrderPreparation(updatedWorkOrder, { materialCatalog })

  return {
    workOrder: updatedWorkOrder,
    discarded: selected,
    preparation: updatedPreparation,
  }
}

const canAuthorizeReadyException = (user = {}) =>
  hasPermission(user, 'admin.all') || hasPermission(user, 'workorders.complete') || hasPermission(user, 'workorders.assign')

const markWorkOrderReadyForDeparture = async (id, payload = {}, user = {}) => {
  ensurePayloadObject(payload)
  const current = await getWorkOrderById(id, user)
  const materialCatalog = await getMaterialCatalog()
  const preparation = buildWorkOrderPreparation(current, { materialCatalog })
  const summary = preparation.summary
  const requestedException = Boolean(payload.authorizedException || payload.exception || payload.force)
  const exceptionObservation = String(payload.exceptionObservation || payload.observation || payload.observations || '').trim()

  if (!summary.canMarkReadyForDeparture) {
    if (!requestedException) {
      throw createError('No se puede marcar la OT como lista para salida mientras existan obligatorios pendientes o faltantes.', 409)
    }

    if (!canAuthorizeReadyException(user)) {
      throw createError('No tienes permiso para autorizar una excepcion de salida.', 403)
    }

    if (!exceptionObservation) {
      throw createError('Debes indicar una observacion para autorizar la salida con pendientes.', 400)
    }
  }

  const preparationStatus = {
    ...toPayloadObject(current.preparationStatus),
    readyForDeparture: true,
    status: requestedException && !summary.canMarkReadyForDeparture ? 'ready_with_exception' : 'ready',
    markedAt: new Date().toISOString(),
    markedByName: user.name || '',
    markedByEmail: user.email || '',
    exceptionAuthorized: requestedException && !summary.canMarkReadyForDeparture,
    exceptionObservation,
    summarySnapshot: {
      counts: summary.counts,
      preparationPercent: summary.preparationPercent,
      warnings: summary.warnings,
    },
  }
  const updatedWorkOrder = await updateWorkOrder(id, { preparationStatus }, user)
  const updatedPreparation = buildWorkOrderPreparation(updatedWorkOrder, { materialCatalog })

  return {
    workOrder: updatedWorkOrder,
    preparation: updatedPreparation,
    preparationStatus,
  }
}

const getWorkOrderPrintableChecklist = async (id, user = {}) => {
  const { workOrder, ...preparation } = await getWorkOrderPreparationById(id, user)

  return {
    generatedAt: new Date().toISOString(),
    page: {
      size: 'A4',
      orientation: 'portrait',
      hideNavigation: true,
      avoidBreakInside: ['section', 'row', 'signature'],
    },
    workOrder,
    visualTokens: preparation.catalog.visualTokens,
    sections: preparation.catalog.sections,
    toolCategories: preparation.catalog.toolCategories,
    checklistGroups: preparation.catalog.checklistGroups,
    fieldDeliveryOptions: preparation.catalog.fieldDeliveryOptions,
    evidenceRequirements: preparation.catalog.evidenceRequirements,
    recommendations: preparation.recommendations,
    summary: preparation.summary,
  }
}

const deleteWorkOrder = async (id) => dataAdapter.remove('workOrders', id)

const createFromQuote = async (quoteId, payload = {}, user = {}) => {
  const quote = await dataAdapter.findById('quotes', quoteId)
  return createWorkOrder(
    {
      title: payload.title || `Orden de trabajo cotización ${quote.quoteNumber || quote.number || quoteId}`,
      type: payload.type || 'Producción gráfica',
      clientName: quote.client || quote.clientName || '',
      company: quote.company || '',
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber || quote.number || '',
      description: payload.description || quote.subject || quote.condition || '',
      details: payload.details || quote.subject || '',
      sourceArea: payload.sourceArea || 'Ventas',
      assignedArea: payload.assignedArea || payload.targetArea || 'Diseño',
      priority: payload.priority || 'media',
      status: payload.status || 'pending',
      ...payload,
    },
    user,
  )
}

const createFromDocument = async (documentId, payload = {}, user = {}) => {
  const document = await dataAdapter.findById('documents', documentId)
  return createWorkOrder(
    {
      title: payload.title || `Orden de trabajo documento ${document.documentNumber || document.numeroDocumento || documentId}`,
      type: payload.type || 'Producción gráfica',
      clientName: document.client || document.cliente || '',
      company: document.company || document.empresa || '',
      documentId: document.id,
      description: payload.description || document.observations || document.observaciones || '',
      details: payload.details || document.observations || '',
      sourceArea: payload.sourceArea || 'Ventas',
      assignedArea: payload.assignedArea || payload.targetArea || 'Diseño',
      priority: payload.priority || 'media',
      status: payload.status || 'pending',
      ...payload,
    },
    user,
  )
}

const getWorkOrderStats = async (user = {}) => {
  const { items } = await listWorkOrders(user)
  const pendingStatuses = new Set(['draft', 'pending', 'assigned'])
  const inProgressStatuses = new Set(['in_progress', 'paused'])
  const completedStatuses = new Set(['completed'])

  return {
    totals: {
      workOrders: items.length,
      pending: items.filter((item) => pendingStatuses.has(normalizeStatus(item.status))).length,
      inProgress: items.filter((item) => inProgressStatuses.has(normalizeStatus(item.status))).length,
      urgent: items.filter((item) => normalizePriority(item.priority) === 'urgente').length,
      overdue: items.filter(isOverdue).length,
      completed: items.filter((item) => completedStatuses.has(normalizeStatus(item.status))).length,
    },
    byStatus: countBy(items, (item) => STATUS_LABELS[normalizeStatus(item.status)]),
    byArea: countBy(items, (item) => item.assignedArea || item.targetArea, 'Sin área'),
    byResponsible: countBy(items, (item) => item.assignedToName || item.assigneeName, 'Sin responsable'),
    byPriority: countBy(items, (item) => PRIORITY_LABELS[normalizePriority(item.priority)]),
    recentActivity: getWorkOrderActivityItems(items),
    updatedAt: new Date().toISOString(),
  }
}

const getWorkOrderActivityItems = (items = []) =>
  items
    .flatMap((item) => {
      const movementItems = Array.isArray(item.movements) ? item.movements : []
      const baseActivity = {
        id: `work-order-${item.id}`,
        workOrderId: item.id,
        title: item.title,
        status: item.status,
        statusLabel: item.statusLabel || STATUS_LABELS[normalizeStatus(item.status)],
        assignedArea: item.assignedArea || item.targetArea || '',
        assignedToName: item.assignedToName || item.assigneeName || '',
        createdAt: item.updatedAt || item.createdAt,
        type: 'workOrder',
      }

      return [
        baseActivity,
        ...movementItems.map((movement) => ({
          ...baseActivity,
          id: movement.id || `${baseActivity.id}-movement-${movement.createdAt || Date.now()}`,
          title: movement.comment || movement.message || baseActivity.title,
          createdAt: movement.createdAt || baseActivity.createdAt,
          type: 'workOrderMovement',
        })),
      ]
    })
    .sort((first, second) => new Date(second.createdAt || 0) - new Date(first.createdAt || 0))
    .slice(0, 20)

const getWorkOrderActivity = async (user = {}) => {
  const { items } = await listWorkOrders(user)
  return { items: getWorkOrderActivityItems(items) }
}

module.exports = {
  createFromDocument,
  createFromQuote,
  createTallerInstallationDraft,
  createWorkOrder,
  deleteWorkOrder,
  discardWorkOrderPreparationRecommendations,
  acceptWorkOrderPreparationRecommendations,
  getPreparationCatalog,
  getTallerInstallationDraftById,
  getWorkOrderPreparationById,
  getWorkOrderPrintableChecklist,
  getWorkOrderActivity,
  getWorkOrderById,
  getWorkOrderStats,
  listWorkOrders,
  listTallerInstallationDrafts,
  markWorkOrderReadyForDeparture,
  normalizePriority,
  normalizeStatus,
  normalizeWorkOrderPayload,
  previewWorkOrderPreparation,
  updateTallerInstallationDraft,
  updateWorkOrder,
  WORK_ORDER_TYPES,
}
