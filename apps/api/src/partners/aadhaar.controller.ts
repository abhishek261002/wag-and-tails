import { BadRequestException, Body, Controller, Get, PayloadTooLargeException, Post, Req, UnsupportedMediaTypeException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { CurrentUser, Roles } from '../common/decorators.js';
import { RolesGuard } from '../common/roles.guard.js';
import { checkUpload, MB, type SniffedType } from '../files/upload-rules.js';
import { compressImage, UnreadableImageError } from '../files/image-compress.js';
import { AadhaarService, type AadhaarSide } from './aadhaar.service.js';

// Partner app: Aadhaar number and card photos (new partners before approval, existing partners when asked).
@ApiTags('partner')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('partner')
@Controller('partner/aadhaar')
export class AadhaarController {
  constructor(private aadhaar: AadhaarService) {}

  @Get()
  status(@CurrentUser() user: { sub: string }) {
    return this.aadhaar.status(user.sub);
  }

  /** multipart: side = front | back, file = the photo. */
  @Post('photo')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async photo(@Req() req: FastifyRequest, @CurrentUser() user: { sub: string }) {
    const data = await (req as any).file?.() ?? null;
    if (!data) throw new BadRequestException('No photo uploaded');
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of data.file) {
      total += (chunk as Buffer).length;
      if (total > 10 * MB) {
        data.file.resume();
        throw new PayloadTooLargeException('That photo is too large (limit 10 MB).');
      }
      chunks.push(chunk as Buffer);
    }
    if (data.file.truncated) throw new PayloadTooLargeException('That photo is too large.');
    const side = String(data.fields?.['side']?.value ?? '') as AadhaarSide;
    if (side !== 'front' && side !== 'back') throw new BadRequestException('side must be front or back');
    const buffer = Buffer.concat(chunks);
    const verdict = checkUpload('partner_document', buffer.subarray(0, 32), buffer.length) as { ok: boolean; type?: SniffedType };
    if (!verdict.ok || !verdict.type || verdict.type.kind !== 'image') throw new UnsupportedMediaTypeException('Send a photo (JPG, PNG or WebP).');
    try {
      const c = await compressImage(buffer, verdict.type);
      return this.aadhaar.savePhoto(user.sub, side, c.buffer, c.type.mime);
    } catch (err) {
      if (err instanceof UnreadableImageError) throw new UnsupportedMediaTypeException(err.message);
      throw err;
    }
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  save(@CurrentUser() user: { sub: string }, @Body() body: { number?: unknown; consent?: unknown }) {
    return this.aadhaar.saveNumber(user.sub, body?.number, body?.consent);
  }
}
