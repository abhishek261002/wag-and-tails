import { PrismaService } from '../prisma/prisma.service.js';

// Anything that came from a person (pet notes, temperament, review comments…) is
// UNTRUSTED text that ends up inside the prompt, so it is flattened to one line,
// stripped of markup / role-like prefixes and length-capped before it is embedded.
export function clean(text: unknown, max = 300): string {
  return String(text ?? '')
    .replace(/[<>`]/g, '')
    .replace(/\b(system|assistant|human|user|model)\s*:/gi, '$1 -')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

const DAY_MS = 86_400_000;

function fmtDate(d: Date | null | undefined): string {
  return d ? new Date(d).toISOString().slice(0, 10) : 'unknown date';
}

function ageString(dob: Date | null): string {
  if (!dob) return 'unknown';
  const days = Math.floor((Date.now() - new Date(dob).getTime()) / DAY_MS);
  if (days < 0) return 'unknown';
  const years = Math.floor(days / 365.25);
  const months = Math.floor((days - years * 365.25) / 30.44);
  if (years === 0) return `${months} month${months === 1 ? '' : 's'}`;
  return months > 0 ? `${years} year${years === 1 ? '' : 's'} ${months} month${months === 1 ? '' : 's'}` : `${years} year${years === 1 ? '' : 's'}`;
}

export interface PetContext {
  text: string;
  petName: string;
  vetLine: string | null;
}

export async function buildPetContext(prisma: PrismaService, customerId: string, petId: string): Promise<PetContext | null> {
  const pet = await prisma.pet.findFirst({
    where: { id: petId, customerId },
    include: {
      careNotes: { orderBy: { createdAt: 'desc' }, take: 25 },
      vaccinations: { orderBy: { administeredDate: 'desc' }, take: 25 },
    },
  });
  if (!pet) return null;

  const bookings = await prisma.booking.findMany({
    where: { petId, customerId },
    orderBy: { scheduledAt: 'desc' },
    take: 40,
    select: {
      type: true,
      status: true,
      packageName: true,
      durationMinutes: true,
      scheduledAt: true,
      completedAt: true,
      notes: true,
      petCareNotes: true,
      beforePhotos: true,
      afterPhotos: true,
      checklistCompleted: true,
      addOns: { select: { name: true } },
      walkSession: { select: { durationSeconds: true, distanceMeters: true, photos: true } },
      review: { select: { rating: true, comment: true, revieweeType: true } },
    },
  });

  const now = Date.now();
  const completed = bookings.filter((b) => b.status === 'completed');
  const upcoming = bookings
    .filter((b) => b.scheduledAt && new Date(b.scheduledAt).getTime() > now && !['cancelled', 'refunded', 'expired', 'completed', 'draft'].includes(b.status))
    .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());

  const groomings = completed.filter((b) => b.type === 'grooming');
  const walks = completed.filter((b) => b.type === 'walking');
  const lastGroom = groomings[0]?.completedAt ?? groomings[0]?.scheduledAt ?? null;
  const lastWalk = walks[0]?.completedAt ?? walks[0]?.scheduledAt ?? null;
  const totalWalkKm = walks.reduce((s, w) => s + (w.walkSession?.distanceMeters ?? 0), 0) / 1000;
  const totalWalkMin = walks.reduce((s, w) => s + Math.round((w.walkSession?.durationSeconds ?? (w.durationMinutes ?? 0) * 60) / 60), 0);

  const daysSince = (d: Date | null) => (d ? Math.floor((now - new Date(d).getTime()) / DAY_MS) : null);

  const vaccineLines = pet.vaccinations.map((v) => {
    const expired = v.expiryDate && new Date(v.expiryDate).getTime() < now;
    const soon = v.expiryDate && !expired && new Date(v.expiryDate).getTime() - now < 30 * DAY_MS;
    const status = expired ? 'EXPIRED' : soon ? 'expires within 30 days' : v.expiryDate ? 'valid' : 'no expiry recorded';
    return `- ${clean(v.vaccineName, 80)}: given ${fmtDate(v.administeredDate)}${v.expiryDate ? `, expires ${fmtDate(v.expiryDate)}` : ''} (${status})${v.vetName ? `, by ${clean(v.vetName, 60)}` : ''}`;
  });

  const careNoteLines = pet.careNotes.map(
    (n) => `- [${fmtDate(n.createdAt)}, added by ${clean(n.addedByRole, 20)}] ${clean(n.note, 400)}`,
  );

  const groomingLines = groomings.slice(0, 10).map((b) => {
    const parts = [
      `- ${fmtDate(b.completedAt ?? b.scheduledAt)}: ${clean(b.packageName ?? 'Grooming', 80)}`,
      b.addOns.length ? `add-ons: ${b.addOns.map((a) => clean(a.name, 40)).join(', ')}` : '',
      b.checklistCompleted.length ? `steps done: ${b.checklistCompleted.map((c) => clean(c, 40)).join(', ')}` : '',
      b.afterPhotos.length ? `${b.afterPhotos.length} after-photo(s) taken` : '',
      b.notes ? `booking note: ${clean(b.notes, 200)}` : '',
      b.review?.comment ? `feedback (${b.review.revieweeType === 'customer' ? 'from the groomer' : 'from the owner'}, ${b.review.rating}/5): ${clean(b.review.comment, 200)}` : '',
    ].filter(Boolean);
    return parts.join(' | ');
  });

  const walkLines = walks.slice(0, 10).map((b) => {
    const ws = b.walkSession;
    const parts = [
      `- ${fmtDate(b.completedAt ?? b.scheduledAt)}: ${ws?.durationSeconds ? Math.round(ws.durationSeconds / 60) : b.durationMinutes ?? '?'} min walk`,
      ws?.distanceMeters ? `${(ws.distanceMeters / 1000).toFixed(2)} km` : '',
      ws?.photos.length ? `${ws.photos.length} photo(s)` : '',
      b.notes ? `booking note: ${clean(b.notes, 200)}` : '',
      b.review?.comment ? `feedback (${b.review.revieweeType === 'customer' ? 'from the walker' : 'from the owner'}, ${b.review.rating}/5): ${clean(b.review.comment, 200)}` : '',
    ].filter(Boolean);
    return parts.join(' | ');
  });

  const upcomingLines = upcoming.slice(0, 5).map(
    (b) => `- ${fmtDate(b.scheduledAt)}: ${b.type === 'grooming' ? clean(b.packageName ?? 'Grooming', 80) : `${b.durationMinutes ?? '?'} min walk`} (${b.status.replace(/_/g, ' ')})`,
  );

  const vetName = pet.vetDoctorName ? clean(pet.vetDoctorName, 60) : '';
  const vetLine = [vetName && (/^dr\.?\s/i.test(vetName) ? vetName : `Dr. ${vetName}`), pet.vetClinic && clean(pet.vetClinic, 80), pet.vetPhone && clean(pet.vetPhone, 30)]
    .filter(Boolean)
    .join(', ');

  const text = [
    `PROFILE`,
    `Name: ${clean(pet.name, 60)}`,
    `Breed: ${clean(pet.breed, 80)}`,
    `Sex: ${pet.sex}`,
    `Age: ${ageString(pet.dateOfBirth)}${pet.dateOfBirth ? ` (born ${fmtDate(pet.dateOfBirth)})` : ''}`,
    `Weight: ${pet.weightKg ? `${pet.weightKg} kg` : 'not recorded'}`,
    `Size: ${pet.size.replace(/_/g, ' ')}`,
    `Coat: ${pet.coatType}`,
    `Neutered/spayed: ${pet.isNeutered ? 'yes' : 'no'}`,
    `Temperament: ${clean(pet.temperament, 300) || 'not specified'}`,
    `Allergies: ${clean(pet.allergies, 300) || 'none recorded'}`,
    `Microchip: ${pet.microchip ? 'yes (on file)' : 'not recorded'}`,
    `Vet: ${vetLine || 'not recorded'}`,
    ``,
    `CARE NOTES FROM THE OWNER AND SERVICE PARTNERS (${pet.careNotes.length})`,
    careNoteLines.join('\n') || 'None.',
    ``,
    `VACCINATIONS (${pet.vaccinations.length})`,
    vaccineLines.join('\n') || 'None on record.',
    ``,
    `GROOMING HISTORY — ${groomings.length} completed${lastGroom ? `, last one ${daysSince(lastGroom)} days ago` : ', none yet'}`,
    groomingLines.join('\n') || 'No completed grooming sessions yet.',
    ``,
    `WALKING HISTORY — ${walks.length} completed, ${totalWalkMin} min and ${totalWalkKm.toFixed(1)} km in total${lastWalk ? `, last walk ${daysSince(lastWalk)} days ago` : ''}`,
    walkLines.join('\n') || 'No completed walks yet.',
    ``,
    `UPCOMING BOOKINGS`,
    upcomingLines.join('\n') || 'Nothing scheduled.',
    ``,
    `TODAY: ${fmtDate(new Date())}`,
  ].join('\n');

  return { text, petName: clean(pet.name, 60), vetLine: vetLine || null };
}
