// Mock vets shown in "Our vets" until the client finalises doctor onboarding. Replace with an API list later.
export interface Vet {
  id: string;
  name: string;
  qualification: string;
  speciality: string;
  experienceYears: number;
  city: string;
  languages: string[];
  rating: number;
  consultFee: number;
}

export const MOCK_VETS: Vet[] = [
  { id: 'v1', name: 'Dr. Ananya Mishra', qualification: 'BVSc & AH, MVSc', speciality: 'General practice and vaccinations', experienceYears: 9, city: 'Lucknow', languages: ['Hindi', 'English'], rating: 4.9, consultFee: 499 },
  { id: 'v2', name: 'Dr. Rohit Saxena', qualification: 'BVSc & AH', speciality: 'Skin and coat problems', experienceYears: 7, city: 'Kanpur', languages: ['Hindi', 'English'], rating: 4.8, consultFee: 399 },
  { id: 'v3', name: 'Dr. Meera Kapoor', qualification: 'MVSc (Surgery)', speciality: 'Surgery and post-operative care', experienceYears: 12, city: 'Delhi', languages: ['Hindi', 'English', 'Punjabi'], rating: 4.9, consultFee: 699 },
  { id: 'v4', name: 'Dr. Arjun Verma', qualification: 'BVSc & AH', speciality: 'Nutrition and weight management', experienceYears: 5, city: 'Lucknow', languages: ['Hindi', 'English'], rating: 4.7, consultFee: 349 },
  { id: 'v5', name: 'Dr. Sana Qureshi', qualification: 'MVSc (Medicine)', speciality: 'Cats and feline medicine', experienceYears: 8, city: 'Delhi', languages: ['Hindi', 'English', 'Urdu'], rating: 4.8, consultFee: 549 },
  { id: 'v6', name: 'Dr. Vikram Singh', qualification: 'BVSc & AH', speciality: 'Behaviour and anxiety', experienceYears: 6, city: 'Kanpur', languages: ['Hindi', 'English'], rating: 4.6, consultFee: 449 },
];
