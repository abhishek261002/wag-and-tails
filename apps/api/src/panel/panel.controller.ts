import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { checkSigned } from '../wp/wp-connector.controller.js';
import { PanelService, type PanelCaller } from './panel.service.js';
import { WpConfigSyncService } from '../wp/wp-config-sync.service.js';
import { WpOutboxService } from '../wp/wp-outbox.service.js';
import { WpStoreService } from '../wp/wp-store.service.js';

// The website plugin's panel pages (Partners, Partner money, Support, dashboard, customers, activity).
// Server to server only: every call is signed with the connector secret (checkSigned), so a browser can never reach
// these. The plugin decides who may call what from the WordPress login and passes the person's name and role:
//   GET  query ?by=&role=        POST body { by, role, ... }

function caller(src: Record<string, unknown> | undefined): PanelCaller {
  const by = String(src?.['by'] ?? '').trim().slice(0, 80);
  const role = src?.['role'];
  if (!by || (role !== 'admin' && role !== 'staff')) throw new BadRequestException('by and role (admin | staff) are required');
  return { by, role };
}

@ApiExcludeController()
@SkipThrottle()
@Controller('connector/panel')
export class PanelController {
  constructor(private panel: PanelService, private sync: WpConfigSyncService, private outbox: WpOutboxService, private store: WpStoreService) {}

  /** Is the link healthy: last price-list copy, writes waiting or failed. Owner only (the plugin checks the role). */
  @Get('system')
  async system(@Req() req: any) {
    checkSigned(req);
    return { sync: await this.sync.status(), outbox: await this.outbox.summary(), partnerDiscountPct: await this.store.partnerPct() };
  }

  @Post('system/:action')
  @HttpCode(200)
  async systemAction(@Req() req: any, @Param('action') action: string, @Body() b: Record<string, unknown>) {
    checkSigned(req);
    caller(b);
    if (action === 'sync') return this.sync.sync('panel', true);
    if (action === 'store-sync') return this.store.syncCatalog();
    if (action === 'retry' && typeof b['id'] === 'string' && /^[0-9a-f-]{36}$/i.test(b['id'])) return this.outbox.retry(b['id']);
    throw new BadRequestException('Unknown action');
  }

  @Get('overview')
  overview(@Req() req: any) {
    checkSigned(req);
    return this.panel.overview();
  }

  @Get('partners')
  partners(@Req() req: any, @Query() q: Record<string, string>) {
    checkSigned(req);
    return this.panel.listPartners(q);
  }

  @Get('partners/:id')
  partner(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    checkSigned(req);
    return this.panel.partner(id);
  }

  @Post('partners/:id/:action')
  @HttpCode(200)
  async partnerAction(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Param('action') action: string, @Body() b: Record<string, unknown>) {
    checkSigned(req);
    const c = caller(b);
    switch (action) {
      case 'approve': return this.panel.approve(c, id, b);
      case 'reject': return this.panel.reject(c, id, b['reason']);
      case 'suspend': return this.panel.suspend(c, id, b['reason']);
      case 'reactivate': return this.panel.reactivate(c, id);
      case 'type': return this.panel.setType(c, id, b['employmentType']);
      case 'city': return this.panel.setCity(c, id, b['city']);
      case 'aadhaar-reveal': return this.panel.revealAadhaar(c, id);
      case 'aadhaar-delete': return this.panel.deleteAadhaar(c, id, b['reason']);
      case 'commission': return this.panel.setCommission(c, id, pick(b, ['commissionPct', 'commissionLimitOverride']));
      case 'discount': return this.panel.addDiscount(c, id, pick(b, ['percent', 'startsAt', 'endsAt', 'note']));
      case 'dues-offline': return this.panel.duesOffline(c, id, pick(b, ['amount', 'note']));
      case 'dues-adjust': return this.panel.duesAdjust(c, id, pick(b, ['amount', 'note']));
      default: throw new BadRequestException('Unknown action');
    }
  }

  @Post('discounts/:id')
  @HttpCode(200)
  discount(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() b: Record<string, unknown>) {
    checkSigned(req);
    return this.panel.updateDiscount(caller(b), id, pick(b, ['percent', 'startsAt', 'endsAt', 'note', 'status']));
  }

  @Get('money/settings')
  moneySettings(@Req() req: any) {
    checkSigned(req);
    return this.panel.moneySettings();
  }

  @Post('money/settings')
  @HttpCode(200)
  setMoneySettings(@Req() req: any, @Body() b: Record<string, unknown>) {
    checkSigned(req);
    return this.panel.setMoneySettings(caller(b), pick(b, ['defaultCommissionPct', 'commissionLimit', 'maxPartnerDiscountPct']));
  }

  @Post('money/reconcile')
  @HttpCode(200)
  reconcile(@Req() req: any, @Body() b: Record<string, unknown>) {
    checkSigned(req);
    return this.panel.reconcile(caller(b));
  }

  @Get('payouts')
  payouts(@Req() req: any, @Query() q: Record<string, string>) {
    checkSigned(req);
    return this.panel.listPayouts(q);
  }

  @Post('payouts/batch')
  @HttpCode(200)
  batch(@Req() req: any, @Body() b: Record<string, unknown>) {
    checkSigned(req);
    return this.panel.createBatch(caller(b), b['payoutIds']);
  }

  @Post('payouts/batches/:id/paid')
  @HttpCode(200)
  paid(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() b: Record<string, unknown>) {
    checkSigned(req);
    return this.panel.markBatchPaid(caller(b), id, b['reference']);
  }

  @Get('tickets')
  tickets(@Req() req: any, @Query() q: Record<string, string>) {
    checkSigned(req);
    return this.panel.listTickets(q);
  }

  @Get('tickets/:id')
  ticket(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Query() q: Record<string, string>) {
    checkSigned(req);
    return this.panel.ticket(caller(q), id);
  }

  @Post('tickets/:id/:action')
  @HttpCode(200)
  ticketAction(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Param('action') action: string, @Body() b: Record<string, unknown>) {
    checkSigned(req);
    const c = caller(b);
    if (action === 'reply') return this.panel.reply(c, id, b['text']);
    if (action === 'status') return this.panel.ticketStatus(c, id, b['status']);
    if (action === 'escalate') return this.panel.escalate(c, id, b['reason']);
    throw new BadRequestException('Unknown action');
  }

  @Get('customer')
  customer(@Req() req: any, @Query('phone') phone: string) {
    checkSigned(req);
    return this.panel.customer(String(phone ?? ''));
  }

  @Get('activity')
  activity(@Req() req: any, @Query() q: Record<string, string>) {
    checkSigned(req);
    return this.panel.activity(q);
  }
}

function pick(b: Record<string, unknown>, keys: string[]) {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (b[k] !== undefined) out[k] = b[k];
  return out;
}
