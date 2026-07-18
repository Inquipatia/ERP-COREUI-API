-- Additive migration for TALLER_INSTALACION work orders.
-- This migration does not delete or reset existing data.

ALTER TABLE `WorkOrder` ADD COLUMN `workOrderNumber` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `WorkOrder_workOrderNumber_key` ON `WorkOrder`(`workOrderNumber`);
CREATE INDEX `WorkOrder_type_idx` ON `WorkOrder`(`type`);

CREATE TABLE `WorkOrderMaterial` (
    `id` VARCHAR(191) NOT NULL,
    `workOrderId` VARCHAR(191) NOT NULL,
    `materialId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `sku` VARCHAR(191) NULL,
    `unit` VARCHAR(191) NULL,
    `quantity` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `unitCost` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `totalCost` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `observations` TEXT NULL,
    `payload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WorkOrderMaterial_workOrderId_idx`(`workOrderId`),
    INDEX `WorkOrderMaterial_materialId_idx`(`materialId`),
    INDEX `WorkOrderMaterial_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WorkOrderChecklistItem` (
    `id` VARCHAR(191) NOT NULL,
    `workOrderId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isChecked` BOOLEAN NOT NULL DEFAULT false,
    `checkedAt` DATETIME(3) NULL,
    `checkedByName` VARCHAR(191) NULL,
    `checkedByEmail` VARCHAR(191) NULL,
    `observations` TEXT NULL,
    `payload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WorkOrderChecklistItem_workOrderId_idx`(`workOrderId`),
    INDEX `WorkOrderChecklistItem_category_idx`(`category`),
    INDEX `WorkOrderChecklistItem_isChecked_idx`(`isChecked`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WorkOrderEvidence` (
    `id` VARCHAR(191) NOT NULL,
    `workOrderId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'photo',
    `fileName` VARCHAR(191) NULL,
    `fileUrl` VARCHAR(191) NULL,
    `mimeType` VARCHAR(191) NULL,
    `sizeBytes` INTEGER NULL,
    `description` TEXT NULL,
    `takenAt` DATETIME(3) NULL,
    `uploadedByName` VARCHAR(191) NULL,
    `uploadedByEmail` VARCHAR(191) NULL,
    `payload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WorkOrderEvidence_workOrderId_idx`(`workOrderId`),
    INDEX `WorkOrderEvidence_type_idx`(`type`),
    INDEX `WorkOrderEvidence_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WorkOrderSignature` (
    `id` VARCHAR(191) NOT NULL,
    `workOrderId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NULL,
    `signerName` VARCHAR(191) NOT NULL,
    `signerRut` VARCHAR(191) NULL,
    `signerEmail` VARCHAR(191) NULL,
    `signatureUrl` VARCHAR(191) NULL,
    `dataUrl` LONGTEXT NULL,
    `fileName` VARCHAR(191) NULL,
    `mimeType` VARCHAR(191) NULL,
    `signedAt` DATETIME(3) NULL,
    `payload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WorkOrderSignature_workOrderId_idx`(`workOrderId`),
    INDEX `WorkOrderSignature_role_idx`(`role`),
    INDEX `WorkOrderSignature_signedAt_idx`(`signedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WorkOrderStatusHistory` (
    `id` VARCHAR(191) NOT NULL,
    `workOrderId` VARCHAR(191) NOT NULL,
    `fromStatus` VARCHAR(191) NULL,
    `toStatus` VARCHAR(191) NOT NULL,
    `comment` TEXT NULL,
    `userName` VARCHAR(191) NULL,
    `userEmail` VARCHAR(191) NULL,
    `payload` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WorkOrderStatusHistory_workOrderId_idx`(`workOrderId`),
    INDEX `WorkOrderStatusHistory_toStatus_idx`(`toStatus`),
    INDEX `WorkOrderStatusHistory_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `WorkOrderMaterial` ADD CONSTRAINT `WorkOrderMaterial_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `WorkOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `WorkOrderMaterial` ADD CONSTRAINT `WorkOrderMaterial_materialId_fkey` FOREIGN KEY (`materialId`) REFERENCES `Material`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `WorkOrderChecklistItem` ADD CONSTRAINT `WorkOrderChecklistItem_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `WorkOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `WorkOrderEvidence` ADD CONSTRAINT `WorkOrderEvidence_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `WorkOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `WorkOrderSignature` ADD CONSTRAINT `WorkOrderSignature_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `WorkOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `WorkOrderStatusHistory` ADD CONSTRAINT `WorkOrderStatusHistory_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `WorkOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
