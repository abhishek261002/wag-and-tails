import { Body, Controller, Get, HttpCode, Logger, Post, Query, Req, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { verifyWpSignature } from './wp-sign.js';
import { WpIngestService } from './wp-ingest.service.js';
import { WpDeskService } from './wp-desk.service.js';
import { WpError } from './wp-client.service.js';

// Calls from the WordPress plugin (server to server), all signed with WT_CONNECTOR_SECRET = WP_CONNECTOR_SECRET.
//   POST /api/v1/connector/events          "a booking / lead changed" (the plugin's WT_CONNECTOR_URL)
//   GET  /api/v1/connector/desk/partners   partners for the desk's "Assign groomer" list
//   POST /api/v1/connector/desk/assign     assign or change the partner
//   POST /api/v1/connector/desk/unassign   take the partner off
//   GET  /api/v1/connector/desk/live       today's jobs and partner positions (desk map)

const seen = new Map<string, number>(); // nonce → expiry (replay protection within the 5-minute window)

export function checkSigned(req: any) {
  const secret = process.env['WP_CONNECTOR_SECRET'] ?? '';
  const raw = req.rawBody ? Buffer.from(req.rawBody).toString('utf8') : '';
  const path = String(req.url ?? req.raw?.url ?? '');
  const h = req.headers ?? {};
  const ok = verifyWpSignature(secret, { ts: h['x-wt-timestamp'], nonce: h['x-wt-nonce'], sig: h['x-wt-signature'] }, req.method, path, raw);
  if (!ok) throw new UnauthorizedException('Bad or missing signature');
  const now = Date.now();
  for (const [n, exp] of seen) if (exp < now) seen.delete(n);
  const nonce = String(h['x-wt-nonce']);
  if (seen.has(nonce)) throw new UnauthorizedException('Request already used');
  seen.set(nonce, now + 10 * 60_000);
}

@ApiExcludeController()
@SkipThrottle()
@Controller('connector')
export class WpConnectorController {
  private readonly logger = new Logger(WpConnectorController.name);

  constructor(private ingest: WpIngestService, private desk: WpDeskService) {}

  @Post('events')
  @HttpCode(200)
  async events(@Req() req: any, @Body() body: { type?: string; ref?: string; op?: string; fromApp?: boolean }) {
    checkSigned(req);
    try {
      const r = await this.ingest.handleEvent(body ?? {});
      return { ok: true, ...(r as object) };
    } catch (e) {
      this.logger.warn(`Event ${body?.type} ${body?.ref} failed: ${(e as Error).message}`);
      // The booking is gone from the website (deleted before we looked): nothing to do, and retrying cannot help.
      if (e instanceof WpError && e.status === 404) return { ok: true, ignored: 'not found on the website' };
      // Anything else: tell the plugin to try again later (it retries with backoff; the 2-minute poll also catches up).
      throw new ServiceUnavailableException('Could not process the event right now');
    }
  }

  @Get('desk/partners')
  partners(@Req() req: any, @Query('ref') ref: string) {
    checkSigned(req);
    return this.desk.candidates(String(ref ?? ''));
  }

  @Post('desk/assign')
  @HttpCode(200)
  assign(@Req() req: any, @Body() body: { ref?: string; partnerId?: string; by?: string }) {
    checkSigned(req);
    return this.desk.assign(String(body?.ref ?? ''), String(body?.partnerId ?? ''), String(body?.by ?? 'desk').slice(0, 60));
  }

  @Post('desk/unassign')
  @HttpCode(200)
  unassign(@Req() req: any, @Body() body: { ref?: string; by?: string }) {
    checkSigned(req);
    return this.desk.unassign(String(body?.ref ?? ''), String(body?.by ?? 'desk').slice(0, 60));
  }

  @Get('desk/live')
  live(@Req() req: any, @Query('city') city?: string) {
    checkSigned(req);
    return this.desk.live(city || undefined);
  }
}
