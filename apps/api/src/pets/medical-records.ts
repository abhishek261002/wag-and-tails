import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { MAX_FOLLOW_UP_YEARS, MEDICAL_RECORD_TYPES } from '../common/medical.js';
import { addDays, todayIst } from './pet.schemas.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const realDate = (v: string) => {
  if (!ISO_DATE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};
const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} can be up to ${max} characters`).nullish().transform((v) => (v ? v : null));

const recordSchema = z.object({
  type: z.enum(MEDICAL_RECORD_TYPES, { errorMap: () => ({ message: 'Choose a record type' }) }),
  title: z.string().trim().min(2, 'Please describe the record').max(120, 'Title can be up to 120 characters'),
  recordDate: z.string().refine(realDate, 'Please choose a valid date'),
  notes: optionalText(1000, 'Notes'),
  vetName: optionalText(100, 'Vet name'),
  followUpDate: z.string().refine(realDate, 'Please choose a valid follow-up date').nullish().transform((v) => v ?? null),
});

export type MedicalRecordData = z.infer<typeof recordSchema>;

/** Validates a medical record (for create) or the changed fields of one (for update, with `existing`). */
export function parseMedicalRecord(body: unknown, existing?: { type: string; title: string; recordDate: string; notes: string | null; vetName: string | null; followUpDate: string | null }): MedicalRecordData {
  const input = existing ? { ...existing, ...(typeof body === 'object' && body ? body : {}) } : body;
  const parsed = recordSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    throw new BadRequestException(`${issue.path.join('.') || 'body'}: ${issue.message}`);
  }
  const r = parsed.data;
  const today = todayIst();
  if (r.recordDate > today) throw new BadRequestException('recordDate: cannot be in the future');
  if (r.recordDate < addDays(today, -365 * 30)) throw new BadRequestException('recordDate: too far in the past');
  if (r.followUpDate) {
    if (r.followUpDate < r.recordDate) throw new BadRequestException('followUpDate: cannot be before the record date');
    if (r.followUpDate > addDays(today, 365 * MAX_FOLLOW_UP_YEARS)) throw new BadRequestException(`followUpDate: can be at most ${MAX_FOLLOW_UP_YEARS} years ahead`);
  }
  return r;
}

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** The API shape: dates as YYYY-MM-DD, no internal fields. */
export function presentRecord(r: { id: string; petId: string; type: string; title: string; recordDate: Date; notes: string | null; vetName: string | null; followUpDate: Date | null; createdAt: Date }) {
  return {
    id: r.id, petId: r.petId, type: r.type, title: r.title, recordDate: iso(r.recordDate)!, notes: r.notes,
    vetName: r.vetName, followUpDate: iso(r.followUpDate), createdAt: r.createdAt.toISOString(),
  };
}
