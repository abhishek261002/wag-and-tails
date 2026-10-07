// A pet's medical history entries (vaccinations are separate). Shared by the API and the customer app.

export const MEDICAL_RECORD_TYPES = ['checkup', 'illness', 'surgery', 'medication', 'allergy', 'other'] as const;
export type MedicalRecordType = (typeof MEDICAL_RECORD_TYPES)[number];

export const MEDICAL_RECORD_LABEL: Record<MedicalRecordType, string> = {
  checkup: 'Check-up',
  illness: 'Illness',
  surgery: 'Surgery',
  medication: 'Medicine',
  allergy: 'Allergy',
  other: 'Other',
};

export interface PetMedicalRecord {
  id: string;
  petId: string;
  type: MedicalRecordType;
  title: string;
  /** YYYY-MM-DD */
  recordDate: string;
  notes: string | null;
  vetName: string | null;
  /** YYYY-MM-DD; a check-up reminder is sent before this date. */
  followUpDate: string | null;
  createdAt: string;
}

export interface MedicalRecordInput {
  type: MedicalRecordType;
  title: string;
  recordDate: string;
  notes?: string | null;
  vetName?: string | null;
  followUpDate?: string | null;
}

/** How far ahead a follow-up may be set. */
export const MAX_FOLLOW_UP_YEARS = 5;
