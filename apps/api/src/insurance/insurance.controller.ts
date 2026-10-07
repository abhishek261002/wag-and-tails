import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InsuranceService } from './insurance.service.js';
import { CurrentUser, Roles } from '../common/decorators.js';
import { RolesGuard } from '../common/roles.guard.js';

@ApiTags('insurance')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('insurance')
export class InsuranceController {
  constructor(private insurance: InsuranceService) {}

  @Post('requests')
  @Roles('customer')
  create(@CurrentUser() user: { sub: string }, @Body() body: unknown) {
    return this.insurance.create(user.sub, body);
  }

  @Get('requests/mine')
  @Roles('customer')
  mine(@CurrentUser() user: { sub: string }) {
    return this.insurance.listMine(user.sub);
  }

  @Get('requests')
  @Roles('staff', 'admin')
  list(@Query() query: { status?: string; search?: string; page?: string; pageSize?: string }) {
    return this.insurance.listAll({ status: query.status, search: query.search, page: Number(query.page), pageSize: Number(query.pageSize) });
  }

  @Patch('requests/:id')
  @Roles('staff', 'admin')
  update(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: { sub: string }, @Body() body: unknown) {
    return this.insurance.update(id, user.sub, body);
  }
}
