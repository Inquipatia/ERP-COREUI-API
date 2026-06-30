-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NULL,
    `passwordHash` VARCHAR(191) NULL,
    `role` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Activo',
    `position` VARCHAR(191) NULL,
    `area` VARCHAR(191) NULL,
    `permissions` JSON NULL,
    `payload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_email_idx`(`email`),
    INDEX `User_role_idx`(`role`),
    INDEX `User_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Client` (
    `id` VARCHAR(191) NOT NULL,
    `contactName` VARCHAR(191) NULL,
    `contact` VARCHAR(191) NULL,
    `company` VARCHAR(191) NULL,
    `rut` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `commune` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Activo',
    `observations` VARCHAR(191) NULL,
    `payload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Client_rut_key`(`rut`),
    INDEX `Client_rut_idx`(`rut`),
    INDEX `Client_company_idx`(`company`),
    INDEX `Client_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Quote` (
    `id` VARCHAR(191) NOT NULL,
    `quoteNumber` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NULL,
    `client` VARCHAR(191) NULL,
    `company` VARCHAR(191) NULL,
    `seller` VARCHAR(191) NULL,
    `subject` VARCHAR(191) NULL,
    `condition` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Borrador',
    `netAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `totalAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `items` JSON NULL,
    `payload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Quote_quoteNumber_key`(`quoteNumber`),
    INDEX `Quote_quoteNumber_idx`(`quoteNumber`),
    INDEX `Quote_status_idx`(`status`),
    INDEX `Quote_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuoteItem` (
    `id` VARCHAR(191) NOT NULL,
    `quoteId` VARCHAR(191) NULL,
    `quoteNumber` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `quantity` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `unitValue` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `observations` TEXT NULL,
    `payload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `QuoteItem_quoteId_idx`(`quoteId`),
    INDEX `QuoteItem_quoteNumber_idx`(`quoteNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Document` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `documentNumber` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NULL,
    `client` VARCHAR(191) NULL,
    `company` VARCHAR(191) NULL,
    `seller` VARCHAR(191) NULL,
    `netAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `totalAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Borrador',
    `origin` VARCHAR(191) NULL,
    `tags` JSON NULL,
    `observations` VARCHAR(191) NULL,
    `filePdfUrl` VARCHAR(191) NULL,
    `fileExcelUrl` VARCHAR(191) NULL,
    `items` JSON NULL,
    `payload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Document_status_idx`(`status`),
    INDEX `Document_createdAt_idx`(`createdAt`),
    UNIQUE INDEX `Document_type_documentNumber_key`(`type`, `documentNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tender` (
    `id` VARCHAR(191) NOT NULL,
    `tenderId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `buyer` VARCHAR(191) NULL,
    `buyerRut` VARCHAR(191) NULL,
    `budget` DECIMAL(14, 2) NULL,
    `closingDate` DATETIME(3) NULL,
    `openingDate` DATETIME(3) NULL,
    `adjudicationDate` DATETIME(3) NULL,
    `contractSignDate` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Borrador',
    `riskLevel` VARCHAR(191) NOT NULL DEFAULT 'Medio',
    `object` VARCHAR(191) NULL,
    `summary` VARCHAR(191) NULL,
    `administrativeRequirements` JSON NULL,
    `technicalRequirements` JSON NULL,
    `economicRequirements` JSON NULL,
    `requiredDocuments` JSON NULL,
    `essentialDocuments` JSON NULL,
    `evaluationCriteria` JSON NULL,
    `guarantees` JSON NULL,
    `paymentTerms` VARCHAR(191) NULL,
    `penalties` JSON NULL,
    `risks` JSON NULL,
    `suggestedQuestions` JSON NULL,
    `technicalItems` JSON NULL,
    `observations` VARCHAR(191) NULL,
    `sourceText` VARCHAR(191) NULL,
    `sourceFiles` JSON NULL,
    `fieldSources` JSON NULL,
    `diagnostics` JSON NULL,
    `payload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Tender_tenderId_key`(`tenderId`),
    INDEX `Tender_status_idx`(`status`),
    INDEX `Tender_riskLevel_idx`(`riskLevel`),
    INDEX `Tender_closingDate_idx`(`closingDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkOrder` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `client` VARCHAR(191) NULL,
    `company` VARCHAR(191) NULL,
    `quoteNumber` VARCHAR(191) NULL,
    `requesterName` VARCHAR(191) NULL,
    `requesterEmail` VARCHAR(191) NULL,
    `requesterRole` VARCHAR(191) NULL,
    `assigneeName` VARCHAR(191) NULL,
    `assigneeEmail` VARCHAR(191) NULL,
    `assigneeRole` VARCHAR(191) NULL,
    `sourceArea` VARCHAR(191) NULL,
    `targetArea` VARCHAR(191) NULL,
    `priority` VARCHAR(191) NOT NULL DEFAULT 'Media',
    `status` VARCHAR(191) NOT NULL DEFAULT 'Pendiente',
    `dueDate` DATETIME(3) NULL,
    `description` VARCHAR(191) NULL,
    `requirements` VARCHAR(191) NULL,
    `deliverables` VARCHAR(191) NULL,
    `observations` VARCHAR(191) NULL,
    `comments` JSON NULL,
    `movements` JSON NULL,
    `payload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WorkOrder_status_idx`(`status`),
    INDEX `WorkOrder_priority_idx`(`priority`),
    INDEX `WorkOrder_targetArea_idx`(`targetArea`),
    INDEX `WorkOrder_dueDate_idx`(`dueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkOrderMovement` (
    `id` VARCHAR(191) NOT NULL,
    `workOrderId` VARCHAR(191) NULL,
    `type` VARCHAR(191) NULL,
    `status` VARCHAR(191) NULL,
    `fromArea` VARCHAR(191) NULL,
    `toArea` VARCHAR(191) NULL,
    `userName` VARCHAR(191) NULL,
    `userEmail` VARCHAR(191) NULL,
    `comment` TEXT NULL,
    `observations` TEXT NULL,
    `payload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WorkOrderMovement_workOrderId_idx`(`workOrderId`),
    INDEX `WorkOrderMovement_status_idx`(`status`),
    INDEX `WorkOrderMovement_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FinancialMovement` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `documentType` VARCHAR(191) NULL,
    `documentNumber` VARCHAR(191) NULL,
    `client` VARCHAR(191) NULL,
    `company` VARCHAR(191) NULL,
    `supplierId` VARCHAR(191) NULL,
    `supplierName` VARCHAR(191) NULL,
    `quoteId` VARCHAR(191) NULL,
    `quoteNumber` VARCHAR(191) NULL,
    `tenderId` VARCHAR(191) NULL,
    `workOrderId` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `netAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 19,
    `taxAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `isTaxExempt` BOOLEAN NOT NULL DEFAULT false,
    `totalAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `paidAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `pendingAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `issueDate` DATETIME(3) NULL,
    `dueDate` DATETIME(3) NULL,
    `paymentDate` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Sin pagar',
    `paymentMethod` VARCHAR(191) NULL,
    `paymentTerms` VARCHAR(191) NULL,
    `responsibleName` VARCHAR(191) NULL,
    `responsibleEmail` VARCHAR(191) NULL,
    `observations` VARCHAR(191) NULL,
    `sourceType` VARCHAR(191) NULL,
    `quoteSourceLocked` BOOLEAN NOT NULL DEFAULT false,
    `isAdditionalMovement` BOOLEAN NOT NULL DEFAULT false,
    `auditLog` JSON NULL,
    `payload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FinancialMovement_type_idx`(`type`),
    INDEX `FinancialMovement_status_idx`(`status`),
    INDEX `FinancialMovement_quoteNumber_idx`(`quoteNumber`),
    INDEX `FinancialMovement_dueDate_idx`(`dueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Expense` (
    `id` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `documentType` VARCHAR(191) NULL,
    `documentNumber` VARCHAR(191) NULL,
    `supplierId` VARCHAR(191) NULL,
    `supplierName` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `netAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 19,
    `taxAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `totalAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `paidAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `pendingAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `issueDate` DATETIME(3) NULL,
    `dueDate` DATETIME(3) NULL,
    `paymentDate` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Sin pagar',
    `paymentMethod` VARCHAR(191) NULL,
    `observations` TEXT NULL,
    `payload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Expense_category_idx`(`category`),
    INDEX `Expense_status_idx`(`status`),
    INDEX `Expense_supplierId_idx`(`supplierId`),
    INDEX `Expense_dueDate_idx`(`dueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `financialMovementId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `paymentDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `paymentMethod` VARCHAR(191) NULL,
    `reference` VARCHAR(191) NULL,
    `responsibleName` VARCHAR(191) NULL,
    `responsibleEmail` VARCHAR(191) NULL,
    `observations` VARCHAR(191) NULL,
    `auditLog` JSON NULL,
    `payload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Payment_financialMovementId_idx`(`financialMovementId`),
    INDEX `Payment_paymentDate_idx`(`paymentDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Supplier` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `rut` VARCHAR(191) NULL,
    `contactName` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `category` VARCHAR(191) NULL,
    `paymentTerms` VARCHAR(191) NULL,
    `bankName` VARCHAR(191) NULL,
    `bankAccountType` VARCHAR(191) NULL,
    `bankAccountNumber` VARCHAR(191) NULL,
    `bankAccountEmail` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Activo',
    `observations` VARCHAR(191) NULL,
    `payload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Supplier_rut_key`(`rut`),
    INDEX `Supplier_name_idx`(`name`),
    INDEX `Supplier_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductService` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `type` VARCHAR(191) NULL,
    `unit` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `technicalDescription` TEXT NULL,
    `material` VARCHAR(191) NULL,
    `suggestedPrice` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `baseCost` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `costPrice` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Activo',
    `observations` TEXT NULL,
    `payload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProductService_name_key`(`name`),
    INDEX `ProductService_name_idx`(`name`),
    INDEX `ProductService_category_idx`(`category`),
    INDEX `ProductService_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Material` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `unit` VARCHAR(191) NULL,
    `sku` VARCHAR(191) NULL,
    `currentStock` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `minStock` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `baseCost` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `unitCost` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `wastePercent` DECIMAL(6, 2) NOT NULL DEFAULT 0,
    `marginPercent` DECIMAL(6, 2) NOT NULL DEFAULT 0,
    `supplierId` VARCHAR(191) NULL,
    `supplierName` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Activo',
    `observations` TEXT NULL,
    `payload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Material_name_key`(`name`),
    UNIQUE INDEX `Material_sku_key`(`sku`),
    INDEX `Material_name_idx`(`name`),
    INDEX `Material_category_idx`(`category`),
    INDEX `Material_status_idx`(`status`),
    INDEX `Material_supplierId_idx`(`supplierId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `module` VARCHAR(191) NOT NULL,
    `recordId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `userEmail` VARCHAR(191) NULL,
    `details` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_module_idx`(`module`),
    INDEX `AuditLog_recordId_idx`(`recordId`),
    INDEX `AuditLog_userEmail_idx`(`userEmail`),
    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `QuoteItem` ADD CONSTRAINT `QuoteItem_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkOrderMovement` ADD CONSTRAINT `WorkOrderMovement_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `WorkOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FinancialMovement` ADD CONSTRAINT `FinancialMovement_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FinancialMovement` ADD CONSTRAINT `FinancialMovement_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_financialMovementId_fkey` FOREIGN KEY (`financialMovementId`) REFERENCES `FinancialMovement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Material` ADD CONSTRAINT `Material_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

