import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, HttpCode, HttpStatus
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PetsService } from './pets.service.js';
import { CurrentUser, Roles } from '../common/decorators.js';
import { RolesGuard } from '../common/roles.guard.js';

@ApiTags('pets')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('pets')
export class PetsController {
  constructor(private petsService: PetsService) {}

  @Get()
  @Roles('customer')
  list(@CurrentUser() user: { sub: string }) {
    return this.petsService.listByCustomer(user.sub);
  }

  @Get(':id')
  @Roles('customer', 'partner', 'staff', 'admin')
  get(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string; role: string }
  ) {
    return this.petsService.getDetail(id, user.sub, user.role);
  }

  @Post()
  @Roles('customer')
  create(@CurrentUser() user: { sub: string }, @Body() body: any) {
    return this.petsService.create(user.sub, body);
  }

  @Patch(':id')
  @Roles('customer')
  update(@Param('id') id: string, @CurrentUser() user: { sub: string }, @Body() body: any) {
    return this.petsService.update(id, user.sub, body);
  }

  @Delete(':id')
  @Roles('customer')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.petsService.delete(id, user.sub);
  }

  @Post(':id/care-notes')
  @Roles('customer', 'partner', 'staff', 'admin')
  addCareNote(
    @Param('id') id: string,
    @Body() body: { note: string },
    @CurrentUser() user: { sub: string; role: string }
  ) {
    return this.petsService.addCareNote(id, body.note, user.sub, user.role);
  }

  @Post(':id/vaccinations')
  @Roles('customer')
  addVaccination(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() body: any
  ) {
    return this.petsService.addVaccination(id, user.sub, body);
  }
}
