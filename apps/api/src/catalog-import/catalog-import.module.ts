import { Module } from '@nestjs/common';
import { CatalogImportService } from './catalog-import.service.js';
import { CatalogImportController } from './catalog-import.controller.js';
import { AuditLogModule } from '../audit-log/audit-log.module.js';

@Module({
  imports: [AuditLogModule],
  providers: [CatalogImportService],
  controllers: [CatalogImportController],
})
export class CatalogImportModule {}
