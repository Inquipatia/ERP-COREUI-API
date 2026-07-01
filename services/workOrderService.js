const dataAdapter = require('./dataAdapter')

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

const normalizeWorkOrderPayload = (payload = {}, user = {}) => {
  const status = normalizeStatus(payload.status || payload.statusLabel)
  const priority = normalizePriority(payload.priority || payload.priorityLabel)
  const now = new Date().toISOString()
  const assignedArea = payload.assignedArea || payload.targetArea || payload.areaResponsable || 'Diseño'
  const assignedToName = payload.assignedToName || payload.assigneeName || payload.assignedTo || ''
  const createdByName = payload.createdByName || payload.requesterName || user.name || ''
  const workOrderNumber = payload.workOrderNumber || payload.number || `OT-${Date.now()}`

  return {
    ...payload,
    workOrderNumber,
    title: payload.title || 'Orden de trabajo',
    type: payload.type || 'Producción gráfica',
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

const createWorkOrder = async (payload = {}, user = {}) => {
  const workOrder = normalizeWorkOrderPayload(payload, user)
  return normalizeWorkOrderPayload(await dataAdapter.create('workOrders', 'wo', workOrder), user)
}

const updateWorkOrder = async (id, payload = {}, user = {}) => {
  const current = await getWorkOrderById(id, user)
  const next = normalizeWorkOrderPayload({ ...current, ...payload, id }, user)
  return normalizeWorkOrderPayload(await dataAdapter.update('workOrders', id, next), user)
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
  createWorkOrder,
  deleteWorkOrder,
  getWorkOrderActivity,
  getWorkOrderById,
  getWorkOrderStats,
  listWorkOrders,
  normalizePriority,
  normalizeStatus,
  normalizeWorkOrderPayload,
  updateWorkOrder,
}
