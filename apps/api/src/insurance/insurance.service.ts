import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseOrThrow } from '../pets/pet.schemas.js';
import { INSURANCE_CALL_TIMES, INSURANCE_COVER_AMOUNTS, INSURANCE_PLAN_TYPES, INSURANCE_STATUSES } from '../common/insurance.js';

const MAX_REQUESTS_PER_DAY = 5;

const text = (max: number) => z.string().trim().max(max, `must be at most ${max} characters`);
const optionalText = (max: number) =>
  z.union([text(max), z.null()]).optional().transform((v) => (v ? v : null));

const createSchema = z.object({
  petId: z.string().uuid('choose one of your pets'),
  ownerName: text(120).min(2, 'enter your name').regex(/^[\p{L}][\p{L}\p{M} .'\-]*$/u, "can only contain letters, spaces and . ' -"),
  phone: z.string().trim().transform((v) => v.replace(/[\s-]/g, '')).pipe(z.string().regex(/^(\+91)?[6-9]\d{9}$/, 'enter a valid 10-digit mobile number')),
  email: z.union([z.string().trim().max(160).email('enter a valid email'), z.literal(''), z.null()]).optional().transform((v) => (v ? v.toLowerCase() : null)),
  city: text(60).min(2, 'enter your city'),
  planType: z.enum(INSURANCE_PLAN_TYPES),
  coverAmount: z.enum(INSURANCE_COVER_AMOUNTS),
  preExisting: z.boolean(),
  preExistingDetails: optionalText(1000),
  preferredCallTime: z.enum(INSURANCE_CALL_TIMES),
  notes: optionalText(1000),
  consent: z.literal(true, { errorMap: () => ({ message: 'please agree to be contacted about insurance' }) }),
}).strict().superRefine((v, ctx) => {
  if (v.preExisting && !v.preExistingDetails) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['preExistingDetails'], message: 'tell us about the condition' });
  }
});

const updateSchema = z.object({
  status: z.enum(INSURANCE_STATUSES).optional(),
  staffNote: z.union([text(2000), z.null()]).optional(),
}).strict().refine((v) => v.status !== undefined || v.staffNote !== undefined, { message: 'nothing to update' });

@Injectable()
export class InsuranceService {
  constructor(private prisma: PrismaService) {}

  /** A customer asks for a quote for one of their pets. One open request per pet; a few per day at most. */
  async create(customerId: string, body: unknown) {
    const dto = parseOrThrow(createSchema, body);
    const pet = await this.prisma.pet.findFirst({ where: { id: dto.petId, customerId, isActive: true } });
    if (!pet) throw new NotFoundException('Pet not found');

    const open = await this.prisma.petInsuranceRequest.findFirst({ where: { customerId, petId: pet.id, status: { not: 'closed' } } });
    if (open) throw new ConflictException(`We already have your insurance request for ${pet.name}. Our team will call you soon.`);

    const today = await this.prisma.petInsuranceRequest.count({ where: { customerId, createdAt: { gte: new Date(Date.now() - 86_400_000) } } });
    if (today >= MAX_REQUESTS_PER_DAY) throw new BadRequestException('Too many requests today. Please try again tomorrow.');

    const phone = dto.phone.startsWith('+91') ? dto.phone : `+91${dto.phone}`;
    return this.prisma.petInsuranceRequest.create({
      data: {
        ownerName: dto.ownerName!,
        email: dto.email ?? null,
        city: dto.city!,
        planType: dto.planType!,
        coverAmount: dto.coverAmount!,
        preExisting: dto.preExisting!,
        preExistingDetails: dto.preExisting ? dto.preExistingDetails ?? null : null,
        preferredCallTime: dto.preferredCallTime!,
        notes: dto.notes ?? null,
        phone,
        customerId,
        petId: pet.id,
        petName: pet.name,
        petSpecies: pet.species,
        petBreed: pet.breed,
        petDateOfBirth: pet.dateOfBirth,
        consentAt: new Date(),
      },
    });
  }

  listMine(customerId: string) {
    return this.prisma.petInsuranceRequest.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, petId: true, petName: true, planType: true, coverAmount: true, status: true, createdAt: true },
    });
  }

  /** Staff and admin follow-up list, newest first, optionally filtered by status or a search over name, phone, pet or city. */
  async listAll(q: { status?: string; search?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(q.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 20));
    if (q.status && !(INSURANCE_STATUSES as readonly string[]).includes(q.status)) throw new BadRequestException('Unknown status');
    const search = q.search?.trim();
    const where: Prisma.PetInsuranceRequestWhereInput = {
      ...(q.status ? { status: q.status as (typeof INSURANCE_STATUSES)[number] } : {}),
      ...(search
        ? { OR: ['ownerName', 'phone', 'petName', 'city', 'email'].map((f) => ({ [f]: { contains: search, mode: 'insensitive' } })) }
        : {}),
    };
    const [data, total, counts] = await Promise.all([
      this.prisma.petInsuranceRequest.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.petInsuranceRequest.count({ where }),
      this.prisma.petInsuranceRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const byStatus = Object.fromEntries(INSURANCE_STATUSES.map((s) => [s, counts.find((c) => c.status === s)?._count._all ?? 0]));
    return { data, total, page, pageSize, byStatus };
  }

  async update(id: string, staffId: string, body: unknown) {
    const dto = parseOrThrow(updateSchema, body);
    const existing = await this.prisma.petInsuranceRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Request not found');
    return this.prisma.petInsuranceRequest.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.staffNote !== undefined ? { staffNote: dto.staffNote || null } : {}),
        handledBy: staffId,
        handledAt: new Date(),
      },
    });
  }
}
