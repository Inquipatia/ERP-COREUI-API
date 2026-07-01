const dataAdapter = require('./dataAdapter')

const getObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {})

const toNumber = (value) => {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

const normalizeText = (value = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

const firstPresent = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== '') ?? undefined

const getQuoteNumber = (payload = {}) =>
  String(
    firstPresent(
      payload.quoteNumber,
      payload.numeroDocumento,
      payload.documentNumber,
      payload.quote?.quoteNumber,
      payload.quoteData?.quoteNumber,
      payload.payload?.quoteNumber,
      payload.payload?.quote?.quoteNumber,
      payload.id,
      Date.now(),
    ),
  )

const getSafeItems = (source = {}, fallbackDescription = 'Documento ERP Rubik') => {
  const sourcePayload = getObject(source.payload)
  const rawItems =
    (Array.isArray(source.quoteItems) && source.quoteItems) ||
    (Array.isArray(source.items) && source.items) ||
    (Array.isArray(sourcePayload.quoteItems) && sourcePayload.quoteItems) ||
    (Array.isArray(sourcePayload.items) && sourcePayload.items) ||
    []

  const normalizedItems = rawItems
    .map((item = {}) => {
      const quantity = toNumber(firstPresent(item.quantity, item.cantidad, item.qty, 1)) || 1
      const unitValue = toNumber(firstPresent(item.unitValue, item.unitPrice, item.valorUnitario, item.price))
      const explicitTotal = firstPresent(item.total, item.totalValue, item.valorTotal)

      return {
        quantity,
        description: String(
          firstPresent(item.description, item.descripcion, item.technicalDescription, item.name, fallbackDescription),
        ),
        unitValue,
        total: explicitTotal === undefined ? quantity * unitValue : toNumber(explicitTotal),
        observations: String(firstPresent(item.observations, item.observaciones, item.notes, '')),
      }
    })
    .filter((item) => item.description || item.unitValue || item.total)

  if (normalizedItems.length > 0) return normalizedItems

  const amount = toNumber(firstPresent(source.netAmount, source.montoNeto, source.net, source.totalAmount, source.total))
  return [
    {
      quantity: 1,
      description: fallbackDescription,
      unitValue: amount,
      total: amount,
      observations: String(firstPresent(source.observations, source.observaciones, source.subject, '')),
    },
  ]
}

const buildQuoteExportPayload = (quote = {}) => {
  const payload = getObject(quote.payload)
  const payloadClient = getObject(payload.client)
  const payloadSeller = getObject(payload.seller || payload.selectedSeller)
  const payloadQuote = getObject(payload.quote || payload.quoteData)
  const hasPayloadClient = Object.keys(payloadClient).length > 0
  const hasPayloadSeller = Object.keys(payloadSeller).length > 0
  const quoteNumber = getQuoteNumber({ ...payload, ...quote })
  const items = getSafeItems({ ...payload, ...quote }, quote.subject || `Cotizacion ${quoteNumber}`)
  const itemsTotal = items.reduce((sum, item) => sum + toNumber(item.total), 0)
  const net = toNumber(firstPresent(quote.netAmount, quote.net, payload.amounts?.net, payload.net, itemsTotal))
  const iva = toNumber(firstPresent(quote.taxAmount, quote.iva, payload.amounts?.iva, payload.iva))
  const total = toNumber(
    firstPresent(quote.totalAmount, quote.total, payload.amounts?.total, payload.total, net + iva),
  )

  return {
    ...payload,
    id: quote.id,
    quoteNumber,
    date: firstPresent(quote.date, quote.fecha, payloadQuote.date, payloadQuote.fecha, payload.date, payload.fecha),
    client: hasPayloadClient ? payloadClient : {
      client: firstPresent(quote.client, payloadClient.client, payloadClient.name, payloadClient.attention, ''),
      company: firstPresent(quote.company, payloadClient.company, payloadClient.empresa, ''),
      attention: firstPresent(quote.client, payloadClient.attention, payloadClient.contact, ''),
      rut: firstPresent(payloadClient.rut, quote.rut, ''),
      phone: firstPresent(payloadClient.phone, quote.phone, ''),
      commune: firstPresent(payloadClient.commune, payloadClient.comuna, quote.commune, ''),
      email: firstPresent(payloadClient.email, quote.email, ''),
      address: firstPresent(payloadClient.address, quote.address, ''),
    },
    seller: hasPayloadSeller ? payloadSeller : {
      name: firstPresent(quote.seller, payloadSeller.name, payloadSeller.nombre, ''),
      email: firstPresent(payloadSeller.email, payloadSeller.mail, ''),
    },
    quote: {
      ...payloadQuote,
      quoteNumber,
      date: firstPresent(quote.date, quote.fecha, payloadQuote.date, payloadQuote.fecha),
      subject: firstPresent(quote.subject, payloadQuote.subject, payloadQuote.tema, ''),
      condition: firstPresent(quote.condition, payloadQuote.condition, payloadQuote.condicion, ''),
      observations: firstPresent(quote.observations, payloadQuote.observations, payloadQuote.observaciones, ''),
      ivaRate: firstPresent(payloadQuote.ivaRate, payload.ivaRate, 19),
    },
    quoteItems: items,
    items,
    amounts: {
      ...(payload.amounts || {}),
      net,
      iva,
      total,
    },
    netAmount: net,
    taxAmount: iva,
    totalAmount: total,
    subject: firstPresent(quote.subject, payloadQuote.subject, ''),
    condition: firstPresent(quote.condition, payloadQuote.condition, ''),
  }
}

const buildDocumentExportPayload = async (document = {}) => {
  const payload = getObject(document.payload)
  const quoteId = payload.quoteId || payload.quote?.id || payload.id
  const quoteNumber = payload.quoteNumber || payload.quote?.quoteNumber || document.documentNumber
  const isQuoteDocument =
    normalizeText(document.type || document.tipoDocumento).includes('cotizacion') ||
    normalizeText(document.origin || document.origen).includes('quote') ||
    normalizeText(document.origin || document.origen).includes('cotizacion')

  if (isQuoteDocument) {
    let quote = null

    if (quoteId) {
      quote = await dataAdapter.findById('quotes', quoteId).catch(() => null)
    }

    if (!quote && quoteNumber) {
      const quotes = await dataAdapter.list('quotes').catch(() => [])
      quote = quotes.find((candidate) => String(candidate.quoteNumber) === String(quoteNumber)) || null
    }

    if (quote) {
      return buildQuoteExportPayload({
        ...quote,
        documentId: document.id,
        documentNumber: document.documentNumber,
        payload: {
          ...(getObject(quote.payload)),
          ...payload,
        },
      })
    }
  }

  const documentNumber = getQuoteNumber(document)
  const items = getSafeItems(document, document.observations || `${document.type || 'Documento'} ${documentNumber}`)
  const net = toNumber(firstPresent(document.netAmount, document.montoNeto, document.net))
  const iva = toNumber(firstPresent(document.taxAmount, document.iva))
  const total = toNumber(firstPresent(document.totalAmount, document.total))

  return buildQuoteExportPayload({
    id: document.id,
    quoteNumber: documentNumber,
    date: firstPresent(document.date, document.fecha),
    client: firstPresent(document.client, document.cliente, ''),
    company: firstPresent(document.company, document.empresa, ''),
    seller: firstPresent(document.seller, document.vendedor, ''),
    subject: firstPresent(document.observations, document.observaciones, document.type, ''),
    condition: '',
    netAmount: net,
    taxAmount: iva,
    totalAmount: total || net + iva,
    items,
    payload,
  })
}

const getQuoteExportPayloadById = async (id) => buildQuoteExportPayload(await dataAdapter.findById('quotes', id))

const getDocumentExportPayloadById = async (id) =>
  buildDocumentExportPayload(await dataAdapter.findById('documents', id))

module.exports = {
  buildDocumentExportPayload,
  buildQuoteExportPayload,
  getDocumentExportPayloadById,
  getQuoteExportPayloadById,
}
