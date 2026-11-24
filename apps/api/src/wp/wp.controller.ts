import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators.js';
import { RolesGuard } from '../common/roles.guard.js';
import { WpConfigSyncService } from './wp-config-sync.service.js';
import { WpOutboxService } from './wp-outbox.service.js';
import { WpIngestService } from './wp-ingest.service.js';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
@Controller('admin/wp')
export class WpController {
  constructor(private sync: WpConfigSyncService, private outbox: WpOutboxService, private ingest: WpIngestService) {}

  /** Is the website connected, when did the price list last sync, writes waiting or failed. */
  @Get('status')
  async status() { return { ...(await this.sync.status()), outbox: await this.outbox.summary() }; }

  /** Send a failed write to the website again. */
  @Post('outbox/:id/retry')
  retry(@Param('id') id: string) { return this.outbox.retry(id); }

  /** Fetch every booking changed on the website since the last check, now. */
  @Post('poll')
  poll() { return this.ingest.poll(); }

  /** The website's cities as last synced (including ones removed there, marked present=false). */
  @Get('cities')
  cities() { return this.sync.cities({ includeHidden: true }); }

  /** Pull the price list from the website now instead of waiting for the 5-minute schedule. */
  @Post('sync')
  syncNow() { return this.sync.sync('admin', true); }
}
