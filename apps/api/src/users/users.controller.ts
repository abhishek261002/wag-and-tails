import { Controller, Get, Patch, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service.js';
import { CurrentUser } from '../common/decorators.js';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  getProfile(@CurrentUser() user: { sub: string }) {
    return this.usersService.getProfile(user.sub);
  }

  @Patch('me')
  updateProfile(@CurrentUser() user: { sub: string }, @Body() body: any) {
    return this.usersService.updateProfile(user.sub, body);
  }

  @Post('me/addresses')
  addAddress(@CurrentUser() user: { sub: string }, @Body() body: any) {
    return this.usersService.addAddress(user.sub, body);
  }

  @Patch('me/addresses/:id')
  updateAddress(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body() body: any
  ) {
    return this.usersService.updateAddress(id, user.sub, body);
  }

  @Delete('me/addresses/:id')
  deleteAddress(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.usersService.deleteAddress(id, user.sub);
  }

  @Get('me/wallet')
  getWallet(@CurrentUser() user: { sub: string }) {
    return this.usersService.getWallet(user.sub);
  }
}
