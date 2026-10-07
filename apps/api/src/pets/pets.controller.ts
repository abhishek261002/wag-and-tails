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

  @Patch(':id/avatar')
  @Roles('customer')
  updateAvatar(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() body: { avatarUrl: string }
  ) {
    return this.petsService.updateAvatar(id, user.sub, body.avatarUrl);
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
    return this.petsService.addCareNote(id, body?.note, user.sub, user.role);
  }

  @Patch(':id/care-notes/:noteId')
  @Roles('customer', 'partner', 'staff', 'admin')
  updateCareNote(
    @Param('id') id: string,
    @Param('noteId') noteId: string,
    @Body() body: { note: string },
    @CurrentUser() user: { sub: string; role: string }
  ) {
    return this.petsService.updateCareNote(id, noteId, body?.note, user);
  }

  @Delete(':id/care-notes/:noteId')
  @Roles('customer', 'partner', 'staff', 'admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCareNote(
    @Param('id') id: string,
    @Param('noteId') noteId: string,
    @CurrentUser() user: { sub: string; role: string }
  ) {
    return this.petsService.deleteCareNote(id, noteId, user);
  }

  @Get(':id/grooming-history')
  @Roles('customer', 'staff', 'admin')
  groomingHistory(@Param('id') id: string, @CurrentUser() user: { sub: string; role: string }) {
    return this.petsService.groomingHistory(id, user);
  }

  @Get(':id/medical-records')
  @Roles('customer', 'partner', 'staff', 'admin')
  listMedicalRecords(@Param('id') id: string, @CurrentUser() user: { sub: string; role: string }) {
    return this.petsService.listMedicalRecords(id, user);
  }

  @Post(':id/medical-records')
  @Roles('customer')
  addMedicalRecord(@Param('id') id: string, @CurrentUser() user: { sub: string }, @Body() body: any) {
    return this.petsService.addMedicalRecord(id, user.sub, body);
  }

  @Patch(':id/medical-records/:recordId')
  @Roles('customer')
  updateMedicalRecord(@Param('id') id: string, @Param('recordId') recordId: string, @CurrentUser() user: { sub: string }, @Body() body: any) {
    return this.petsService.updateMedicalRecord(id, recordId, user.sub, body);
  }

  @Delete(':id/medical-records/:recordId')
  @Roles('customer')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMedicalRecord(@Param('id') id: string, @Param('recordId') recordId: string, @CurrentUser() user: { sub: string }) {
    return this.petsService.deleteMedicalRecord(id, recordId, user.sub);
  }

  @Delete(':id/vaccinations/:vaccinationId')
  @Roles('customer')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteVaccination(@Param('id') id: string, @Param('vaccinationId') vaccinationId: string, @CurrentUser() user: { sub: string }) {
    return this.petsService.deleteVaccination(id, vaccinationId, user.sub);
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
