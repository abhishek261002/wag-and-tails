import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly localUploadPath: string;

  constructor(private prisma: PrismaService) {
    this.localUploadPath = process.env['STORAGE_LOCAL_PATH'] ?? './uploads';
    if (!fs.existsSync(this.localUploadPath)) {
      fs.mkdirSync(this.localUploadPath, { recursive: true });
    }
  }

  async upload(
    file: Express.Multer.File,
    uploadedBy: string,
    entity: string,
    entityId: string
  ): Promise<{ url: string; id: string }> {
    const provider = process.env['STORAGE_PROVIDER'] ?? 'local';

    let url: string;

    if (provider === 'local') {
      const ext = path.extname(file.originalname);
      const filename = `${entity}_${entityId}_${Date.now()}${ext}`;
      const dest = path.join(this.localUploadPath, filename);
      fs.writeFileSync(dest, file.buffer);
      url = `/uploads/${filename}`;
    } else {
      // TODO: S3 upload
      url = `/uploads/placeholder_${Date.now()}`;
    }

    const record = await this.prisma.uploadedFile.create({
      data: {
        url,
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        uploadedBy,
        entity,
        entityId,
      },
    });

    return { url, id: record.id };
  }
}
