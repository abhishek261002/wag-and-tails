import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditLogService } from '../audit-log/audit-log.service.js';

// Full Aadhaar number and card photos, kept for verification (client decision, 25 Nov 2026).
// - The number is encrypted with AES-256-GCM (AADHAAR_ENC_KEY, 32 bytes hex) and never stored or logged in plain.
// - A keyed hash of the number (AADHAAR_HASH_PEPPER) makes one number usable by one partner account only.
// - The photos are encrypted files in STORAGE_PRIVATE_PATH, a folder the web server never serves.
// - Only the panel can read them back (reveal), and every reveal is written to the activity log.
// - Data of partners rejected more than RETAIN_DAYS ago is deleted automatically.

const RETAIN_DAYS = 180;
export type AadhaarSide = 'front' | 'back';
export interface PanelActor { sub: string; role: string; email?: string }

/** Verhoeff checksum: real Aadhaar numbers pass it, typos almost never do. */
const D = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]];
const P = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];
export function isValidAadhaar(n: string): boolean {
  if (!/^[2-9]\d{11}$/.test(n)) return false;
  let c = 0;
  const digits = n.split('').reverse().map(Number);
  digits.forEach((d, i) => { c = D[c]![P[i % 8]![d]!]!; });
  return c === 0;
}

function key(): Buffer {
  const hex = process.env['AADHAAR_ENC_KEY'] ?? '';
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new ServiceUnavailableException('Aadhaar storage is not set up on the server (AADHAAR_ENC_KEY).');
  return Buffer.from(hex, 'hex');
}

export function encrypt(plain: Buffer): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([Buffer.from('WTA1'), iv, c.getAuthTag(), body]);
}

export function decrypt(blob: Buffer): Buffer {
  if (blob.subarray(0, 4).toString() !== 'WTA1') throw new Error('Unknown format');
  const iv = blob.subarray(4, 16);
  const tag = blob.subarray(16, 32);
  const d = createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(blob.subarray(32)), d.final()]);
}

function numberHash(n: string): string {
  const pepper = process.env['AADHAAR_HASH_PEPPER'];
  if (!pepper || pepper.length < 16) throw new ServiceUnavailableException('Aadhaar storage is not set up on the server (AADHAAR_HASH_PEPPER).');
  return createHmac('sha256', pepper).update(`num:${n}`).digest('hex');
}

@Injectable()
export class AadhaarService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AadhaarService.name);
  private readonly dir = path.resolve(process.env['STORAGE_PRIVATE_PATH'] ?? './private-uploads');
  private timer: NodeJS.Timeout | null = null;

  constructor(private prisma: PrismaService, private audit: AuditLogService) {}

  onModuleInit() {
    if ((process.env['SCHEDULER_ENABLED'] ?? 'true') === 'false') return;
    this.timer = setInterval(() => void this.purgeOld(), 6 * 3600_000);
    setTimeout(() => void this.purgeOld(), 60_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private file(name: string) {
    const f = path.resolve(this.dir, name);
    if (path.dirname(f) !== this.dir) throw new Error('Bad file name');
    return f;
  }

  private remove(name: string | null | undefined) {
    if (!name) return;
    try { fs.unlinkSync(this.file(name)); } catch { /* already gone */ }
  }

  /** What the partner app shows: whether the details are needed and done. Never the number itself. */
  async status(partnerId: string) {
    const p = await this.prisma.partnerProfile.findUnique({
      where: { userId: partnerId },
      select: { aadhaarEnc: true, aadhaarFrontFile: true, aadhaarBackFile: true, aadhaarLast4: true, aadhaarDocsAt: true },
    });
    if (!p) throw new NotFoundException('Partner not found');
    return {
      done: !!(p.aadhaarEnc && p.aadhaarFrontFile && p.aadhaarBackFile),
      front: !!p.aadhaarFrontFile,
      back: !!p.aadhaarBackFile,
      numberSaved: !!p.aadhaarEnc,
      last4: p.aadhaarLast4,
      savedAt: p.aadhaarDocsAt,
    };
  }

  /** Stores one photo (already checked and compressed) encrypted, replacing the earlier one for that side. */
  async savePhoto(partnerId: string, side: AadhaarSide, buffer: Buffer, mimeType: string) {
    if (side !== 'front' && side !== 'back') throw new BadRequestException('side must be front or back');
    const p = await this.prisma.partnerProfile.findUnique({ where: { userId: partnerId }, select: { aadhaarFrontFile: true, aadhaarBackFile: true } });
    if (!p) throw new NotFoundException('Partner not found');
    fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const name = `aadhaar_${partnerId}_${side}_${randomBytes(8).toString('hex')}.${ext}.enc`;
    fs.writeFileSync(this.file(name), encrypt(buffer), { mode: 0o600 });
    const old = side === 'front' ? p.aadhaarFrontFile : p.aadhaarBackFile;
    await this.prisma.partnerProfile.update({
      where: { userId: partnerId },
      data: side === 'front' ? { aadhaarFrontFile: name } : { aadhaarBackFile: name },
    });
    this.remove(old);
    return this.status(partnerId);
  }

  /** Saves the number once both photos are there. It must pass the checksum and end in the DigiLocker digits. */
  async saveNumber(partnerId: string, raw: unknown, consent: unknown) {
    const n = String(raw ?? '').replace(/\s+/g, '');
    if (!isValidAadhaar(n)) throw new BadRequestException('That is not a valid Aadhaar number. Check the 12 digits on your card.');
    if (consent !== true) throw new BadRequestException('Please agree to keeping your Aadhaar details for verification.');
    const p = await this.prisma.partnerProfile.findUnique({ where: { userId: partnerId }, select: { aadhaarLast4: true, aadhaarFrontFile: true, aadhaarBackFile: true } });
    if (!p) throw new NotFoundException('Partner not found');
    if (!p.aadhaarFrontFile || !p.aadhaarBackFile) throw new BadRequestException('Add photos of the front and the back of your Aadhaar card first.');
    if (p.aadhaarLast4 && p.aadhaarLast4 !== n.slice(-4)) {
      throw new BadRequestException(`This number does not match the Aadhaar you verified with DigiLocker (ending ${p.aadhaarLast4}).`);
    }
    const hash = numberHash(n);
    const other = await this.prisma.partnerProfile.findFirst({ where: { aadhaarNumHash: hash, NOT: { userId: partnerId } }, select: { userId: true } });
    if (other) throw new ConflictException('This Aadhaar number is already used by another partner account.');
    await this.prisma.partnerProfile.update({
      where: { userId: partnerId },
      data: {
        aadhaarEnc: encrypt(Buffer.from(n)).toString('base64'),
        aadhaarNumHash: hash,
        aadhaarLast4: p.aadhaarLast4 ?? n.slice(-4),
        aadhaarDocsAt: new Date(),
        kycConsentAt: new Date(),
      },
    });
    return this.status(partnerId);
  }

  /** Panel only: the number and both photos, logged with who looked. */
  async reveal(partnerId: string, actor: PanelActor) {
    const p = await this.prisma.partnerProfile.findUnique({
      where: { userId: partnerId },
      select: { aadhaarEnc: true, aadhaarFrontFile: true, aadhaarBackFile: true, user: { select: { profile: { select: { firstName: true, lastName: true } } } } },
    });
    if (!p) throw new NotFoundException('Partner not found');
    const photo = (name: string | null) => {
      if (!name) return null;
      try {
        const buf = decrypt(fs.readFileSync(this.file(name)));
        const mime = name.includes('.png.') ? 'image/png' : name.includes('.webp.') ? 'image/webp' : 'image/jpeg';
        return `data:${mime};base64,${buf.toString('base64')}`;
      } catch (e) {
        this.logger.error(`Aadhaar photo unreadable for ${partnerId}: ${(e as Error).message}`);
        return null;
      }
    };
    const number = p.aadhaarEnc ? decrypt(Buffer.from(p.aadhaarEnc, 'base64')).toString() : null;
    await this.audit.log({ userId: actor.sub, userEmail: actor.email, userRole: actor.role, action: 'aadhaar_reveal', entity: 'partner', entityId: partnerId, changes: {} });
    return {
      number: number ? `${number.slice(0, 4)} ${number.slice(4, 8)} ${number.slice(8)}` : null,
      front: photo(p.aadhaarFrontFile),
      back: photo(p.aadhaarBackFile),
    };
  }

  /** Deletes the stored number and photos (the last 4 digits and the DigiLocker result stay). */
  async wipe(partnerId: string, actor: PanelActor | null, reason: string) {
    const p = await this.prisma.partnerProfile.findUnique({ where: { userId: partnerId }, select: { aadhaarFrontFile: true, aadhaarBackFile: true, aadhaarEnc: true } });
    if (!p) throw new NotFoundException('Partner not found');
    await this.prisma.partnerProfile.update({
      where: { userId: partnerId },
      data: { aadhaarEnc: null, aadhaarNumHash: null, aadhaarFrontFile: null, aadhaarBackFile: null, aadhaarDocsAt: null },
    });
    this.remove(p.aadhaarFrontFile);
    this.remove(p.aadhaarBackFile);
    if (actor) {
      await this.audit.log({ userId: actor.sub, userEmail: actor.email, userRole: actor.role, action: 'aadhaar_delete', entity: 'partner', entityId: partnerId, changes: { reason } });
    }
    return { ok: true };
  }

  /** Rejected more than RETAIN_DAYS ago: delete the stored Aadhaar. */
  async purgeOld() {
    try {
      const before = new Date(Date.now() - RETAIN_DAYS * 86400_000);
      const old = await this.prisma.partnerProfile.findMany({
        where: { status: 'rejected', rejectedAt: { lt: before }, OR: [{ aadhaarEnc: { not: null } }, { aadhaarFrontFile: { not: null } }, { aadhaarBackFile: { not: null } }] },
        select: { userId: true },
        take: 100,
      });
      for (const p of old) await this.wipe(p.userId, null, 'auto');
      if (old.length) this.logger.log(`Deleted stored Aadhaar of ${old.length} rejected partner(s)`);
    } catch (e) {
      this.logger.error(`Aadhaar clean-up failed: ${(e as Error).message}`);
    }
  }
}
