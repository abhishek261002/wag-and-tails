// Pet insurance quote requests: the customer form, and the staff/admin follow-up list. Shared by the API and apps.
// The client will confirm the final field list; options live here so the form and the panels stay in step.

export const INSURANCE_PLAN_TYPES = ['accident', 'comprehensive', 'not_sure'] as const;
export type InsurancePlanType = (typeof INSURANCE_PLAN_TYPES)[number];
export const INSURANCE_PLAN_LABEL: Record<InsurancePlanType, string> = {
  accident: 'Accident & injury only',
  comprehensive: 'Comprehensive (illness + accident)',
  not_sure: 'Not sure, help me choose',
};

export const INSURANCE_COVER_AMOUNTS = ['25000', '50000', '100000', 'not_sure'] as const;
export type InsuranceCoverAmount = (typeof INSURANCE_COVER_AMOUNTS)[number];
export const INSURANCE_COVER_LABEL: Record<InsuranceCoverAmount, string> = {
  '25000': '₹25,000',
  '50000': '₹50,000',
  '100000': '₹1,00,000',
  not_sure: 'Not sure',
};

export const INSURANCE_CALL_TIMES = ['morning', 'afternoon', 'evening', 'any'] as const;
export type InsuranceCallTime = (typeof INSURANCE_CALL_TIMES)[number];
export const INSURANCE_CALL_TIME_LABEL: Record<InsuranceCallTime, string> = {
  morning: 'Morning (9–12)',
  afternoon: 'Afternoon (12–4)',
  evening: 'Evening (4–8)',
  any: 'Any time',
};

export const INSURANCE_STATUSES = ['new', 'contacted', 'closed'] as const;
export type InsuranceRequestStatus = (typeof INSURANCE_STATUSES)[number];
export const INSURANCE_STATUS_LABEL: Record<InsuranceRequestStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  closed: 'Closed',
};

export interface InsuranceRequestInput {
  petId: string;
  ownerName: string;
  phone: string;
  email?: string | null;
  city: string;
  planType: InsurancePlanType;
  coverAmount: InsuranceCoverAmount;
  preExisting: boolean;
  preExistingDetails?: string | null;
  preferredCallTime: InsuranceCallTime;
  notes?: string | null;
  /** Must be true: the customer agrees to be called about insurance. */
  consent: boolean;
}

export interface PetInsuranceRequest {
  id: string;
  customerId: string;
  petId: string | null;
  petName: string;
  petSpecies: string;
  petBreed: string;
  petDateOfBirth: string | null;
  ownerName: string;
  phone: string;
  email: string | null;
  city: string;
  planType: InsurancePlanType;
  coverAmount: InsuranceCoverAmount;
  preExisting: boolean;
  preExistingDetails: string | null;
  preferredCallTime: InsuranceCallTime;
  notes: string | null;
  consentAt: string;
  status: InsuranceRequestStatus;
  staffNote: string | null;
  handledBy: string | null;
  handledAt: string | null;
  createdAt: string;
  updatedAt: string;
}
