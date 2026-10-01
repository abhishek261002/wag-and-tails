/** "8 mo", "1 yr", "3 yr" for a pet's age; null when the birth date is missing or in the future. */
export function formatPetAge(dateOfBirth: string | Date | null | undefined, now: Date = new Date()): string | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (!Number.isFinite(dob.getTime()) || dob.getTime() > now.getTime()) return null;

  let months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
  if (now.getDate() < dob.getDate()) months -= 1; // has not had this month's birthday yet
  if (months < 0) months = 0;

  if (months < 1) return 'Under 1 mo';
  if (months < 12) return `${months} mo`;
  const years = Math.floor(months / 12);
  return `${years} yr`;
}
