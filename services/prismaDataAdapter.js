// Backward-compatible alias: postgresDataAdapter.js now contains the generic
// Prisma adapter used by MySQL in production. Keep this indirection so existing
// imports continue to work while DATA_ADAPTER_MODE=prisma stays Prisma/MySQL.
module.exports = require('./postgresDataAdapter')
