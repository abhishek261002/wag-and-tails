import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import * as path from 'path';
import * as fs from 'fs';
import { displayName, safeSegment, type SniffedType } from './upload-rules.js';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly localUploadPath: string;

  constructor(private prisma: PrismaService) {
    this.localUploadPath = path.resolve(process.env['STORAGE_LOCAL_PATH'] ?? './uploads');
    if (!fs.existsSync(this.localUploadPath)) {
      fs.mkdirSync(this.localUploadPath, { recursive: true });
    }
  }

  /**
   * Stores an already-validated file. The name on disk is generated here from checked pieces only: the entity
   * (from an allow-list), a sanitised id, a random suffix, and the extension of the type sniffed from the file's
   * bytes. Nothing the client typed (its file name, its claimed type) reaches the path.
   */
  async upload(
    buffer: Buffer,
    originalName: string,
    type: SniffedType,
    uploadedBy: string,
    entity: string,
    entityId: string
  ): Promise<{ url: string; id: string; kind: SniffedType['kind']; mimeType: string }> {
    const provider = process.env['STORAGE_PROVIDER'] ?? 'local';

    let url: string;
    if (provider === 'local') {
      const filename = `${safeSegment(entity, 'file', 30)}_${safeSegment(entityId, 'x', 40)}_${Date.now()}_${randomBytes(4).toString('hex')}${type.ext}`;
      const dest = path.resolve(this.localUploadPath, filename);
      // Belt and braces: whatever the pieces were, the file must land directly inside the uploads folder.
      if (path.dirname(dest) !== this.localUploadPath) throw new Error('Refusing to write outside the uploads folder');
      fs.writeFileSync(dest, buffer);
      url = `/uploads/${filename}`;
    } else {
      // TODO: S3 upload
      url = `/uploads/placeholder_${Date.now()}`;
    }

    const record = await this.prisma.uploadedFile.create({
      data: {
        url,
        filename: displayName(originalName),
        mimeType: type.mime,
        sizeBytes: buffer.length,
        uploadedBy,
        entity,
        entityId: safeSegment(entityId, 'unknown', 64),
      },
    });

    return { url, id: record.id, kind: type.kind, mimeType: type.mime };
  }
}
