import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, Res, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { CatalogImportService, type Actor } from './catalog-import.service.js';
import { MAX_IMPORT_BYTES } from './catalog-rows.js';
import { CurrentUser, Roles } from '../common/decorators.js';
import { RolesGuard } from '../common/roles.guard.js';

const fmt = (f?: string): 'xlsx' | 'csv' => (f === 'csv' ? 'csv' : 'xlsx');

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
@Controller('admin/catalog')
export class CatalogImportController {
  constructor(private svc: CatalogImportService) {}

  @Get('template')
  async template(@Query('format') format: string | undefined, @Res() reply: FastifyReply) {
    const f = await this.svc.template(fmt(format));
    return reply.header('Content-Type', f.mime).header('Content-Disposition', `attachment; filename="${f.filename}"`).send(f.buffer);
  }

  @Get('export')
  async export(@Query('format') format: string | undefined, @Res() reply: FastifyReply) {
    const f = await this.svc.export(fmt(format));
    return reply.header('Content-Type', f.mime).header('Content-Disposition', `attachment; filename="${f.filename}"`).send(f.buffer);
  }

  // multipart/form-data with one "file" part. Nothing is saved; the response is a preview to confirm.
  @Post('imports')
  @ApiConsumes('multipart/form-data')
  async preview(@Req() req: FastifyRequest, @CurrentUser() user: Actor, @Query('mode') mode?: string) {
    // A request that is not multipart makes the parser throw a 406; report it as a plain bad request.
    const part = await (req as any).file?.({ limits: { fileSize: MAX_IMPORT_BYTES, files: 1 } }).catch(() => null);
    if (!part) throw new BadRequestException('Choose a .csv or .xlsx file to upload.');
    const chunks: Buffer[] = [];
    for await (const chunk of part.file) chunks.push(chunk as Buffer);
    if (part.file.truncated) throw new BadRequestException(`The file is larger than ${MAX_IMPORT_BYTES / 1024 / 1024} MB.`);
    return this.svc.preview(user, { buffer: Buffer.concat(chunks), filename: String(part.filename ?? 'upload') }, mode);
  }

  @Get('imports/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.get(id);
  }

  @Post('imports/:id/commit')
  @HttpCode(200)
  commit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: Actor, @Body() body: { skipInvalid?: boolean }) {
    return this.svc.commit(user, id, { skipInvalid: body?.skipInvalid });
  }

  @Delete('imports/:id')
  @HttpCode(200)
  discard(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.discard(id);
  }
}
