const { randomUUID } = require('node:crypto')
const dataAdapter = require('./dataAdapter')
const { getPrisma } = require('./prismaClient')
const { getPaymentProvider } = require('./paymentProviders')
const { calculateFinanceMovement, getNumberValue } = require('../utils/financeCalculations')

const TEST_PAYMENT_PREFIX = '[TEST PAGO]'
const DEFAULT_CURRENCY = 'CLP'
const SETTLED_PAYMENT_STATUSES = new Set(['approved', 'reconciled'])
const CLOSED_PAYMENT_STATUSES = new Set(['approved', 'rejected', 'failed', 'canceled', 'reconciled'])

const createId = (prefix) => `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`

const createError = (message, statusCode = 400) => {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const asArray = (value) => (Array.isArray(value) ? value : [])

const toDate = (value) => {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const parsedDate = new Date(value)
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

const toIso = (value) => {
  const date = toDate(value)
  return date ? date.toISOString() : ''
}

const toDateOnly = (value) => {
  const iso = toIso(value)
  return iso ? iso.slice(0, 10) : ''
}

const toNumber = (value) => {
  const number = Number(value || 0)
  return Number.isFinite(number) ? number : 0
}

const getPaymentsMode = () =>
  String(process.env.PAYMENTS_MODE || 'sandbox').trim().toLowerCase()

const getConfiguredProviderName = () =>
  String(process.env.PAYMENT_PROVIDER || (getPaymentsMode() === 'sandbox' ? 'sandbox' : 'manual'))
    .trim()
    .toLowerCase()

const getPublicApiUrl = () =>
  String(process.env.PUBLIC_API_URL || 'https://api.rubikcreaciones.com/api').replace(/\/+$/, '')

const getPublicErpUrl = () =>
  String(process.env.PUBLIC_ERP_URL || 'https://erp.rubikcreaciones.com').replace(/\/+$/, '')

const buildTransbankReturnUrl = () => `${getPublicApiUrl()}/finance/payments/transbank/return`

const buildFrontendPaymentUrl = (paymentStatus, paymentId) =>
  `${getPublicErpUrl()}/#/erp/finanzas?paymentStatus=${encodeURIComponent(paymentStatus || '')}&paymentId=${encodeURIComponent(paymentId || '')}`

const assertPaymentsEnabled = () => {
  const mode = getPaymentsMode()

  if (mode === 'production') {
    const realPaymentsEnabled = String(process.env.ENABLE_REAL_PAYMENTS || '').toLowerCase() === 'true'
    if (!realPaymentsEnabled) {
      throw createError('Pagos reales de proveedor aun no implementados', 501)
    }
  }

  if (mode === 'disabled') {
    throw createError('Pagos deshabilitados por configuracion.', 403)
  }

  return mode
}

const assertSandboxEnabled = () => {
  const mode = assertPaymentsEnabled()

  if (mode !== 'sandbox') {
    throw createError('El modo sandbox de pagos no esta habilitado.', 403)
  }

  return mode
}

const isPrismaMode = () => dataAdapter.getAdapterStatus().mode === 'prisma'

const normalizePaymentStatus = (status = '') => {
  const normalizedStatus = String(status || '').trim().toLowerCase()
  if (normalizedStatus === 'cancelled') return 'canceled'
  return normalizedStatus || 'pending'
}

const getMovementPaymentState = (movement = {}) => {
  if (movement.status === 'Pagado') return 'paid'
  if (movement.status === 'Pago parcial') return 'partial'
  if (movement.status === 'Anulado') return 'canceled'
  if (movement.status === 'Vencido') return 'overdue'
  return 'pending'
}

const serializeMovement = (record = {}) => {
  const movement = calculateFinanceMovement({
    ...record,
    netAmount: toNumber(record.netAmount),
    taxRate: toNumber(record.taxRate),
    taxAmount: toNumber(record.taxAmount),
    totalAmount: toNumber(record.totalAmount),
    paidAmount: toNumber(record.paidAmount),
    pendingAmount: toNumber(record.pendingAmount),
    issueDate: toDateOnly(record.issueDate) || record.issueDate,
    dueDate: toDateOnly(record.dueDate) || record.dueDate,
    paymentDate: toDateOnly(record.paymentDate) || record.paymentDate,
    createdAt: toIso(record.createdAt) || record.createdAt,
    updatedAt: toIso(record.updatedAt) || record.updatedAt,
  })
  const payload = isPlainObject(record.payload) ? record.payload : {}

  return {
    ...movement,
    balanceAmount: movement.pendingAmount,
    clientSupplierName: movement.client || movement.company || movement.supplierName || '',
    ivaAmount: movement.taxAmount,
    paymentState: payload.paymentState || getMovementPaymentState(movement),
  }
}

const serializePayment = (record = {}) => {
  const payload = isPlainObject(record.payload) ? record.payload : {}
  const status = normalizePaymentStatus(payload.status || record.status || 'pending')
  const provider = String(payload.provider || payload.paymentProvider || 'manual').toLowerCase()
  const paymentDate = toDateOnly(record.paymentDate || payload.paymentDate)

  return {
    id: record.id,
    financialMovementId: record.financialMovementId || record.movementId || '',
    movementId: record.financialMovementId || record.movementId || '',
    amount: toNumber(record.amount),
    currency: payload.currency || DEFAULT_CURRENCY,
    method: payload.method || payload.paymentMethod || record.paymentMethod || '',
    paymentMethod: record.paymentMethod || payload.method || payload.paymentMethod || '',
    provider,
    status,
    paymentStatus: status,
    providerPaymentId: payload.providerPaymentId || record.reference || '',
    providerStatus: payload.providerStatus || status,
    reference: record.reference || payload.providerPaymentId || '',
    paymentDate,
    transactionDate: payload.transactionDate || toIso(record.paymentDate),
    responsibleName: record.responsibleName || payload.responsibleName || '',
    responsibleEmail: record.responsibleEmail || payload.responsibleEmail || '',
    observations: record.observations || payload.observations || '',
    notes: record.observations || payload.observations || '',
    metadata: payload.metadata || {},
    rawResponse: payload.rawResponse || null,
    auditLog: asArray(record.auditLog),
    payload,
    createdAt: toIso(record.createdAt) || record.createdAt,
    updatedAt: toIso(record.updatedAt) || record.updatedAt,
    movement: record.financialMovement ? serializeMovement(record.financialMovement) : undefined,
  }
}

const findMovementRecord = async (movementId) => {
  if (!movementId) throw createError('movementId es requerido.', 400)

  if (!isPrismaMode()) {
    return dataAdapter.findById('financeMovements', movementId)
  }

  const movement = await getPrisma().financialMovement.findUnique({ where: { id: movementId } })
  if (!movement) throw createError('Movimiento financiero no encontrado.', 404)
  return movement
}

const findPaymentRecord = async (paymentId, { includeMovement = false } = {}) => {
  if (!paymentId) throw createError('paymentId es requerido.', 400)

  if (!isPrismaMode()) {
    return dataAdapter.findById('payments', paymentId)
  }

  const payment = await getPrisma().payment.findUnique({
    where: { id: paymentId },
    include: includeMovement ? { financialMovement: true } : undefined,
  })
  if (!payment) throw createError('Pago no encontrado.', 404)
  return payment
}

const createPaymentAuditLog = async (
  paymentId,
  action,
  previousStatus,
  newStatus,
  user = {},
  metadata = {},
) => {
  const audit = {
    id: createId('audit'),
    module: 'payments',
    recordId: paymentId,
    action,
    previousStatus: previousStatus || null,
    newStatus: newStatus || null,
    userId: user?.id || null,
    userEmail: user?.email || '',
    details: {
      paymentId,
      previousStatus: previousStatus || null,
      newStatus: newStatus || null,
      paymentsMode: getPaymentsMode(),
      provider: metadata.provider || metadata.paymentProvider || '',
      sandbox: Boolean(metadata.sandbox),
      ...metadata,
    },
    createdAt: new Date().toISOString(),
  }

  if (!isPrismaMode()) {
    dataAdapter.create('auditLogs', 'audit', audit)
    try {
      const payment = dataAdapter.findById('payments', paymentId)
      dataAdapter.update('payments', paymentId, {
        auditLog: [audit, ...asArray(payment.auditLog)],
      })
    } catch (_error) {
      // Audit log still exists even if the legacy payment record cannot be patched.
    }
    return audit
  }

  const prisma = getPrisma()
  await prisma.auditLog.create({
    data: {
      id: audit.id,
      module: audit.module,
      recordId: audit.recordId,
      action: audit.action,
      userId: audit.userId,
      userEmail: audit.userEmail,
      details: audit.details,
      createdAt: new Date(audit.createdAt),
    },
  })

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
  if (payment) {
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        auditLog: [audit, ...asArray(payment.auditLog)],
      },
    })
  }

  return audit
}

const getPaymentAudit = async (paymentId) => {
  if (!isPrismaMode()) {
    const audits = dataAdapter
      .list('auditLogs')
      .filter((audit) => audit.module === 'payments' && audit.recordId === paymentId)
    return { items: audits }
  }

  const audits = await getPrisma().auditLog.findMany({
    where: { module: 'payments', recordId: paymentId },
    orderBy: { createdAt: 'desc' },
  })

  return {
    items: audits.map((audit) => ({
      ...audit,
      createdAt: toIso(audit.createdAt),
    })),
  }
}

const recalculateMovementPaymentStatus = async (movementId) => {
  const paymentRecords = isPrismaMode()
    ? await getPrisma().payment.findMany({ where: { financialMovementId: movementId } })
    : dataAdapter.list('payments').filter((payment) => payment.financialMovementId === movementId)
  const serializedPayments = paymentRecords.map(serializePayment)

  const paidAmount = serializedPayments
    .filter((payment) => SETTLED_PAYMENT_STATUSES.has(payment.status))
    .reduce((total, payment) => total + payment.amount, 0)

  const movementRecord = await findMovementRecord(movementId)
  const currentMovement = serializeMovement(movementRecord)
  const latestSettledPayment = serializedPayments
    .filter((payment) => SETTLED_PAYMENT_STATUSES.has(payment.status))
    .sort((first, second) => String(second.transactionDate || '').localeCompare(String(first.transactionDate || '')))[0]
  const hasPendingPayment = serializedPayments.some((payment) => payment.status === 'pending')
  const hasFailedPayment = serializedPayments.some((payment) => ['failed', 'rejected'].includes(payment.status))
  const paymentState =
    paidAmount >= currentMovement.totalAmount
      ? 'paid'
      : paidAmount > 0
        ? 'partial'
        : hasPendingPayment
          ? 'pending'
          : hasFailedPayment
            ? 'failed'
            : 'pending'

  const nextMovement = serializeMovement({
    ...currentMovement,
    paidAmount,
    paymentDate: latestSettledPayment?.paymentDate || currentMovement.paymentDate || null,
    paymentMethod: latestSettledPayment?.paymentMethod || currentMovement.paymentMethod || '',
    payload: {
      ...(isPlainObject(movementRecord.payload) ? movementRecord.payload : {}),
      paymentState,
      updatedByPaymentService: true,
      updatedAt: new Date().toISOString(),
    },
  })

  if (!isPrismaMode()) {
    return dataAdapter.update('financeMovements', movementId, nextMovement)
  }

  const updated = await getPrisma().financialMovement.update({
    where: { id: movementId },
    data: {
      paidAmount: nextMovement.paidAmount,
      pendingAmount: nextMovement.pendingAmount,
      paymentDate: toDate(nextMovement.paymentDate),
      paymentMethod: nextMovement.paymentMethod || '',
      status: nextMovement.status,
      auditLog: nextMovement.auditLog || [],
      payload: {
        ...(isPlainObject(movementRecord.payload) ? movementRecord.payload : {}),
        paymentState,
        updatedByPaymentService: true,
        updatedAt: new Date().toISOString(),
      },
    },
  })

  return serializeMovement(updated)
}

const createFinanceMovementForPaymentDemo = async (user = {}) => {
  assertSandboxEnabled()

  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const id = createId('fin-test-pago')
  const movementPayload = {
    id,
    type: 'Ingreso',
    category: 'Venta',
    documentType: 'Comprobante sandbox',
    documentNumber: `${TEST_PAYMENT_PREFIX} DEMO-${Date.now()}`,
    client: 'Rubik Demo',
    company: 'Rubik Creaciones',
    description: `${TEST_PAYMENT_PREFIX} Pago sandbox demo Rubik`,
    netAmount: 1000,
    taxRate: 0,
    taxAmount: 0,
    isTaxExempt: true,
    totalAmount: 1000,
    paidAmount: 0,
    pendingAmount: 1000,
    issueDate: today,
    dueDate: today,
    status: 'Sin pagar',
    paymentMethod: 'Sandbox',
    responsibleName: user?.name || '',
    responsibleEmail: user?.email || '',
    observations: `${TEST_PAYMENT_PREFIX} Registro demo sandbox sin movimiento real de dinero.`,
    sourceType: 'sandbox-payment-demo',
    auditLog: [
      {
        action: 'Movimiento demo sandbox creado',
        userName: user?.name || '',
        userEmail: user?.email || '',
        createdAt: now.toISOString(),
      },
    ],
    payload: {
      testPrefix: TEST_PAYMENT_PREFIX,
      sandbox: true,
      paymentsMode: getPaymentsMode(),
      provider: 'sandbox',
      paymentState: 'pending',
    },
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }

  const movement = await dataAdapter.create('financeMovements', 'fin', movementPayload)
  return serializeMovement(movement)
}

const createPayment = async (payload = {}, user = {}) => {
  assertPaymentsEnabled()

  const movementId = payload.financialMovementId || payload.movementId
  const movementRecord = await findMovementRecord(movementId)
  const movement = serializeMovement(movementRecord)
  const amount = getNumberValue(payload.amount ?? payload.paidAmount ?? movement.pendingAmount)
  const provider = String(payload.provider || payload.paymentProvider || getConfiguredProviderName()).toLowerCase()
  const status = normalizePaymentStatus(payload.status || 'pending')
  const method = payload.method || payload.paymentMethod || provider
  const isSandboxPayment =
    provider === 'sandbox' ||
    (provider === 'transbank' && String(process.env.TRANSBANK_ENV || 'integration').toLowerCase() !== 'production')

  if (amount <= 0) throw createError('El pago debe ser mayor a 0.', 400)
  if (amount > movement.pendingAmount) {
    throw createError('El pago no puede superar el saldo pendiente.', 400)
  }

  const now = new Date()
  const paymentPayload = {
    ...(isPlainObject(payload.payload) ? payload.payload : {}),
    currency: payload.currency || DEFAULT_CURRENCY,
    method,
    provider,
    status,
    providerStatus: payload.providerStatus || status,
    sandbox: isSandboxPayment,
    paymentsMode: getPaymentsMode(),
    metadata: {
      ...(isPlainObject(payload.metadata) ? payload.metadata : {}),
      source: payload.source || '',
      testPrefix: isSandboxPayment ? TEST_PAYMENT_PREFIX : undefined,
    },
    createdById: user?.id || '',
    createdByEmail: user?.email || '',
    createdAt: now.toISOString(),
  }

  const paymentRecord = {
    id: payload.id || createId('pay'),
    financialMovementId: movement.id,
    amount,
    paymentDate: payload.paymentDate || now.toISOString(),
    paymentMethod: method,
    reference: payload.reference || payload.providerPaymentId || '',
    responsibleName: user?.name || payload.responsibleName || '',
    responsibleEmail: user?.email || payload.responsibleEmail || '',
    observations: payload.observations || payload.notes || '',
    auditLog: [],
    payload: paymentPayload,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }

  const createdPayment = isPrismaMode()
    ? await getPrisma().payment.create({
        data: {
          ...paymentRecord,
          paymentDate: toDate(paymentRecord.paymentDate) || now,
          createdAt: now,
          updatedAt: now,
        },
        include: { financialMovement: true },
      })
    : dataAdapter.create('payments', 'pay', paymentRecord)

  const audit = await createPaymentAuditLog(
    createdPayment.id,
    'created',
    null,
    status,
    user,
    { provider, sandbox: isSandboxPayment },
  )
  const payment = await getPaymentById(createdPayment.id)

  return { payment, audit }
}

const updatePaymentStatus = async (paymentId, nextStatus, user = {}, metadata = {}) => {
  assertPaymentsEnabled()

  const paymentRecord = await findPaymentRecord(paymentId)
  const payment = serializePayment(paymentRecord)
  const previousStatus = payment.status
  const normalizedStatus = normalizePaymentStatus(nextStatus)
  const payload = {
    ...payment.payload,
    ...metadata.payload,
    status: normalizedStatus,
    providerStatus: metadata.providerStatus || normalizedStatus,
    providerPaymentId: metadata.providerPaymentId || payment.providerPaymentId || payment.reference || '',
    transactionDate: metadata.transactionDate || payment.transactionDate || new Date().toISOString(),
    rawResponse: metadata.rawResponse || payment.rawResponse || null,
    updatedById: user?.id || '',
    updatedByEmail: user?.email || '',
    updatedAt: new Date().toISOString(),
  }

  const nextPaymentRecord = {
    paymentDate: SETTLED_PAYMENT_STATUSES.has(normalizedStatus)
      ? toDate(metadata.transactionDate || payment.transactionDate || new Date())
      : toDate(payment.paymentDate || new Date()),
    reference: payload.providerPaymentId || payment.reference || '',
    payload,
  }

  const updatedPayment = isPrismaMode()
    ? await getPrisma().payment.update({
        where: { id: paymentId },
        data: nextPaymentRecord,
        include: { financialMovement: true },
      })
    : dataAdapter.update('payments', paymentId, {
        ...nextPaymentRecord,
        paymentDate: toIso(nextPaymentRecord.paymentDate),
        updatedAt: new Date().toISOString(),
      })

  const audit = await createPaymentAuditLog(paymentId, metadata.action || normalizedStatus, previousStatus, normalizedStatus, user, {
    provider: payment.provider,
    sandbox: payment.provider === 'sandbox',
    ...metadata,
  })
  const movement = await recalculateMovementPaymentStatus(payment.movementId)

  return {
    payment: serializePayment(updatedPayment),
    movement,
    audit,
  }
}

const startSandboxPayment = async (paymentId, user = {}) => {
  assertSandboxEnabled()

  const payment = serializePayment(await findPaymentRecord(paymentId))
  if (CLOSED_PAYMENT_STATUSES.has(payment.status)) {
    throw createError(`El pago ya esta en estado ${payment.status}.`, 409)
  }

  const provider = getPaymentProvider('sandbox')
  const providerResult = await provider.startPayment({ payment, user })

  return updatePaymentStatus(paymentId, providerResult.status, user, {
    action: 'sandbox_started',
    provider: 'sandbox',
    sandbox: true,
    providerStatus: providerResult.providerStatus,
    providerPaymentId: providerResult.providerPaymentId,
    transactionDate: providerResult.transactionDate,
    rawResponse: providerResult.rawResponse,
    payload: {
      provider: 'sandbox',
      providerStatus: providerResult.providerStatus,
      providerPaymentId: providerResult.providerPaymentId,
      rawResponse: providerResult.rawResponse,
    },
    providerResult,
  })
}

const approvePayment = (paymentId, user = {}) =>
  updatePaymentStatus(paymentId, 'approved', user, { action: 'approved' })

const rejectPayment = (paymentId, user = {}, reason = '') =>
  updatePaymentStatus(paymentId, 'rejected', user, {
    action: 'rejected',
    payload: { rejectionReason: reason || '' },
  })

const cancelPayment = (paymentId, user = {}, reason = '') =>
  updatePaymentStatus(paymentId, 'canceled', user, {
    action: 'canceled',
    payload: { cancelReason: reason || '' },
  })

const reconcilePayment = (paymentId, user = {}) =>
  updatePaymentStatus(paymentId, 'reconciled', user, { action: 'reconciled' })

const getPaymentById = async (paymentId) => serializePayment(await findPaymentRecord(paymentId, { includeMovement: true }))

const listPayments = async (filters = {}) => {
  const limit = Math.max(1, Math.min(Number(filters.limit || 50), 200))

  if (!isPrismaMode()) {
    const items = dataAdapter
      .list('payments')
      .map(serializePayment)
      .filter((payment) => !filters.status || payment.status === filters.status)
      .filter((payment) => !filters.provider || payment.provider === filters.provider)
      .filter((payment) => !filters.movementId || payment.movementId === filters.movementId)
      .sort((first, second) => String(second.createdAt || '').localeCompare(String(first.createdAt || '')))
      .slice(0, limit)

    return { items }
  }

  const where = {
    ...(filters.movementId ? { financialMovementId: filters.movementId } : {}),
  }
  const records = await getPrisma().payment.findMany({
    where,
    include: { financialMovement: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  const items = records
    .map(serializePayment)
    .filter((payment) => !filters.status || payment.status === filters.status)
    .filter((payment) => !filters.provider || payment.provider === filters.provider)

  return { items }
}

const getFinanceSummary = async () => {
  const [movementRecords, paymentResult] = await Promise.all([
    dataAdapter.list('financeMovements'),
    listPayments({ limit: 200 }),
  ])
  const movements = movementRecords.map(serializeMovement)
  const payments = paymentResult.items

  const summary = movements.reduce(
    (totals, movement) => {
      if (movement.type === 'Ingreso') {
        totals.income += movement.totalAmount
        totals.receivable += movement.pendingAmount
      }
      if (movement.type === 'Egreso') {
        totals.expenses += movement.totalAmount
        totals.payable += movement.pendingAmount
      }
      totals.totalPending += movement.pendingAmount
      totals.totalPaid += movement.paidAmount
      if (movement.status === 'Vencido') totals.overdue += 1
      return totals
    },
    {
      income: 0,
      expenses: 0,
      receivable: 0,
      payable: 0,
      totalPending: 0,
      totalPaid: 0,
      overdue: 0,
    },
  )

  const paymentsPending = payments.filter((payment) => payment.status === 'pending').length
  const paymentsApproved = payments.filter((payment) => SETTLED_PAYMENT_STATUSES.has(payment.status)).length
  const paidByPayments = payments
    .filter((payment) => SETTLED_PAYMENT_STATUSES.has(payment.status))
    .reduce((total, payment) => total + payment.amount, 0)

  return {
    ...summary,
    paymentsMode: getPaymentsMode(),
    paymentProvider: getConfiguredProviderName(),
    paymentsPending,
    paymentsApproved,
    totalPaidByPayments: paidByPayments,
    totalToCollect: summary.receivable,
    ingresos: summary.income,
    egresos: summary.expenses,
    pagosPendientes: paymentsPending,
    pagosAprobados: paymentsApproved,
    totalPagado: summary.totalPaid,
    totalPorCobrar: summary.receivable,
    lastPayments: payments.slice(0, 5),
    lastMovements: movements.slice(0, 5),
  }
}

const createSandboxPaymentDemo = async (user = {}) => {
  assertSandboxEnabled()

  const movement = await createFinanceMovementForPaymentDemo(user)
  const { payment: createdPayment, audit: createdAudit } = await createPayment(
    {
      financialMovementId: movement.id,
      amount: 1000,
      currency: DEFAULT_CURRENCY,
      method: 'sandbox',
      paymentMethod: 'sandbox',
      provider: 'sandbox',
      status: 'pending',
      observations: `${TEST_PAYMENT_PREFIX} Pago sandbox demo Rubik`,
      source: 'sandbox-payment-demo',
      metadata: { testPrefix: TEST_PAYMENT_PREFIX },
    },
    user,
  )
  const started = await startSandboxPayment(createdPayment.id, user)
  const summary = await getFinanceSummary()

  return {
    ok: true,
    movement: started.movement || movement,
    payment: started.payment,
    audit: [createdAudit, started.audit].filter(Boolean),
    summary,
    message: 'Pago sandbox simulado correctamente. No se movió dinero real.',
  }
}

const findPaymentByProviderToken = async (token) => {
  if (!token) throw createError('token_ws es requerido.', 400)

  if (!isPrismaMode()) {
    const payment = dataAdapter
      .list('payments')
      .map(serializePayment)
      .find((candidate) => candidate.providerPaymentId === token || candidate.reference === token)

    if (!payment) throw createError('Pago Transbank no encontrado para el token recibido.', 404)
    return findPaymentRecord(payment.id, { includeMovement: true })
  }

  const prisma = getPrisma()
  const paymentByReference = await prisma.payment.findFirst({
    where: { reference: token },
    include: { financialMovement: true },
  })
  if (paymentByReference) return paymentByReference

  const recentPayments = await prisma.payment.findMany({
    include: { financialMovement: true },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })
  const paymentByPayload = recentPayments.find((payment) => {
    const payload = isPlainObject(payment.payload) ? payment.payload : {}
    return payload.providerPaymentId === token || payload.token === token
  })

  if (!paymentByPayload) throw createError('Pago Transbank no encontrado para el token recibido.', 404)
  return paymentByPayload
}

const getSafeTransbankMetadata = (response = {}) => ({
  amount: response.amount,
  status: response.status,
  buyOrder: response.buy_order,
  sessionId: response.session_id,
  accountingDate: response.accounting_date,
  transactionDate: response.transaction_date,
  authorizationCode: response.authorization_code,
  paymentTypeCode: response.payment_type_code,
  responseCode: response.response_code,
  installmentsNumber: response.installments_number,
})

const createTransbankPaymentTransaction = async (paymentId, user = {}) => {
  assertPaymentsEnabled()

  const payment = await getPaymentById(paymentId)
  if (payment.provider !== 'transbank') {
    throw createError('El pago no esta configurado con provider transbank.', 400)
  }

  if (CLOSED_PAYMENT_STATUSES.has(payment.status)) {
    throw createError(`El pago ya esta en estado ${payment.status}.`, 409)
  }

  const provider = getPaymentProvider('transbank')
  const buyOrder = `rbk-${Date.now()}-${randomUUID().slice(0, 6)}`.slice(0, 26)
  const sessionId = `rubik-${payment.id}`.slice(0, 61)
  const returnUrl = buildTransbankReturnUrl()
  const transaction = await provider.createTransaction({
    buyOrder,
    sessionId,
    amount: payment.amount,
    returnUrl,
  })

  const updated = await updatePaymentStatus(payment.id, 'pending', user, {
    action: 'transbank_created',
    provider: 'transbank',
    sandbox: transaction.environment === 'integration',
    providerStatus: transaction.providerStatus || 'created',
    providerPaymentId: transaction.token,
    transactionDate: new Date().toISOString(),
    rawResponse: {
      url: transaction.url,
      token: transaction.token,
      environment: transaction.environment,
      providerStatus: transaction.providerStatus,
    },
    payload: {
      provider: 'transbank',
      providerPaymentId: transaction.token,
      token: transaction.token,
      providerStatus: transaction.providerStatus || 'created',
      redirectUrl: transaction.url,
      returnUrl,
      buyOrder,
      sessionId,
      transbankEnvironment: transaction.environment,
      metadata: {
        ...payment.metadata,
        buyOrder,
        sessionId,
        returnUrl,
        transbankEnvironment: transaction.environment,
      },
    },
  })

  return {
    ...updated,
    redirect: {
      url: transaction.url,
      token: transaction.token,
    },
  }
}

const createFinanceMovementForTransbankDemo = async (user = {}) => {
  assertPaymentsEnabled()

  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const movementPayload = {
    id: createId('fin-test-webpay'),
    type: 'Ingreso',
    category: 'Venta',
    documentType: 'Comprobante Webpay sandbox',
    documentNumber: `${TEST_PAYMENT_PREFIX} WEBPAY-${Date.now()}`,
    client: 'Rubik Demo',
    company: 'Rubik Creaciones',
    description: `${TEST_PAYMENT_PREFIX} Webpay Plus sandbox demo Rubik`,
    netAmount: 1000,
    taxRate: 0,
    taxAmount: 0,
    isTaxExempt: true,
    totalAmount: 1000,
    paidAmount: 0,
    pendingAmount: 1000,
    issueDate: today,
    dueDate: today,
    status: 'Sin pagar',
    paymentMethod: 'Webpay',
    responsibleName: user?.name || '',
    responsibleEmail: user?.email || '',
    observations: `${TEST_PAYMENT_PREFIX} Webpay Plus sandbox demo sin movimiento real de dinero.`,
    sourceType: 'transbank-webpay-demo',
    auditLog: [
      {
        action: 'Movimiento demo Webpay sandbox creado',
        userName: user?.name || '',
        userEmail: user?.email || '',
        createdAt: now.toISOString(),
      },
    ],
    payload: {
      testPrefix: TEST_PAYMENT_PREFIX,
      sandbox: true,
      paymentsMode: getPaymentsMode(),
      provider: 'transbank',
      transbankEnvironment: process.env.TRANSBANK_ENV || 'integration',
      paymentState: 'pending',
    },
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }

  const movement = await dataAdapter.create('financeMovements', 'fin', movementPayload)
  return serializeMovement(movement)
}

const createTransbankPaymentDemo = async (user = {}) => {
  assertPaymentsEnabled()

  const movement = await createFinanceMovementForTransbankDemo(user)
  const { payment: createdPayment, audit: createdAudit } = await createPayment(
    {
      financialMovementId: movement.id,
      amount: 1000,
      currency: DEFAULT_CURRENCY,
      method: 'webpay',
      paymentMethod: 'webpay',
      provider: 'transbank',
      status: 'pending',
      observations: `${TEST_PAYMENT_PREFIX} Webpay Plus sandbox demo Rubik`,
      source: 'transbank-webpay-demo',
      metadata: { testPrefix: TEST_PAYMENT_PREFIX },
    },
    user,
  )
  const transaction = await createTransbankPaymentTransaction(createdPayment.id, user)

  return {
    ok: true,
    movement: transaction.movement || movement,
    payment: transaction.payment,
    audit: [createdAudit, transaction.audit].filter(Boolean),
    redirect: transaction.redirect,
    message: 'Transaccion Webpay sandbox creada. No se movio dinero real.',
  }
}

const confirmTransbankPayment = async ({ token, tokenType = 'token_ws' } = {}, user = {}) => {
  const paymentRecord = await findPaymentByProviderToken(token)
  const payment = serializePayment(paymentRecord)

  if (tokenType === 'TBK_TOKEN') {
    const updated = await updatePaymentStatus(payment.id, 'failed', user, {
      action: 'transbank_return_aborted',
      provider: 'transbank',
      sandbox: true,
      providerStatus: 'aborted',
      providerPaymentId: token,
      transactionDate: new Date().toISOString(),
      rawResponse: { tokenType, token, status: 'aborted' },
      payload: {
        provider: 'transbank',
        providerStatus: 'aborted',
        metadata: {
          ...payment.metadata,
          tokenType,
          transbankStatus: 'aborted',
        },
      },
    })

    return {
      ...updated,
      status: 'failed',
      frontendUrl: buildFrontendPaymentUrl('failed', payment.id),
    }
  }

  const provider = getPaymentProvider('transbank')

  try {
    const transbankResponse = await provider.commitTransaction(token)
    const nextStatus = provider.mapTransbankStatus(transbankResponse)
    const safeMetadata = getSafeTransbankMetadata(transbankResponse)
    const updated = await updatePaymentStatus(payment.id, nextStatus, user, {
      action: 'transbank_commit',
      provider: 'transbank',
      sandbox: true,
      providerStatus: transbankResponse.status || nextStatus,
      providerPaymentId: token,
      transactionDate: transbankResponse.transaction_date || new Date().toISOString(),
      rawResponse: safeMetadata,
      payload: {
        provider: 'transbank',
        providerStatus: transbankResponse.status || nextStatus,
        metadata: {
          ...payment.metadata,
          ...safeMetadata,
          tokenType,
        },
      },
    })

    return {
      ...updated,
      status: nextStatus,
      transbankResponse: safeMetadata,
      frontendUrl: buildFrontendPaymentUrl(nextStatus, payment.id),
    }
  } catch (error) {
    const updated = await updatePaymentStatus(payment.id, 'failed', user, {
      action: 'transbank_commit_failed',
      provider: 'transbank',
      sandbox: true,
      providerStatus: 'commit_failed',
      providerPaymentId: token,
      transactionDate: new Date().toISOString(),
      rawResponse: { message: error.message || 'Transbank commit failed' },
      payload: {
        provider: 'transbank',
        providerStatus: 'commit_failed',
        metadata: {
          ...payment.metadata,
          tokenType,
          transbankError: error.message || 'Transbank commit failed',
        },
      },
    })

    return {
      ...updated,
      status: 'failed',
      error: error.message || 'Transbank commit failed',
      frontendUrl: buildFrontendPaymentUrl('failed', payment.id),
    }
  }
}

module.exports = {
  approvePayment,
  cancelPayment,
  createFinanceMovementForPaymentDemo,
  createFinanceMovementForTransbankDemo,
  createPayment,
  createPaymentAuditLog,
  createSandboxPaymentDemo,
  createTransbankPaymentDemo,
  createTransbankPaymentTransaction,
  confirmTransbankPayment,
  getFinanceSummary,
  getPaymentAudit,
  getPaymentById,
  listPayments,
  recalculateMovementPaymentStatus,
  rejectPayment,
  reconcilePayment,
  startSandboxPayment,
}
