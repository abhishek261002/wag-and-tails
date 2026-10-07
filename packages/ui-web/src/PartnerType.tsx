import React from 'react';
import clsx from 'clsx';
import { Badge } from './Badge.js';
import { Button } from './Button.js';
import { Modal } from './Modal.js';

export type PartnerEmploymentType = 'team' | 'freelancer';
export type PartnerTypeFilter = '' | PartnerEmploymentType | 'unset';

export const PARTNER_TYPE_LABEL: Record<PartnerEmploymentType, string> = { team: 'My team', freelancer: 'Freelancer' };

/** Filter chips for the partners list: everyone, the company's own team, freelancers, or partners not yet sorted. */
export const PARTNER_TYPE_FILTERS: { v: PartnerTypeFilter; l: string }[] = [
  { v: '', l: 'All types' },
  { v: 'team', l: 'My team' },
  { v: 'freelancer', l: 'Freelancers' },
  { v: 'unset', l: 'Type not set' },
];

export function PartnerTypeBadge({ type }: { type: PartnerEmploymentType | null | undefined }) {
  if (!type) return <Badge variant="muted">Not set</Badge>;
  return <Badge variant={type === 'team' ? 'brand' : 'accent'}>{PARTNER_TYPE_LABEL[type]}</Badge>;
}

/** Two big choices, used when approving a partner and when changing their type later. */
export function PartnerTypePicker({ value, onChange, disabled }: { value: PartnerEmploymentType | null; onChange: (v: PartnerEmploymentType) => void; disabled?: boolean }) {
  const options: { v: PartnerEmploymentType; title: string; sub: string }[] = [
    { v: 'team', title: 'My team', sub: 'Works for us directly' },
    { v: 'freelancer', title: 'Freelancer', sub: 'Independent partner' },
  ];
  return (
    <div role="radiogroup" aria-label="Partner type" className="grid grid-cols-2 gap-2.5">
      {options.map((o) => {
        const on = value === o.v;
        return (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(o.v)}
            className={clsx(
              'text-left rounded-xl border-2 px-3.5 py-2.5 transition-colors disabled:opacity-50',
              on ? 'border-[#4A1E0B] bg-[#F9F1E9]' : 'border-[#EDE4D9] bg-white hover:border-[#D9C9B6]',
            )}
          >
            <span className="block font-bold text-sm text-[#1C1006]">{o.title}</span>
            <span className="block text-xs text-[#9A8878] mt-0.5">{o.sub}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Approving a partner always asks which list they belong to. */
export function ApprovePartnerModal({ open, name, loading, onClose, onConfirm }: {
  open: boolean;
  name: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (type: PartnerEmploymentType) => void;
}) {
  const [type, setType] = React.useState<PartnerEmploymentType | null>(null);
  React.useEffect(() => { if (open) setType(null); }, [open]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Approve ${name}`}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => type && onConfirm(type)} loading={loading} disabled={!type}>Approve</Button>
        </>
      }
    >
      <p className="text-sm text-[#6E5B4B] mb-3">Is this partner on your own team or a freelancer? You can change this later.</p>
      <PartnerTypePicker value={type} onChange={setType} />
    </Modal>
  );
}
