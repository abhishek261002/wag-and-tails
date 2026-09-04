import {
  Controller, Post, Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FilesService } from './files.service.js';
import { CurrentUser } from '../common/decorators.js';
import type { FastifyRequest } from 'fastify';

@ApiTags('files')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('files')
export class FilesController {
  constructor(private filesService: FilesService) {}

  /**
   * Upload a file. Uses Fastify multipart.
   * The client must POST multipart/form-data with fields:
   *   file   — the binary file
   *   entity — e.g. "booking", "pet"
   *   entityId — UUID of the parent entity
   */
  @Post('upload')
  @ApiConsumes('multipart/form-data')
  async upload(
    @Req() req: FastifyRequest,
    @CurrentUser() user: { sub: string },
  ) {
    // Fastify multipart processing
    const data = await (req as any).file?.() ?? null;

    if (!data) {
      return { error: 'No file uploaded' };
    }

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk as Buffer);
    }
    const buffer = Buffer.concat(chunks);

    const entity: string = (data.fields?.['entity']?.value as string) ?? 'unknown';
    const entityId: string = (data.fields?.['entityId']?.value as string) ?? 'unknown';

    const multerFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: data.filename ?? 'upload',
      encoding: data.encoding ?? '7bit',
      mimetype: data.mimetype ?? 'application/octet-stream',
      buffer,
      size: buffer.length,
      // The following are required by the type but unused by FilesService
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    return this.filesService.upload(multerFile, user.sub, entity, entityId);
  }
}
