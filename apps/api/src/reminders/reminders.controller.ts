import { BadRequestException, Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RemindersService } from './reminders.service.js';
import { Roles } from '../common/decorators.js';
import { RolesGuard } from '../common/roles.guard.js';

// Runs the scheduled jobs on demand (support and testing). The schedule itself runs them automatically.
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
@Controller('admin/reminders')
export class RemindersController {
  constructor(private reminders: RemindersService) {}

  @Post('run')
  @HttpCode(200)
  run(@Body() body: { job?: string; now?: string }) {
    let now = new Date();
    if (body?.now) {
      // Pretending it is another day is only for testing; never in production.
      if (process.env['NODE_ENV'] === 'production') throw new BadRequestException('now is not allowed in production');
      now = new Date(body.now);
      if (Number.isNaN(now.getTime())) throw new BadRequestException('now is not a valid date');
    }
    if (body?.job === 'daily') return this.reminders.runDaily(now);
    if (body?.job === 'frequent') return this.reminders.runFrequent(now);
    throw new BadRequestException('job must be "daily" or "frequent"');
  }
}
