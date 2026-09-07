import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SupportService } from './support.service.js';
import { CurrentUser, Roles } from '../common/decorators.js';
import { RolesGuard } from '../common/roles.guard.js';

@ApiTags('support')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('support/tickets')
export class SupportController {
  constructor(private supportService: SupportService) {}

  @Post()
  @Roles('customer', 'partner', 'staff', 'admin')
  create(
    @CurrentUser() user: { sub: string },
    @Body() body: { subject: string; description: string }
  ) {
    return this.supportService.create(user.sub, body.subject, body.description);
  }

  @Get()
  @Roles('customer', 'partner', 'staff', 'admin')
  list(@CurrentUser() user: { sub: string; role: string }, @Query('status') status?: string) {
    if (user.role === 'staff' || user.role === 'admin') {
      return this.supportService.listAll({ status });
    }
    return this.supportService.listByUser(user.sub);
  }

  @Patch(':id/status')
  @Roles('staff', 'admin')
  updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.supportService.updateStatus(id, body.status);
  }
}
