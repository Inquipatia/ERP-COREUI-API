const PREPARATION_STATUSES = [
  { value: 'suggested', label: 'Sugerido', tone: 'info' },
  { value: 'pending', label: 'Pendiente', tone: 'warning' },
  { value: 'available', label: 'Disponible', tone: 'info' },
  { value: 'confirmed', label: 'Confirmado', tone: 'success' },
  { value: 'loaded', label: 'Cargado', tone: 'success' },
  { value: 'used', label: 'Utilizado', tone: 'success' },
  { value: 'returned', label: 'Devuelto', tone: 'neutral' },
  { value: 'not_applicable', label: 'No aplica', tone: 'neutral' },
  { value: 'missing', label: 'Faltante', tone: 'danger' },
  { value: 'discarded', label: 'Descartado', tone: 'neutral' },
]

const VISUAL_TOKENS = {
  surface: '#f6f8fb',
  card: '#ffffff',
  border: '#b7c8e6',
  heading: '#172033',
  muted: '#61728d',
  violet: '#5444e9',
  blue: '#334da3',
  magenta: '#dd3be8',
  cyan: '#29c6d7',
  radius: 18,
}

const WORK_ORDER_SECTIONS = [
  {
    number: '01',
    title: 'DATOS DEL CLIENTE Y DEL TRABAJO',
    fields: [
      'workOrderNumber',
      'dueDate',
      'assigneeName',
      'clientName',
      'company',
      'requesterName',
      'requesterEmail',
      'priority',
      'targetArea',
      'installationAddress',
      'commune',
      'scheduleAccess',
      'type',
      'supportSurface',
      'description',
      'scheduledDate',
      'assignedPersonnel',
    ],
  },
  {
    number: '02',
    title: 'MATERIALES Y GRAFICAS A LLEVAR',
    collection: 'materials',
  },
  {
    number: '03',
    title: 'HERRAMIENTAS E INSUMOS CRITICOS',
    collection: 'toolItems',
  },
  {
    number: '04',
    title: 'CONTROL PREVIO A SALIDA DE TALLER',
    collection: 'preDepartureChecklist',
  },
  {
    number: '05',
    title: 'CONTROL DE INSTALACION EN TERRENO',
    collection: 'fieldChecklist',
  },
  {
    number: '06',
    title: 'REGISTRO DE EVIDENCIA FOTOGRAFICA',
    collection: 'evidence',
  },
  {
    number: '07',
    title: 'OBSERVACIONES, PENDIENTES Y FIRMAS',
    collection: 'closing',
  },
]

const TOOL_CATEGORIES = [
  {
    id: 'limpieza',
    title: 'Limpieza',
    tone: 'blue',
    items: [
      'Alcohol isopropilico',
      'Panos microfibra',
      'Limpiavidrios',
      'Removedor / desengrasante',
      'Pulverizador',
      'Guantes',
    ],
  },
  {
    id: 'aplicacion',
    title: 'Aplicacion',
    tone: 'magenta',
    items: [
      'Paletas / espatulas',
      'Cutter + repuestos',
      'Huincha / regla',
      'Masking tape',
      'Imanes / cinta guia',
      'Aguja rompe burbujas',
    ],
  },
  {
    id: 'equipos',
    title: 'Equipos',
    tone: 'blue',
    items: [
      'Pistola de calor',
      'Alargador electrico',
      'Escalera / banquillo',
      'Extension / zapatilla',
      'Linterna / foco',
      'Bolso herramientas',
    ],
  },
  {
    id: 'seguridad',
    title: 'Seguridad',
    tone: 'magenta',
    items: [
      'Conos / senalizacion',
      'Chaleco reflectante',
      'EPP segun terreno',
      'Proteccion piso / vehiculo',
      'Bolsa residuos',
      'Botiquin basico',
    ],
  },
]

const CHECKLIST_GROUPS = [
  {
    id: 'revision_interna',
    title: 'Revision interna',
    items: [
      'Material completo segun OT',
      'Medidas revisadas vs archivo',
      'Cantidad de piezas confirmada',
      'Laminado / terminacion revisada',
      'Graficas enrolladas y protegidas',
      'Archivos / referencias cargadas',
      'Direccion y horario confirmados',
      'Contacto de terreno confirmado',
    ],
  },
  {
    id: 'revision_tecnica',
    title: 'Revision tecnica',
    items: [
      'Superficie definida y validada',
      'Instalador asignado',
      'Herramientas completas',
      'Insumos de limpieza completos',
      'EPP / seguridad cargada',
      'Vehiculo de despacho listo',
      'Fotos de referencia enviadas',
      'Observaciones comunicadas',
    ],
  },
  {
    id: 'control_terreno',
    title: 'Control de instalacion en terreno',
    items: [
      'Validar superficie limpia y seca',
      'Revisar pintura / estado del soporte',
      'Presentar grafica antes de instalar',
      'Confirmar ubicacion con cliente',
      'Aplicar sin tension ni arrugas',
      'Controlar burbujas y bordes',
      'Sellar / calentar zonas criticas',
      'Limpiar area y retirar residuos',
    ],
  },
]

const FIELD_DELIVERY_OPTIONS = [
  { value: 'ok', label: 'Instalacion OK' },
  { value: 'with_observations', label: 'Con observaciones' },
  { value: 'requires_visit', label: 'Requiere visita' },
  { value: 'pending_client', label: 'Pendiente cliente' },
]

const EVIDENCE_REQUIREMENTS = [
  'Soporte antes de intervenir',
  'Limpieza / preparacion de superficie',
  'Presentacion de grafica antes de aplicar',
  'Proceso de instalacion',
  'Final general del trabajo terminado',
  'Detalles criticos / terminaciones',
  'Fotos adjuntas a la OT',
  'Fotos enviadas a cliente / ejecutivo',
]

const toArray = (value) => (Array.isArray(value) ? value : [])

const toPayloadObject = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}

const normalizeText = (value = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

const slugify = (value = '') =>
  normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const uniq = (values = []) => [...new Set(values.filter(Boolean))]

const getPayload = (workOrder = {}) => toPayloadObject(workOrder.payload)

const getField = (workOrder = {}, names = []) => {
  const payload = getPayload(workOrder)
  for (const name of names) {
    const value = workOrder[name] ?? payload[name]
    if (value !== undefined && value !== null && String(value).trim() !== '') return value
  }
  return ''
}

const truthyValue = (value) => {
  if (typeof value === 'boolean') return value
  const normalized = normalizeText(value)
  return ['true', '1', 'si', 'yes', 'y', 'incluye', 'included'].includes(normalized)
}

const getMaterialCatalogItem = (name = '', materialCatalog = []) => {
  const normalizedName = normalizeText(name)
  if (!normalizedName) return null

  return (
    materialCatalog.find((item) => normalizeText(item.name) === normalizedName) ||
    materialCatalog.find((item) => {
      const candidate = normalizeText(item.name)
      return candidate && (candidate.includes(normalizedName) || normalizedName.includes(candidate))
    }) ||
    null
  )
}

const getSignalContext = (workOrder = {}) => {
  const payload = getPayload(workOrder)
  const materials = toArray(workOrder.materials).length ? toArray(workOrder.materials) : toArray(payload.materials)
  const rawValues = [
    workOrder.title,
    workOrder.type,
    workOrder.workOrderType,
    workOrder.category,
    workOrder.workCategory,
    workOrder.description,
    workOrder.details,
    workOrder.requirements,
    workOrder.deliverables,
    workOrder.observations,
    workOrder.notes,
    workOrder.targetArea,
    workOrder.assignedArea,
    payload.category,
    payload.workCategory,
    payload.tipoTrabajo,
    payload.type,
    payload.locationType,
    payload.placeType,
    payload.installationPlace,
    payload.lugarInstalacion,
    payload.supportSurface,
    payload.superficie,
    payload.soporte,
    payload.vehicleType,
    payload.vehiculo,
    ...materials.flatMap((item) => [item.name, item.materialName, item.category, item.observations, item.payload?.category]),
  ]

  const text = normalizeText(rawValues.filter(Boolean).join(' '))

  const includesInstallation =
    truthyValue(payload.includesInstallation ?? payload.incluyeInstalacion ?? workOrder.includesInstallation) ||
    text.includes('instalacion') ||
    text.includes('instalar') ||
    text.includes('terreno')

  const includesRemoval =
    truthyValue(payload.includesRemoval ?? payload.incluyeRetiro ?? workOrder.includesRemoval) ||
    text.includes('retiro') ||
    text.includes('desinstalacion') ||
    text.includes('desmontaje')

  const isExterior =
    truthyValue(payload.isExterior ?? workOrder.isExterior) ||
    text.includes('exterior') ||
    text.includes('obra') ||
    text.includes('calle')

  const requiresPower =
    truthyValue(payload.requiresPower ?? workOrder.requiresPower) ||
    text.includes('energia') ||
    text.includes('electrico') ||
    text.includes('calor') ||
    text.includes('iluminacion')

  const highWork =
    truthyValue(payload.highWork ?? workOrder.highWork) ||
    text.includes('altura') ||
    text.includes('escalera') ||
    text.includes('letrero') ||
    text.includes('totem')

  return {
    text,
    includesInstallation,
    includesRemoval,
    isExterior,
    requiresPower,
    highWork,
    materialCount: materials.length,
    hasAssignee: Boolean(getField(workOrder, ['assignedToName', 'assigneeName', 'responsibleName'])),
    hasAddress: Boolean(getField(workOrder, ['installationAddress', 'address', 'direccionInstalacion', 'deliveryAddress'])),
  }
}

const hasAny = (signals, terms = []) => terms.some((term) => signals.text.includes(normalizeText(term)))

const recommendation = (sourceRuleId, item) => {
  const itemType = item.itemType || 'tool'
  const category = item.category || ''
  const name = item.name || item.label || ''

  return {
    id: `${sourceRuleId}:${itemType}:${slugify(category)}:${slugify(name)}`,
    itemType,
    category,
    name,
    label: item.label || name,
    quantity: Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 1,
    unit: item.unit || 'unidad',
    isRequired: Boolean(item.isRequired),
    isRecommended: item.isRecommended !== false,
    reason: item.reason || '',
    sourceRuleId,
    sourceRuleLabel: item.sourceRuleLabel || '',
    status: 'suggested',
  }
}

const createItems = (sourceRuleId, reason, items = []) =>
  items.map((item) =>
    recommendation(sourceRuleId, {
      ...item,
      reason: item.reason || reason,
    }),
  )

const WORK_ORDER_PREPARATION_RULES = [
  {
    id: 'base-taller-instalacion',
    label: 'Base taller / instalacion',
    when: (signals) => signals.includesInstallation || hasAny(signals, ['taller', 'produccion', 'despacho']),
    getRecommendations: () =>
      createItems(
        'base-taller-instalacion',
        'Control requerido para preparar salida de taller sin omitir verificaciones operativas.',
        [
          ...CHECKLIST_GROUPS[0].items.map((name) => ({ itemType: 'checklist', category: CHECKLIST_GROUPS[0].title, name, isRequired: true })),
          ...CHECKLIST_GROUPS[1].items.map((name) => ({ itemType: 'checklist', category: CHECKLIST_GROUPS[1].title, name, isRequired: true })),
          ...EVIDENCE_REQUIREMENTS.slice(0, 2).map((name) => ({ itemType: 'evidence', category: 'Evidencia fotografica', name, isRecommended: true })),
        ],
      ),
  },
  {
    id: 'instalacion-terreno',
    label: 'Instalacion en terreno',
    when: (signals) => signals.includesInstallation,
    getRecommendations: () =>
      createItems(
        'instalacion-terreno',
        'Recomendado porque la OT incluye instalacion en terreno.',
        [
          ...CHECKLIST_GROUPS[2].items.map((name) => ({ itemType: 'checklist', category: CHECKLIST_GROUPS[2].title, name, isRequired: true })),
          ...EVIDENCE_REQUIREMENTS.map((name) => ({ itemType: 'evidence', category: 'Evidencia fotografica', name, isRequired: name.includes('Final') })),
          { itemType: 'safety', category: 'Seguridad', name: 'Conos / senalizacion', isRequired: true },
          { itemType: 'safety', category: 'Seguridad', name: 'Chaleco reflectante', isRequired: true },
          { itemType: 'safety', category: 'Seguridad', name: 'EPP segun terreno', isRequired: true },
          { itemType: 'tool', category: 'Equipos', name: 'Bolso herramientas', isRequired: true },
        ],
      ),
  },
  {
    id: 'adhesivo-vehicular',
    label: 'Adhesivo / grafica vehicular',
    when: (signals) => hasAny(signals, ['adhesivo', 'vinilo', 'vehicular', 'vehiculo', 'wrap', 'auto', 'camioneta']),
    getRecommendations: () =>
      createItems(
        'adhesivo-vehicular',
        'Recomendada porque el trabajo incluye adhesivo o grafica vehicular.',
        [
          { itemType: 'material', category: 'Materiales y graficas', name: 'Adhesivo impreso', unit: 'm2', isRecommended: true },
          { itemType: 'tool', category: 'Limpieza', name: 'Alcohol isopropilico', isRequired: true },
          { itemType: 'tool', category: 'Limpieza', name: 'Panos microfibra', isRequired: true },
          { itemType: 'tool', category: 'Limpieza', name: 'Removedor / desengrasante', isRecommended: true },
          { itemType: 'tool', category: 'Aplicacion', name: 'Paletas / espatulas', isRequired: true },
          { itemType: 'tool', category: 'Aplicacion', name: 'Cutter + repuestos', isRequired: true },
          { itemType: 'tool', category: 'Aplicacion', name: 'Imanes / cinta guia', isRecommended: true },
          { itemType: 'tool', category: 'Aplicacion', name: 'Aguja rompe burbujas', isRecommended: true },
          { itemType: 'tool', category: 'Equipos', name: 'Pistola de calor', isRequired: true },
          { itemType: 'tool', category: 'Equipos', name: 'Alargador electrico', isRecommended: true },
          { itemType: 'safety', category: 'Seguridad', name: 'Guantes', isRequired: true },
          { itemType: 'safety', category: 'Seguridad', name: 'Proteccion piso / vehiculo', isRequired: true },
        ],
      ),
  },
  {
    id: 'letrero-senaletica',
    label: 'Instalacion de letreros',
    when: (signals) => hasAny(signals, ['letrero', 'senal', 'senaletica', 'acrilico', 'sintra', 'totem', 'fijacion']),
    getRecommendations: () =>
      createItems(
        'letrero-senaletica',
        'Recomendada porque el trabajo considera letrero, senaletica o fijacion sobre soporte.',
        [
          { itemType: 'material', category: 'Materiales y graficas', name: 'Acrilico 4 mm', unit: 'plancha', isRecommended: true },
          { itemType: 'material', category: 'Materiales y graficas', name: 'Sintra 3 mm', unit: 'plancha', isRecommended: true },
          { itemType: 'tool', category: 'Equipos', name: 'Taladro', isRequired: true },
          { itemType: 'tool', category: 'Equipos', name: 'Brocas', isRequired: true },
          { itemType: 'tool', category: 'Aplicacion', name: 'Nivel', isRequired: true },
          { itemType: 'tool', category: 'Aplicacion', name: 'Huincha / regla', isRequired: true },
          { itemType: 'tool', category: 'Equipos', name: 'Escalera / banquillo', isRecommended: true },
          { itemType: 'tool', category: 'Equipos', name: 'Extension / zapatilla', isRecommended: true },
          { itemType: 'tool', category: 'Aplicacion', name: 'Elementos de fijacion', isRequired: true },
          { itemType: 'safety', category: 'Seguridad', name: 'Conos / senalizacion', isRequired: true },
          { itemType: 'safety', category: 'Seguridad', name: 'Chaleco reflectante', isRequired: true },
          { itemType: 'safety', category: 'Seguridad', name: 'EPP segun terreno', isRequired: true },
          { itemType: 'tool', category: 'Equipos', name: 'Linterna / foco', isRecommended: true },
        ],
      ),
  },
  {
    id: 'pendon-pvc',
    label: 'Pendones / telas PVC',
    when: (signals) => hasAny(signals, ['pendon', 'lona', 'tela pvc', 'pvc', 'banner']),
    getRecommendations: () =>
      createItems(
        'pendon-pvc',
        'Recomendada porque el trabajo incluye pendones, lonas o tela PVC.',
        [
          { itemType: 'material', category: 'Materiales y graficas', name: 'PVC 13 oz', unit: 'm2', isRecommended: true },
          { itemType: 'tool', category: 'Aplicacion', name: 'Tensores', isRecommended: true },
          { itemType: 'tool', category: 'Aplicacion', name: 'Amarras', isRecommended: true },
          { itemType: 'tool', category: 'Equipos', name: 'Escalera / banquillo', isRecommended: true },
          { itemType: 'tool', category: 'Aplicacion', name: 'Huincha / regla', isRequired: true },
          { itemType: 'tool', category: 'Aplicacion', name: 'Cutter + repuestos', isRequired: true },
          { itemType: 'safety', category: 'Seguridad', name: 'Conos / senalizacion', isRecommended: true },
          { itemType: 'tool', category: 'Aplicacion', name: 'Elementos de fijacion', isRecommended: true },
        ],
      ),
  },
  {
    id: 'evento-activacion',
    label: 'Evento / activacion',
    when: (signals) => hasAny(signals, ['evento', 'activacion', 'stand', 'feria', 'backing', 'modular']),
    getRecommendations: () =>
      createItems(
        'evento-activacion',
        'Recomendada porque el trabajo corresponde a evento, activacion o montaje temporal.',
        [
          { itemType: 'material', category: 'Materiales y graficas', name: 'Materiales graficos', isRequired: true },
          { itemType: 'material', category: 'Materiales y graficas', name: 'Estructuras', isRecommended: true },
          { itemType: 'tool', category: 'Aplicacion', name: 'Herramientas de armado', isRequired: true },
          { itemType: 'tool', category: 'Aplicacion', name: 'Masking tape', isRecommended: true },
          { itemType: 'tool', category: 'Equipos', name: 'Alargador electrico', isRecommended: true },
          { itemType: 'tool', category: 'Equipos', name: 'Extension / zapatilla', isRecommended: true },
          { itemType: 'tool', category: 'Equipos', name: 'Linterna / foco', isRecommended: true },
          { itemType: 'safety', category: 'Seguridad', name: 'Conos / senalizacion', isRecommended: true },
          { itemType: 'tool', category: 'Aplicacion', name: 'Elementos de respaldo', isRecommended: true },
          { itemType: 'tool', category: 'Aplicacion', name: 'Kit de reparacion rapida', isRecommended: true },
        ],
      ),
  },
  {
    id: 'retiro-grafica',
    label: 'Retiro de grafica',
    when: (signals) => signals.includesRemoval || hasAny(signals, ['retiro de grafica', 'desinstalacion', 'desmontaje']),
    getRecommendations: () =>
      createItems(
        'retiro-grafica',
        'Recomendada porque el trabajo incluye retiro o desmontaje de grafica.',
        [
          { itemType: 'tool', category: 'Equipos', name: 'Pistola de calor', isRequired: true },
          { itemType: 'tool', category: 'Limpieza', name: 'Removedor / desengrasante', isRequired: true },
          { itemType: 'tool', category: 'Aplicacion', name: 'Cutter + repuestos', isRequired: true },
          { itemType: 'tool', category: 'Aplicacion', name: 'Paletas / espatulas', isRequired: true },
          { itemType: 'tool', category: 'Limpieza', name: 'Panos microfibra', isRecommended: true },
          { itemType: 'tool', category: 'Limpieza', name: 'Alcohol isopropilico', isRecommended: true },
          { itemType: 'safety', category: 'Seguridad', name: 'Bolsa residuos', isRequired: true },
          { itemType: 'safety', category: 'Seguridad', name: 'Guantes', isRequired: true },
        ],
      ),
  },
]

const getItemPayload = (item = {}) => toPayloadObject(item.payload)

const inferChecklistItemType = (item = {}) => {
  const payload = getItemPayload(item)
  if (payload.itemType) return payload.itemType

  const category = normalizeText(item.category || payload.category)
  if (['limpieza', 'aplicacion', 'equipos'].some((value) => category.includes(value))) return 'tool'
  if (category.includes('seguridad')) return 'safety'
  if (category.includes('evidencia') || category.includes('foto')) return 'evidence'
  return 'checklist'
}

const getStatusFromItem = (item = {}) => {
  const payload = getItemPayload(item)
  const status = normalizeText(item.status || payload.status)
  if (status) return status
  if (item.loadedInVehicle || payload.loadedInVehicle || payload.loaded) return 'loaded'
  if (item.confirmedForLoading || payload.confirmedForLoading || payload.confirmed || item.isChecked) return 'confirmed'
  if (payload.available || payload.availability === 'available') return 'available'
  if (payload.missing || payload.availability === 'missing') return 'missing'
  return 'pending'
}

const isCompletionStatus = (status) => ['confirmed', 'loaded', 'used', 'returned', 'not_applicable'].includes(status)

const isLoadedStatus = (status) => ['loaded', 'used', 'returned'].includes(status)

const toExistingPreparationItems = (workOrder = {}) => {
  const materials = toArray(workOrder.materials)
  const checklistItems = toArray(workOrder.checklistItems)
  const evidence = toArray(workOrder.evidence).length ? toArray(workOrder.evidence) : toArray(workOrder.photographicEvidence)
  const signatures = toArray(workOrder.signatures)

  return [
    ...materials.map((item) => {
      const payload = getItemPayload(item)
      const status = getStatusFromItem(item)
      return {
        id: item.id,
        itemType: 'material',
        category: payload.category || item.category || 'Materiales y graficas',
        name: item.name || item.materialName || '',
        label: item.name || item.materialName || '',
        quantity: Number(item.quantity || payload.quantity || 0),
        unit: item.unit || payload.unit || '',
        status,
        isRequired: Boolean(item.isRequired ?? payload.isRequired ?? payload.required),
        isRecommended: Boolean(item.isRecommended ?? payload.isRecommended ?? payload.recommended),
        confirmed: isCompletionStatus(status),
        loaded: Boolean(item.loadedInVehicle || payload.loadedInVehicle || isLoadedStatus(status)),
        observations: item.observations || payload.observations || '',
        recommendationId: payload.recommendationId || item.recommendationId || '',
        sourceRuleId: payload.sourceRuleId || item.sourceRuleId || '',
        origin: payload.origin || item.origin || 'manual',
      }
    }),
    ...checklistItems.map((item) => {
      const payload = getItemPayload(item)
      const status = getStatusFromItem(item)
      const itemType = inferChecklistItemType(item)
      return {
        id: item.id,
        itemType,
        category: payload.category || item.category || 'Checklist',
        name: item.label || item.name || '',
        label: item.label || item.name || '',
        quantity: Number(payload.quantity || item.quantity || 1),
        unit: payload.unit || item.unit || 'unidad',
        status,
        isRequired: Boolean(item.isRequired ?? payload.isRequired ?? payload.required),
        isRecommended: Boolean(item.isRecommended ?? payload.isRecommended ?? payload.recommended),
        confirmed: Boolean(item.isChecked || isCompletionStatus(status)),
        loaded: Boolean(item.loadedInVehicle || payload.loadedInVehicle || isLoadedStatus(status)),
        observations: item.observations || payload.observations || '',
        recommendationId: payload.recommendationId || item.recommendationId || '',
        sourceRuleId: payload.sourceRuleId || item.sourceRuleId || '',
        origin: payload.origin || item.origin || 'manual',
        checkedAt: item.checkedAt || payload.checkedAt || '',
        checkedByName: item.checkedByName || payload.checkedByName || '',
        checkedByEmail: item.checkedByEmail || payload.checkedByEmail || '',
      }
    }),
    ...evidence.map((item) => {
      const payload = getItemPayload(item)
      const status = item.fileUrl || item.url ? 'confirmed' : getStatusFromItem(item)
      return {
        id: item.id,
        itemType: 'evidence',
        category: payload.category || item.category || 'Evidencia fotografica',
        name: item.description || payload.evidenceType || item.fileName || 'Fotografia',
        label: item.description || payload.evidenceType || item.fileName || 'Fotografia',
        status,
        isRequired: Boolean(item.isRequired ?? payload.isRequired ?? payload.required),
        isRecommended: Boolean(item.isRecommended ?? payload.isRecommended ?? payload.recommended),
        confirmed: isCompletionStatus(status),
        loaded: false,
        origin: payload.origin || 'manual',
      }
    }),
    ...signatures.map((item) => {
      const payload = getItemPayload(item)
      const status = item.signatureUrl || item.dataUrl || item.signedAt ? 'confirmed' : getStatusFromItem(item)
      return {
        id: item.id,
        itemType: 'signature',
        category: payload.category || item.role || 'Firmas',
        name: item.signerName || item.role || 'Firma',
        label: item.signerName || item.role || 'Firma',
        status,
        isRequired: Boolean(item.isRequired ?? payload.isRequired ?? payload.required),
        isRecommended: Boolean(item.isRecommended ?? payload.isRecommended ?? payload.recommended),
        confirmed: isCompletionStatus(status),
        loaded: false,
        origin: payload.origin || 'manual',
      }
    }),
  ]
}

const getItemKey = (item = {}) => `${item.itemType || 'item'}:${slugify(item.category || '')}:${slugify(item.name || item.label || '')}`

const getPreparationDecisions = (workOrder = {}) => {
  const payload = getPayload(workOrder)
  return toPayloadObject(workOrder.preparationDecisions || payload.preparationDecisions)
}

const annotateRecommendations = (workOrder = {}, recommendations = [], materialCatalog = []) => {
  const existingItems = toExistingPreparationItems(workOrder)
  const existingKeys = new Set(existingItems.map(getItemKey))
  const existingRecommendationIds = new Set(existingItems.map((item) => item.recommendationId).filter(Boolean))
  const decisions = getPreparationDecisions(workOrder)
  const discarded = new Set(toArray(decisions.discardedRecommendationIds))

  const deduped = []
  const seen = new Set()

  recommendations.forEach((item) => {
    const catalogMatch = item.itemType === 'material' ? getMaterialCatalogItem(item.name, materialCatalog) : null
    const enriched = catalogMatch
      ? {
          ...item,
          materialId: catalogMatch.id || '',
          sku: catalogMatch.sku || '',
          unit: item.unit || catalogMatch.unit || '',
          unitCost: Number(catalogMatch.unitCost ?? catalogMatch.baseCost ?? 0),
          catalogMatch: {
            id: catalogMatch.id,
            name: catalogMatch.name,
            sku: catalogMatch.sku || '',
            unit: catalogMatch.unit || '',
            category: catalogMatch.category || '',
          },
        }
      : item
    const key = getItemKey(enriched)
    if (seen.has(key)) return
    seen.add(key)

    const alreadyPresent = existingKeys.has(key) || existingRecommendationIds.has(enriched.id)
    const status = alreadyPresent ? 'already_present' : discarded.has(enriched.id) ? 'discarded' : 'suggested'
    deduped.push({
      ...enriched,
      status,
      alreadyPresent,
      discarded: status === 'discarded',
    })
  })

  return deduped
}

const getMatchedRecommendations = (workOrder = {}, materialCatalog = []) => {
  const signals = getSignalContext(workOrder)
  const matchedRules = WORK_ORDER_PREPARATION_RULES.filter((rule) => rule.when(signals))
  const recommendations = matchedRules.flatMap((rule) =>
    rule.getRecommendations(signals).map((item) => ({
      ...item,
      sourceRuleLabel: rule.label,
    })),
  )

  return {
    signals,
    matchedRules: matchedRules.map(({ id, label }) => ({ id, label })),
    recommendations: annotateRecommendations(workOrder, recommendations, materialCatalog),
  }
}

const groupByItemType = (items = []) =>
  items.reduce((summary, item) => {
    const key = item.itemType || 'item'
    summary[key] = summary[key] || []
    summary[key].push(item)
    return summary
  }, {})

const buildPreparationSummary = (workOrder = {}, recommendations = []) => {
  const existingItems = toExistingPreparationItems(workOrder)
  const activeRecommendations = recommendations
    .filter((item) => item.status === 'suggested')
    .map((item) => ({
      ...item,
      confirmed: false,
      loaded: false,
      origin: 'recommendation',
    }))

  const allItems = [...existingItems, ...activeRecommendations]
  const mandatory = allItems.filter((item) => item.isRequired)
  const recommended = allItems.filter((item) => !item.isRequired && item.isRecommended)
  const confirmedAndLoaded = existingItems.filter((item) => item.confirmed || item.loaded)
  const pending = mandatory.filter((item) => !item.confirmed && !item.loaded && item.status !== 'not_applicable')
  const loaded = existingItems.filter((item) => item.loaded)
  const missing = allItems.filter((item) => item.status === 'missing')
  const totalRequired = mandatory.length
  const requiredDone = mandatory.filter((item) => item.confirmed || item.loaded || item.status === 'not_applicable').length
  const preparationPercent = totalRequired ? Math.round((requiredDone / totalRequired) * 100) : 100
  const signals = getSignalContext(workOrder)
  const warnings = []

  if (pending.length) warnings.push('Faltan elementos obligatorios para preparar la salida.')
  if (signals.includesInstallation && !signals.hasAssignee) warnings.push('No se ha asignado instalador o responsable.')
  if (signals.includesInstallation && !signals.hasAddress) warnings.push('No se ha confirmado direccion de instalacion o retiro.')
  if (mandatory.some((item) => item.itemType === 'safety') && pending.some((item) => item.itemType === 'safety')) {
    warnings.push('Falta confirmar o cargar equipo de seguridad.')
  }
  if (signals.includesInstallation && pending.some((item) => item.itemType === 'evidence' && normalizeText(item.name).includes('final'))) {
    warnings.push('Falta evidencia fotografica final o su confirmacion.')
  }
  if (missing.length) warnings.push('Hay elementos marcados como faltantes.')

  return {
    title: 'Resumen de preparacion y salida',
    groups: {
      mandatory: {
        title: 'Obligatorio para el trabajo',
        items: mandatory,
        byType: groupByItemType(mandatory),
      },
      recommended: {
        title: 'Recomendado llevar',
        items: recommended,
        byType: groupByItemType(recommended),
      },
      confirmedAndLoaded: {
        title: 'Confirmado y cargado',
        items: confirmedAndLoaded,
        byType: groupByItemType(confirmedAndLoaded),
      },
      pending: {
        title: 'Pendiente o no disponible',
        items: pending,
        byType: groupByItemType(pending),
      },
    },
    counts: {
      total: allItems.length,
      required: totalRequired,
      recommended: recommended.length,
      confirmed: existingItems.filter((item) => item.confirmed).length,
      loaded: loaded.length,
      pending: pending.length,
      missing: missing.length,
      recommendations: activeRecommendations.length,
    },
    preparationPercent,
    canMarkReadyForDeparture: pending.length === 0 && missing.length === 0,
    requiresAuthorizedException: pending.length > 0 || missing.length > 0,
    warnings: uniq(warnings),
  }
}

const buildPreparationCatalog = (materialCatalog = []) => ({
  visualTokens: VISUAL_TOKENS,
  sections: WORK_ORDER_SECTIONS,
  statuses: PREPARATION_STATUSES,
  toolCategories: TOOL_CATEGORIES,
  checklistGroups: CHECKLIST_GROUPS,
  fieldDeliveryOptions: FIELD_DELIVERY_OPTIONS,
  evidenceRequirements: EVIDENCE_REQUIREMENTS,
  materialCatalog: materialCatalog.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category || '',
    unit: item.unit || '',
    sku: item.sku || '',
    currentStock: Number(item.currentStock || 0),
    status: item.status || '',
  })),
})

const buildWorkOrderPreparation = (workOrder = {}, { materialCatalog = [] } = {}) => {
  const { signals, matchedRules, recommendations } = getMatchedRecommendations(workOrder, materialCatalog)
  const summary = buildPreparationSummary(workOrder, recommendations)

  return {
    generatedAt: new Date().toISOString(),
    signals,
    matchedRules,
    recommendations,
    actionableRecommendations: recommendations.filter((item) => item.status === 'suggested'),
    summary,
    catalog: buildPreparationCatalog(materialCatalog),
  }
}

const buildRecommendationPayload = (recommendationItem = {}, user = {}) => ({
  itemType: recommendationItem.itemType,
  category: recommendationItem.category || '',
  status: 'pending',
  availability: 'pending',
  isRequired: Boolean(recommendationItem.isRequired),
  isRecommended: recommendationItem.isRecommended !== false,
  origin: 'recommendation',
  sourceRuleId: recommendationItem.sourceRuleId || '',
  sourceRuleLabel: recommendationItem.sourceRuleLabel || '',
  recommendationId: recommendationItem.id || '',
  recommendationReason: recommendationItem.reason || '',
  quantity: Number.isFinite(Number(recommendationItem.quantity)) ? Number(recommendationItem.quantity) : 1,
  unit: recommendationItem.unit || 'unidad',
  responsibleName: '',
  confirmedForLoading: false,
  loadedInVehicle: false,
  acceptedByName: user.name || '',
  acceptedByEmail: user.email || '',
  acceptedAt: new Date().toISOString(),
})

const createMaterialFromRecommendation = (recommendationItem = {}, user = {}, index = 0) => {
  const payload = buildRecommendationPayload(recommendationItem, user)
  const quantity = Number.isFinite(Number(recommendationItem.quantity)) ? Number(recommendationItem.quantity) : 1
  const unitCost = Number(recommendationItem.unitCost || 0)

  return {
    id: `prep-mat-${Date.now()}-${index + 1}`,
    materialId: recommendationItem.materialId || recommendationItem.catalogMatch?.id || '',
    name: recommendationItem.name || recommendationItem.label || `Material ${index + 1}`,
    sku: recommendationItem.sku || recommendationItem.catalogMatch?.sku || '',
    unit: recommendationItem.unit || recommendationItem.catalogMatch?.unit || '',
    quantity,
    unitCost,
    totalCost: quantity * unitCost,
    observations: recommendationItem.reason || '',
    status: 'pending',
    availability: 'pending',
    isRequired: payload.isRequired,
    isRecommended: payload.isRecommended,
    confirmedForLoading: false,
    loadedInVehicle: false,
    payload,
  }
}

const createChecklistFromRecommendation = (recommendationItem = {}, user = {}, index = 0) => {
  const payload = buildRecommendationPayload(recommendationItem, user)

  return {
    id: `prep-check-${Date.now()}-${index + 1}`,
    label: recommendationItem.label || recommendationItem.name || `Checklist ${index + 1}`,
    category: recommendationItem.category || 'Checklist',
    sortOrder: Number.isFinite(Number(recommendationItem.sortOrder)) ? Number(recommendationItem.sortOrder) : index,
    isChecked: false,
    observations: recommendationItem.reason || '',
    itemType: recommendationItem.itemType || 'checklist',
    status: 'pending',
    isRequired: payload.isRequired,
    isRecommended: payload.isRecommended,
    confirmedForLoading: false,
    loadedInVehicle: false,
    payload,
  }
}

module.exports = {
  CHECKLIST_GROUPS,
  EVIDENCE_REQUIREMENTS,
  FIELD_DELIVERY_OPTIONS,
  PREPARATION_STATUSES,
  TOOL_CATEGORIES,
  VISUAL_TOKENS,
  WORK_ORDER_PREPARATION_RULES,
  WORK_ORDER_SECTIONS,
  buildPreparationCatalog,
  buildPreparationSummary,
  buildWorkOrderPreparation,
  createChecklistFromRecommendation,
  createMaterialFromRecommendation,
  getPreparationDecisions,
  normalizeText,
  toExistingPreparationItems,
}
