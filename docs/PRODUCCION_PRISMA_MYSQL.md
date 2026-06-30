# Produccion Prisma + MySQL

Este proyecto queda preparado para usar dos modos de datos:

- `RUBIK_DATA_ADAPTER=json`: modo estable actual. Usa `data/rubik-db.json`.
- `RUBIK_DATA_ADAPTER=prisma`: modo MySQL con Prisma.

No cambies produccion a Prisma hasta completar migraciones, seed, migracion JSON, health checks y login.

## Probar primero en json

Windows PowerShell:

```powershell
cd C:\Users\hp\Documents\GitHub\ERP-COREUI-API
$env:RUBIK_DATA_ADAPTER="json"
npm run prisma:generate
npm start
```

Validaciones:

```powershell
Invoke-RestMethod http://localhost:4300/api/export/pdf-health
Invoke-RestMethod http://localhost:4300/api/health/db
Invoke-RestMethod http://localhost:4300/api/dashboard/summary -Headers @{ Authorization = "Bearer TOKEN" }
Invoke-RestMethod http://localhost:4300/api/quotes -Headers @{ Authorization = "Bearer TOKEN" }
Invoke-RestMethod http://localhost:4300/api/documents -Headers @{ Authorization = "Bearer TOKEN" }
```

Login:

```powershell
Invoke-RestMethod -Method Post http://localhost:4300/api/auth/login `
  -ContentType "application/json" `
  -Body '{"email":"r.rojas@rubikcreaciones.cl","password":"123456"}'
```

## Probar Prisma local

Configura MySQL local y una base vacia, por ejemplo `erp_rubik_local`.

Windows PowerShell:

```powershell
cd C:\Users\hp\Documents\GitHub\ERP-COREUI-API
$env:RUBIK_DATA_ADAPTER="prisma"
$env:DATABASE_URL="mysql://USUARIO:PASSWORD@localhost:3306/erp_rubik_local"
$env:INITIAL_USER_PASSWORD="123456"
npm run prisma:generate
npm run prisma:migrate:dev
npm run db:seed-users
npm run db:migrate-json
npm run db:health
npm start
```

Validaciones:

```powershell
Invoke-RestMethod http://localhost:4300/api/health/db
Invoke-RestMethod http://localhost:4300/api/health/production-readiness
Invoke-RestMethod -Method Post http://localhost:4300/api/auth/login `
  -ContentType "application/json" `
  -Body '{"email":"r.rojas@rubikcreaciones.cl","password":"123456"}'
```

## Produccion Hostinger

Mantener inicialmente:

```bash
RUBIK_DATA_ADAPTER=json
```

Instalar dependencias incluyendo Prisma CLI si el hosting separa devDependencies:

```bash
npm install --include=dev
```

O usar `NPM_CONFIG_INCLUDE=dev` en el entorno de instalacion.

Preparar Prisma sin activar todavia:

```bash
npm run prisma:generate
npm run prisma:migrate:status
```

Cuando la base MySQL este respaldada y lista:

```bash
npm run prisma:migrate:deploy
npm run db:seed-users
npm run db:migrate-json
npm run db:health
```

Verificar:

```bash
curl https://TU_API/api/health/db
curl https://TU_API/api/health/production-readiness
```

Solo despues cambiar:

```bash
RUBIK_DATA_ADAPTER=prisma
```

Reiniciar API y probar login, dashboard, cotizaciones, documentos, PDF, Excel, licitaciones, ordenes de trabajo, finanzas, materiales, productos, proveedores y asistente.

## Migrar JSON a MySQL

El script:

```bash
npm run db:migrate-json
```

Lee `data/rubik-db.json`, usa upsert, respeta ids cuando es posible y no borra datos existentes.

Para usar otro archivo JSON:

```bash
RUBIK_JSON_DB_FILE=/ruta/rubik-db-backup.json npm run db:migrate-json
```

Resumen esperado:

```json
{
  "users": {},
  "clients": {},
  "quotes": {},
  "quoteItems": {},
  "documents": {},
  "tenders": {},
  "workOrders": {},
  "financeMovements": {},
  "suppliers": {},
  "materials": {},
  "products": {},
  "errors": []
}
```

## Health checks

```bash
npm run db:health
curl https://TU_API/api/health/db
curl https://TU_API/api/health/production-readiness
```

`/api/health/db` devuelve adapter, `DATABASE_URL`, provider, database, counts y error.

`/api/health/production-readiness` valida adapter, conexion MySQL si aplica, migraciones si se pueden detectar, usuarios, cotizaciones, documentos, PDF y dashboard.

## Rollback

Si algo falla:

```bash
RUBIK_DATA_ADAPTER=json
```

Luego reiniciar API.

Si corresponde:

- volver a la rama/tag estable json.
- restaurar backup de `data/rubik-db.json`.
- mantener MySQL sin usar hasta corregir migracion o datos.

## Frontend

Configurar siempre:

```bash
VITE_RUBIK_API_URL=https://TU_API/api
```

Build:

```powershell
cd C:\Users\hp\Documents\GitHub\coreui-free-react-admin-template
npm run build
```

El frontend no depende de si la API esta en `json` o `prisma`; consume los mismos endpoints y formatos. Si la API responde un error de Prisma/MySQL, debe mostrar un mensaje claro y mantener fallback local temporal donde el modulo lo soporte.
