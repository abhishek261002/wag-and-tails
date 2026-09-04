import {
  Controller, Post, UploadedFile, UseInterceptors,
  UseGuards, Body
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FilesService } from './files.service.js';
import { CurrentUser } from '../common/decorators.js';

@ApiTags('files')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('files')
export class FilesController {
  constructor(private filesService: FilesService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { sub: string },
    @Body() body: { entity: string; entityId: string }
  ) {
    return this.filesService.upload(file, user.sub, body.entity, body.entityId);
  }
}
