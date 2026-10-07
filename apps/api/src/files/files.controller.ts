import {
  Controller, Post, Req,
  UseGuards, BadRequestException, PayloadTooLargeException, UnsupportedMediaTypeException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FilesService } from './files.service.js';
import { CurrentUser } from '../common/decorators.js';
import { ABSOLUTE_MAX_BYTES, checkUpload, type UploadRefusal } from './upload-rules.js';
import { compressImage, UnreadableImageError } from './image-compress.js';
import type { FastifyRequest } from 'fastify';

@ApiTags('files')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('files')
export class FilesController {
  constructor(private filesService: FilesService) {}

  /**
   * Upload a file (Fastify multipart). POST multipart/form-data with:
   *   entity   what it is for: pet, user, booking, partner, conversation, support_ticket, partner_document, partner_tool
   *   entityId the parent record's id (used only in the stored name, after sanitising)
   *   file     the binary (photos, plus videos for partner_tool and PDFs for documents)
   * The type is decided from the file's bytes, not from its name or claimed type, and size limits apply per kind.
   */
  @Post('upload')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @ApiConsumes('multipart/form-data')
  async upload(
    @Req() req: FastifyRequest,
    @CurrentUser() user: { sub: string },
  ) {
    const data = await (req as any).file?.() ?? null;
    if (!data) throw new BadRequestException('No file uploaded');

    // Clients send the file part first, so `entity` / `entityId` only become available once the file has been
    // read. Read it up to the largest size any purpose allows, then validate against the purpose.
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of data.file) {
      total += (chunk as Buffer).length;
      if (total > ABSOLUTE_MAX_BYTES) {
        data.file.resume();
        throw new PayloadTooLargeException(`That file is too large (limit ${Math.round(ABSOLUTE_MAX_BYTES / (1024 * 1024))} MB).`);
      }
      chunks.push(chunk as Buffer);
    }
    // The parser stops at its own limit and flags the file; never store a cut-off file.
    if (data.file.truncated) throw new PayloadTooLargeException('That file is too large.');

    const entity: string = String(data.fields?.['entity']?.value ?? '');
    const entityId: string = String(data.fields?.['entityId']?.value ?? 'unknown');

    const buffer = Buffer.concat(chunks);
    const verdict = checkUpload(entity, buffer.subarray(0, 32), buffer.length);
    if (!verdict.ok) {
      const refusal = verdict as Extract<UploadRefusal, { ok: false }>;
      if (refusal.status === 413) throw new PayloadTooLargeException(refusal.message);
      if (refusal.status === 415) throw new UnsupportedMediaTypeException(refusal.message);
      throw new BadRequestException(refusal.message);
    }

    // Every photo is compressed before it is stored (resized, re-encoded, metadata removed).
    let stored: { buffer: Buffer; type: Extract<UploadRefusal, { ok: true }>['type'] };
    try {
      const c = await compressImage(buffer, (verdict as Extract<UploadRefusal, { ok: true }>).type);
      stored = { buffer: c.buffer, type: c.type };
    } catch (err) {
      if (err instanceof UnreadableImageError) throw new UnsupportedMediaTypeException(err.message);
      throw err;
    }

    return this.filesService.upload(stored.buffer, data.filename ?? 'upload', stored.type, user.sub, entity, entityId);
  }
}
