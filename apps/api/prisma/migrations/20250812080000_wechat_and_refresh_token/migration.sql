ALTER TABLE `UserAccount` ADD COLUMN `wechatOpenId` VARCHAR(191) NULL, ADD COLUMN `wechatUnionId` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `UserAccount_wechatOpenId_key` ON `UserAccount`(`wechatOpenId`);
CREATE UNIQUE INDEX `UserAccount_wechatUnionId_key` ON `UserAccount`(`wechatUnionId`);

CREATE TABLE `RefreshToken` (
  `id` VARCHAR(191) NOT NULL,
  `token` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `revokedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `RefreshToken_token_key`(`token`),
  INDEX `RefreshToken_userId_idx`(`userId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `RefreshToken_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `UserAccount`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
);
