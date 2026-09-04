/**
 * Wag & Tails — Database Seed
 * Matches prototype data: pets (Simba, Mochi, Rio), partners (Ritika, Aman, Neha, Karan),
 * packages, add-ons, walk pricing, store catalogue, customers, staff, admin.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Wag & Tails database...');

  // Guard: check if seed already ran (admin user exists)
  const existing = await prisma.user.findUnique({ where: { email: 'admin@wagandtails.in' } });
  if (existing) {
    console.log('⏭️  Database already seeded — skipping (delete DB or run prisma migrate reset to re-seed)');
    return;
  }

  // ── Passwords ──────────────────────────────────────────────────────────────
  const defaultHash = await bcrypt.hash('WagTails@123', 12);
  const partnerHash = await bcrypt.hash('Partner@123', 12);

  // ── Admin ──────────────────────────────────────────────────────────────────
  console.log('  Creating admin...');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@wagandtails.in' },
    update: {},
    create: {
      phone: '+911234567890',
      email: 'admin@wagandtails.in',
      passwordHash: defaultHash,
      role: 'admin',
      isActive: true,
      profile: {
        create: { firstName: 'Admin', lastName: 'Wag' },
      },
    },
  });

  // ── Staff ──────────────────────────────────────────────────────────────────
  console.log('  Creating staff...');
  const staff = await prisma.user.upsert({
    where: { email: 'staff@wagandtails.in' },
    update: {},
    create: {
      phone: '+911234567891',
      email: 'staff@wagandtails.in',
      passwordHash: defaultHash,
      role: 'staff',
      isActive: true,
      profile: {
        create: { firstName: 'Priya', lastName: 'Operations' },
      },
      staffProfile: { create: { permissions: ['bookings', 'orders', 'customers', 'partners'] } },
    },
  });

  // ── Customers ─────────────────────────────────────────────────────────────
  console.log('  Creating customers...');

  const customerArjun = await prisma.user.upsert({
    where: { phone: '+919876543210' },
    update: {},
    create: {
      phone: '+919876543210',
      email: 'arjun.mehta@example.com',
      role: 'customer',
      isActive: true,
      profile: {
        create: {
          firstName: 'Arjun',
          lastName: 'Mehta',
          dateOfBirth: new Date('1992-05-14'),
        },
      },
      customerProfile: { create: { walletBalance: 250 } },
    },
  });

  const customerSahana = await prisma.user.upsert({
    where: { phone: '+919876543211' },
    update: {},
    create: {
      phone: '+919876543211',
      email: 'sahana.k@example.com',
      role: 'customer',
      isActive: true,
      profile: {
        create: {
          firstName: 'Sahana',
          lastName: 'Krishnamurthy',
          dateOfBirth: new Date('1995-11-20'),
        },
      },
      customerProfile: { create: { walletBalance: 100 } },
    },
  });

  const customerRohan = await prisma.user.upsert({
    where: { phone: '+919876543212' },
    update: {},
    create: {
      phone: '+919876543212',
      email: 'rohan.v@example.com',
      role: 'customer',
      isActive: true,
      profile: {
        create: {
          firstName: 'Rohan',
          lastName: 'Verma',
          dateOfBirth: new Date('1988-03-08'),
        },
      },
      customerProfile: { create: {} },
    },
  });

  // ── Addresses ──────────────────────────────────────────────────────────────
  console.log('  Creating addresses...');

  const arjunAddress = await prisma.address.create({
    data: {
      userId: customerArjun.id,
      label: 'Home',
      line1: '14A Koramangala 5th Block',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560095',
      lat: 12.9352,
      lng: 77.6244,
      isDefault: true,
    },
  });

  const sahanaAddress = await prisma.address.create({
    data: {
      userId: customerSahana.id,
      label: 'Home',
      line1: '22 Indiranagar 12th Main',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560038',
      lat: 12.9784,
      lng: 77.6408,
      isDefault: true,
    },
  });

  const rohanAddress = await prisma.address.create({
    data: {
      userId: customerRohan.id,
      label: 'Home',
      line1: '7 HSR Layout Sector 2',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560102',
      lat: 12.9116,
      lng: 77.6389,
      isDefault: true,
    },
  });

  // ── Pets ───────────────────────────────────────────────────────────────────
  console.log('  Creating pets (Simba, Mochi, Rio)...');

  const simba = await prisma.pet.create({
    data: {
      customerId: customerArjun.id,
      name: 'Simba',
      breed: 'Golden Retriever',
      sex: 'male',
      dateOfBirth: new Date('2020-06-15'),
      weightKg: 28.5,
      size: 'large',
      coatType: 'long',
      isNeutered: true,
      temperament: 'Gentle and playful. Loves water. Gets anxious with strangers initially but warms up quickly.',
      allergies: 'Sensitive to chicken-based food. Mild reaction to certain shampoos — use hypoallergenic only.',
      vetDoctorName: 'Dr. Pradeep Nair',
      vetClinic: 'PetCare Veterinary Clinic, Koramangala',
      vetPhone: '+918022334455',
      careNotes: {
        create: [
          {
            note: 'Simba had a hot spot near his left ear last month. Cleared with medicated wash. Please check during grooming.',
            addedBy: customerArjun.id,
            addedByRole: 'customer',
          },
          {
            note: 'Use only lavender-free shampoo. He had a mild skin reaction to lavender products.',
            addedBy: customerArjun.id,
            addedByRole: 'customer',
          },
        ],
      },
      vaccinations: {
        create: [
          {
            vaccineName: 'DHPPiL (5-in-1)',
            administeredDate: new Date('2024-01-10'),
            expiryDate: new Date('2025-01-10'),
            vetName: 'Dr. Pradeep Nair',
          },
          {
            vaccineName: 'Rabies',
            administeredDate: new Date('2024-01-10'),
            expiryDate: new Date('2027-01-10'),
            vetName: 'Dr. Pradeep Nair',
          },
          {
            vaccineName: 'Kennel Cough (Bordetella)',
            administeredDate: new Date('2024-03-20'),
            expiryDate: new Date('2025-03-20'),
            vetName: 'Dr. Pradeep Nair',
          },
        ],
      },
    },
  });

  const mochi = await prisma.pet.create({
    data: {
      customerId: customerSahana.id,
      name: 'Mochi',
      breed: 'Shih Tzu',
      sex: 'female',
      dateOfBirth: new Date('2021-09-03'),
      weightKg: 5.2,
      size: 'small',
      coatType: 'long',
      isNeutered: false,
      temperament: 'Very social and friendly. Loves cuddles. Can get snappy if grooming takes too long.',
      allergies: 'No known allergies.',
      vetDoctorName: 'Dr. Asha Iyer',
      vetClinic: 'Happy Paws Clinic, Indiranagar',
      vetPhone: '+918044556677',
      careNotes: {
        create: [
          {
            note: 'Mochi has long coat — take breaks during grooming. She gets stressed after 45 min.',
            addedBy: customerSahana.id,
            addedByRole: 'customer',
          },
          {
            note: 'Trim paw fur short — she slips on tile floors.',
            addedBy: customerSahana.id,
            addedByRole: 'customer',
          },
        ],
      },
      vaccinations: {
        create: [
          {
            vaccineName: 'DHPPiL (5-in-1)',
            administeredDate: new Date('2024-02-15'),
            expiryDate: new Date('2025-02-15'),
            vetName: 'Dr. Asha Iyer',
          },
          {
            vaccineName: 'Rabies',
            administeredDate: new Date('2024-02-15'),
            expiryDate: new Date('2027-02-15'),
            vetName: 'Dr. Asha Iyer',
          },
        ],
      },
    },
  });

  const rio = await prisma.pet.create({
    data: {
      customerId: customerRohan.id,
      name: 'Rio',
      breed: 'Beagle',
      sex: 'male',
      dateOfBirth: new Date('2019-12-01'),
      weightKg: 11.0,
      size: 'medium',
      coatType: 'short',
      isNeutered: true,
      temperament: 'Energetic and curious. Nose-driven — needs a leash at all times during walks.',
      allergies: 'Grain-sensitive. Feed only grain-free food.',
      vetDoctorName: 'Dr. Vinod Shetty',
      vetClinic: 'City Animal Hospital, HSR Layout',
      vetPhone: '+918066778899',
      careNotes: {
        create: [
          {
            note: 'Rio has a tendency to chew his leash. Please use the provided slip-lead.',
            addedBy: customerRohan.id,
            addedByRole: 'customer',
          },
        ],
      },
      vaccinations: {
        create: [
          {
            vaccineName: 'DHPPiL (5-in-1)',
            administeredDate: new Date('2024-03-05'),
            expiryDate: new Date('2025-03-05'),
            vetName: 'Dr. Vinod Shetty',
          },
          {
            vaccineName: 'Rabies',
            administeredDate: new Date('2024-03-05'),
            expiryDate: new Date('2027-03-05'),
            vetName: 'Dr. Vinod Shetty',
          },
        ],
      },
    },
  });

  // ── Partners ───────────────────────────────────────────────────────────────
  console.log('  Creating partners (Ritika, Aman, Neha, Karan)...');

  const partnerRitika = await prisma.user.upsert({
    where: { phone: '+919900001111' },
    update: {},
    create: {
      phone: '+919900001111',
      email: 'ritika.sharma@wagpartner.in',
      passwordHash: partnerHash,
      role: 'partner',
      isActive: true,
      profile: {
        create: { firstName: 'Ritika', lastName: 'Sharma' },
      },
      partnerProfile: {
        create: {
          status: 'approved',
          modes: ['grooming'],
          serviceRadiusKm: 8,
          isOnline: true,
          currentLat: 12.9352,
          currentLng: 77.6244,
          bio: '5+ years of professional grooming experience. Certified dog groomer. Specialises in long-coat breeds.',
          rating: 4.9,
          reviewCount: 128,
          completedJobs: 340,
          availability: {
            create: [
              { day: 'mon', startTime: '09:00', endTime: '18:00' },
              { day: 'tue', startTime: '09:00', endTime: '18:00' },
              { day: 'wed', startTime: '09:00', endTime: '18:00' },
              { day: 'thu', startTime: '09:00', endTime: '18:00' },
              { day: 'fri', startTime: '09:00', endTime: '18:00' },
              { day: 'sat', startTime: '09:00', endTime: '15:00' },
            ],
          },
        },
      },
    },
  });

  const partnerAman = await prisma.user.upsert({
    where: { phone: '+919900002222' },
    update: {},
    create: {
      phone: '+919900002222',
      email: 'aman.verma@wagpartner.in',
      passwordHash: partnerHash,
      role: 'partner',
      isActive: true,
      profile: {
        create: { firstName: 'Aman', lastName: 'Verma' },
      },
      partnerProfile: {
        create: {
          status: 'approved',
          modes: ['walking', 'grooming'],
          serviceRadiusKm: 10,
          isOnline: true,
          currentLat: 12.9784,
          currentLng: 77.6408,
          bio: 'Dog walker and groomer. Former vet tech. Comfortable with all breed sizes. CPR certified for pets.',
          rating: 4.8,
          reviewCount: 95,
          completedJobs: 220,
          availability: {
            create: [
              { day: 'mon', startTime: '07:00', endTime: '20:00' },
              { day: 'tue', startTime: '07:00', endTime: '20:00' },
              { day: 'wed', startTime: '07:00', endTime: '20:00' },
              { day: 'thu', startTime: '07:00', endTime: '20:00' },
              { day: 'fri', startTime: '07:00', endTime: '20:00' },
              { day: 'sat', startTime: '08:00', endTime: '18:00' },
              { day: 'sun', startTime: '08:00', endTime: '14:00' },
            ],
          },
        },
      },
    },
  });

  const partnerNeha = await prisma.user.upsert({
    where: { phone: '+919900003333' },
    update: {},
    create: {
      phone: '+919900003333',
      email: 'neha.pillai@wagpartner.in',
      passwordHash: partnerHash,
      role: 'partner',
      isActive: true,
      profile: {
        create: { firstName: 'Neha', lastName: 'Pillai' },
      },
      partnerProfile: {
        create: {
          status: 'approved',
          modes: ['grooming'],
          serviceRadiusKm: 6,
          isOnline: false,
          currentLat: 12.9116,
          currentLng: 77.6389,
          bio: 'Expert in cat and small dog grooming. Works with anxious pets. Patient and gentle approach.',
          rating: 4.7,
          reviewCount: 67,
          completedJobs: 180,
          availability: {
            create: [
              { day: 'tue', startTime: '10:00', endTime: '18:00' },
              { day: 'wed', startTime: '10:00', endTime: '18:00' },
              { day: 'thu', startTime: '10:00', endTime: '18:00' },
              { day: 'fri', startTime: '10:00', endTime: '18:00' },
              { day: 'sat', startTime: '09:00', endTime: '17:00' },
            ],
          },
        },
      },
    },
  });

  const partnerKaran = await prisma.user.upsert({
    where: { phone: '+919900004444' },
    update: {},
    create: {
      phone: '+919900004444',
      email: 'karan.joshi@wagpartner.in',
      passwordHash: partnerHash,
      role: 'partner',
      isActive: true,
      profile: {
        create: { firstName: 'Karan', lastName: 'Joshi' },
      },
      partnerProfile: {
        create: {
          status: 'approved',
          modes: ['walking'],
          serviceRadiusKm: 12,
          isOnline: true,
          currentLat: 12.9716,
          currentLng: 77.5946,
          bio: 'Full-time professional dog walker. Run group and solo walks. Former marathon runner — your dog gets a real workout!',
          rating: 4.9,
          reviewCount: 156,
          completedJobs: 480,
          availability: {
            create: [
              { day: 'mon', startTime: '06:00', endTime: '21:00' },
              { day: 'tue', startTime: '06:00', endTime: '21:00' },
              { day: 'wed', startTime: '06:00', endTime: '21:00' },
              { day: 'thu', startTime: '06:00', endTime: '21:00' },
              { day: 'fri', startTime: '06:00', endTime: '21:00' },
              { day: 'sat', startTime: '06:00', endTime: '20:00' },
              { day: 'sun', startTime: '07:00', endTime: '17:00' },
            ],
          },
        },
      },
    },
  });

  // ── Grooming Packages ──────────────────────────────────────────────────────
  console.log('  Creating grooming packages...');

  const pkgBasic = await prisma.groomingPackage.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Basic',
      mrp: 1200,
      price: 999,
      description: 'Essential grooming for your pet. Perfect for a quick refresh.',
      items: {
        create: [
          { description: 'Bath with shampoo & conditioner', order: 0 },
          { description: 'Blow dry & brush out', order: 1 },
          { description: 'Nail trim', order: 2 },
          { description: 'Ear cleaning', order: 3 },
          { description: 'Cologne & bandana', order: 4 },
        ],
      },
    },
  });

  const pkgBathBasic = await prisma.groomingPackage.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Bath + Basic',
      mrp: 1800,
      price: 1299,
      description: 'Thorough bath with basic grooming. Great for regular maintenance.',
      items: {
        create: [
          { description: 'Deep cleansing bath with premium shampoo', order: 0 },
          { description: 'Conditioner treatment', order: 1 },
          { description: 'Blow dry & full brush out', order: 2 },
          { description: 'Nail trim & filing', order: 3 },
          { description: 'Ear cleaning & hair trim', order: 4 },
          { description: 'Teeth brushing', order: 5 },
          { description: 'Cologne & bandana', order: 6 },
        ],
      },
    },
  });

  const pkgStandard = await prisma.groomingPackage.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'Standard',
      mrp: 1800,
      price: 1399,
      description: 'Complete grooming session. Includes a full haircut.',
      items: {
        create: [
          { description: 'Breed-specific haircut & styling', order: 0 },
          { description: 'Deep cleansing bath', order: 1 },
          { description: 'Conditioner & blow dry', order: 2 },
          { description: 'Nail trim & filing', order: 3 },
          { description: 'Ear cleaning', order: 4 },
          { description: 'Paw pad trimming', order: 5 },
          { description: 'Teeth brushing', order: 6 },
          { description: 'Cologne, bow & bandana', order: 7 },
        ],
      },
    },
  });

  const pkgPremium = await prisma.groomingPackage.upsert({
    where: { id: '00000000-0000-0000-0000-000000000004' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000004',
      name: 'Premium',
      mrp: 2499,
      price: 1699,
      description: 'Premium spa-level grooming with specialised treatments.',
      items: {
        create: [
          { description: 'Premium breed-specific cut & styling', order: 0 },
          { description: 'Spa bath with organic shampoo', order: 1 },
          { description: 'Deep conditioning mask', order: 2 },
          { description: 'Blow dry & coat finishing', order: 3 },
          { description: 'Nail trim, filing & paw massage', order: 4 },
          { description: 'Ear cleaning & plucking (if needed)', order: 5 },
          { description: 'Teeth brushing & breath freshener', order: 6 },
          { description: 'Blueberry facial scrub', order: 7 },
          { description: 'Cologne, bow & luxury bandana', order: 8 },
        ],
      },
    },
  });

  const pkgLuxury = await prisma.groomingPackage.upsert({
    where: { id: '00000000-0000-0000-0000-000000000005' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000005',
      name: 'Luxury',
      mrp: 3000,
      price: 2199,
      description: 'The ultimate 5-star grooming experience. Your pet deserves the best.',
      items: {
        create: [
          { description: 'Luxury breed-specific haircut & styling', order: 0 },
          { description: '2-stage spa bath with premium organic products', order: 1 },
          { description: 'Deep conditioning & coat repair treatment', order: 2 },
          { description: 'Professional blow dry & coat polish', order: 3 },
          { description: 'Nail trim, filing, grinding & paw butter', order: 4 },
          { description: 'Ear cleaning, plucking & rinse', order: 5 },
          { description: 'Full dental clean & breath freshener', order: 6 },
          { description: 'Blueberry facial & eye area clean', order: 7 },
          { description: 'Aromatherapy coat spritz', order: 8 },
          { description: 'Bow tie, bandana & keepsake paw print', order: 9 },
        ],
      },
    },
  });

  // ── Add-ons ────────────────────────────────────────────────────────────────
  console.log('  Creating add-ons...');

  await prisma.addOn.createMany({
    skipDuplicates: true,
    data: [
      { id: '00000000-0000-0000-0001-000000000001', name: 'Tick removal by hand', price: 300, description: 'Manual removal of ticks. Recommended for pets with tick infestation.' },
      { id: '00000000-0000-0000-0001-000000000002', name: 'De-matting', price: 300, description: 'Gentle de-matting for tangled or matted fur. Extra time included.' },
      { id: '00000000-0000-0000-0001-000000000003', name: 'Medicated bath', price: 300, description: 'Medicated shampoo bath for skin conditions, fungal issues, or vet-recommended treatment.' },
      { id: '00000000-0000-0000-0001-000000000004', name: 'Normal bath', price: 200, description: 'Additional bath with standard shampoo. Good for very dirty pets.' },
    ],
  });

  // ── Walk Pricing ───────────────────────────────────────────────────────────
  console.log('  Creating walk pricing...');

  await prisma.walkPricing.upsert({
    where: { durationMinutes: 30 },
    update: {},
    create: { durationMinutes: 30, price: 249 },
  });
  await prisma.walkPricing.upsert({
    where: { durationMinutes: 45 },
    update: {},
    create: { durationMinutes: 45, price: 349 },
  });
  await prisma.walkPricing.upsert({
    where: { durationMinutes: 60 },
    update: {},
    create: { durationMinutes: 60, price: 449 },
  });

  // ── Service Areas ──────────────────────────────────────────────────────────
  console.log('  Creating service areas...');

  await prisma.serviceArea.upsert({
    where: { id: '00000000-0000-0000-0002-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0002-000000000001',
      name: 'Bengaluru South',
      city: 'Bengaluru',
      neighborhoods: {
        create: [
          { name: 'Koramangala' },
          { name: 'Indiranagar' },
          { name: 'HSR Layout' },
          { name: 'BTM Layout' },
          { name: 'JP Nagar' },
          { name: 'Jayanagar' },
          { name: 'Bellandur' },
          { name: 'Sarjapur Road' },
        ],
      },
    },
  });

  // ── Coupons ────────────────────────────────────────────────────────────────
  console.log('  Creating coupons...');

  await prisma.coupon.createMany({
    skipDuplicates: true,
    data: [
      {
        code: 'WAGWELCOME',
        description: '₹200 off your first grooming booking',
        discountType: 'flat',
        discountValue: 200,
        minOrderValue: 500,
        applicableServices: ['grooming'],
        usageLimitTotal: 500,
        usageLimitPerUser: 1,
        validFrom: new Date('2026-01-01'),
        validUntil: new Date('2026-12-31'),
        isActive: true,
      },
      {
        code: 'WALKFIRST',
        description: '₹50 off your first dog walk',
        discountType: 'flat',
        discountValue: 50,
        applicableServices: ['walking'],
        usageLimitPerUser: 1,
        validFrom: new Date('2026-01-01'),
        validUntil: new Date('2026-12-31'),
        isActive: true,
      },
      {
        code: 'WAG10',
        description: '10% off all services (max ₹300)',
        discountType: 'percent',
        discountValue: 10,
        maxDiscount: 300,
        applicableServices: ['all'],
        usageLimitTotal: 1000,
        usageLimitPerUser: 3,
        validFrom: new Date('2026-01-01'),
        validUntil: new Date('2026-12-31'),
        isActive: true,
      },
      {
        code: 'PETSTORE15',
        description: '15% off store orders (max ₹500)',
        discountType: 'percent',
        discountValue: 15,
        maxDiscount: 500,
        minOrderValue: 599,
        applicableServices: ['store'],
        usageLimitTotal: 300,
        validFrom: new Date('2026-01-01'),
        validUntil: new Date('2026-12-31'),
        isActive: true,
      },
    ],
  });

  // ── Product Categories ─────────────────────────────────────────────────────
  console.log('  Creating store categories and products...');

  const [catGrooming, catFood, catHealth, catWalkGear, catToys] = await Promise.all([
    prisma.productCategory.upsert({
      where: { slug: 'grooming' },
      update: {},
      create: { name: 'Grooming', slug: 'grooming', displayOrder: 0 },
    }),
    prisma.productCategory.upsert({
      where: { slug: 'food-and-treats' },
      update: {},
      create: { name: 'Food & Treats', slug: 'food-and-treats', displayOrder: 1 },
    }),
    prisma.productCategory.upsert({
      where: { slug: 'health' },
      update: {},
      create: { name: 'Health', slug: 'health', displayOrder: 2 },
    }),
    prisma.productCategory.upsert({
      where: { slug: 'walk-gear' },
      update: {},
      create: { name: 'Walk Gear', slug: 'walk-gear', displayOrder: 3 },
    }),
    prisma.productCategory.upsert({
      where: { slug: 'toys' },
      update: {},
      create: { name: 'Toys', slug: 'toys', displayOrder: 4 },
    }),
  ]);

  // Products
  const products = [
    {
      categoryId: catGrooming.id,
      name: 'TropiClean Whitening Shampoo',
      slug: 'tropicclean-whitening-shampoo',
      description: 'Brightens white and light-coloured coats. Made with botanical ingredients. Safe for all breeds.',
      mrp: 850,
      retailPrice: 720,
      tradePrice: 580,
      rating: 4.6,
      reviewCount: 89,
      tags: ['shampoo', 'grooming', 'whitening'],
      allergyWarnings: [],
    },
    {
      categoryId: catGrooming.id,
      name: 'Chris Christensen Ice on Ice Detangler',
      slug: 'chris-christensen-ice-on-ice',
      description: 'Professional-grade detangling spray. Works on all coat types. Reduces grooming time significantly.',
      mrp: 1400,
      retailPrice: 1199,
      tradePrice: 950,
      rating: 4.8,
      reviewCount: 112,
      tags: ['detangler', 'spray', 'professional'],
      allergyWarnings: [],
    },
    {
      categoryId: catFood.id,
      name: 'Farmina N&D Grain-Free Chicken & Pomegranate',
      slug: 'farmina-nd-grain-free-chicken',
      description: 'High-protein grain-free dry food. No corn, wheat or soy. Suitable for adult dogs.',
      mrp: 2800,
      retailPrice: 2499,
      tradePrice: 2000,
      rating: 4.7,
      reviewCount: 234,
      tags: ['dry-food', 'grain-free', 'high-protein'],
      allergyWarnings: ['chicken'],
    },
    {
      categoryId: catFood.id,
      name: 'Zuke\'s Mini Naturals Training Treats',
      slug: 'zukes-mini-naturals-training-treats',
      description: 'Soft, bite-sized training treats. Only 2 calories each. Made with real chicken.',
      mrp: 699,
      retailPrice: 599,
      tradePrice: 479,
      rating: 4.9,
      reviewCount: 378,
      tags: ['treats', 'training', 'low-calorie'],
      allergyWarnings: ['chicken'],
    },
    {
      categoryId: catHealth.id,
      name: 'Himalaya Erina-EP Tick & Flea Shampoo',
      slug: 'himalaya-erina-ep-tick-flea-shampoo',
      description: 'Herbal anti-parasitic shampoo. Kills and repels ticks, fleas and lice. Gentle on skin.',
      mrp: 395,
      retailPrice: 349,
      tradePrice: 280,
      rating: 4.4,
      reviewCount: 567,
      tags: ['tick', 'flea', 'anti-parasitic', 'herbal'],
      allergyWarnings: [],
    },
    {
      categoryId: catHealth.id,
      name: 'Drools Absolute Calcium Bone',
      slug: 'drools-absolute-calcium-bone',
      description: 'Calcium-rich chew for healthy bones and teeth. Long-lasting. Suitable for all breeds.',
      mrp: 299,
      retailPrice: 249,
      tradePrice: 195,
      rating: 4.3,
      reviewCount: 189,
      tags: ['bone', 'calcium', 'dental', 'chew'],
      allergyWarnings: [],
    },
    {
      categoryId: catWalkGear.id,
      name: 'Ruffwear Front Range Harness',
      slug: 'ruffwear-front-range-harness',
      description: 'Everyday no-pull harness with dual leash attachment. Padded chest panel. Reflective trim.',
      mrp: 4500,
      retailPrice: 3999,
      tradePrice: 3200,
      rating: 4.8,
      reviewCount: 145,
      tags: ['harness', 'no-pull', 'reflective'],
      allergyWarnings: [],
    },
    {
      categoryId: catWalkGear.id,
      name: 'Flexi Classic Retractable Leash',
      slug: 'flexi-classic-retractable-leash',
      description: '5-metre retractable leash with braking system. Ergonomic grip. Available for small and medium dogs.',
      mrp: 1299,
      retailPrice: 1099,
      tradePrice: 875,
      rating: 4.5,
      reviewCount: 302,
      tags: ['leash', 'retractable', 'flexi'],
      allergyWarnings: [],
    },
    {
      categoryId: catToys.id,
      name: 'Kong Classic Red (Large)',
      slug: 'kong-classic-large',
      description: 'Durable rubber toy for mental stimulation. Stuff with treats or peanut butter. Vet recommended.',
      mrp: 950,
      retailPrice: 849,
      tradePrice: 680,
      rating: 4.9,
      reviewCount: 621,
      tags: ['kong', 'puzzle', 'chew', 'mental-stimulation'],
      allergyWarnings: [],
    },
    {
      categoryId: catToys.id,
      name: 'Outward Hound Squeaky Plush Fox',
      slug: 'outward-hound-squeaky-fox',
      description: 'Squeaky plush toy with reinforced stitching. Great for fetch and cuddle. Multiple sizes available.',
      mrp: 599,
      retailPrice: 499,
      tradePrice: 399,
      rating: 4.6,
      reviewCount: 156,
      tags: ['plush', 'squeaky', 'soft-toy'],
      allergyWarnings: [],
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: {},
      create: product,
    });
  }

  // ── Sample Bookings ────────────────────────────────────────────────────────
  console.log('  Creating sample bookings...');

  // Completed grooming booking for Simba
  const completedBooking = await prisma.booking.create({
    data: {
      type: 'grooming',
      status: 'completed',
      channel: 'app',
      customerId: customerArjun.id,
      petId: simba.id,
      partnerId: partnerRitika.id,
      petName: simba.name,
      petBreed: simba.breed,
      petSize: simba.size,
      petCareNotes: 'Simba had a hot spot near his left ear last month. Use hypoallergenic shampoo.',
      packageId: pkgPremium.id,
      packageName: pkgPremium.name,
      packagePrice: pkgPremium.price,
      scheduledAt: new Date('2026-08-20T10:00:00Z'),
      addressId: arjunAddress.id,
      addressLine: '14A Koramangala 5th Block, Bengaluru',
      subtotal: 1699,
      discount: 0,
      total: 1699,
      paymentMethod: 'upi',
      paymentStatus: 'paid',
      completedAt: new Date('2026-08-20T12:30:00Z'),
      statusHistory: {
        create: [
          { status: 'confirmed', changedBy: customerArjun.id, changedAt: new Date('2026-08-18T09:00:00Z') },
          { status: 'assigned', changedBy: staff.id, changedAt: new Date('2026-08-19T10:00:00Z') },
          { status: 'partner_on_the_way', changedBy: partnerRitika.id, changedAt: new Date('2026-08-20T09:30:00Z') },
          { status: 'arrived', changedBy: partnerRitika.id, changedAt: new Date('2026-08-20T09:55:00Z') },
          { status: 'in_progress', changedBy: partnerRitika.id, changedAt: new Date('2026-08-20T10:05:00Z') },
          { status: 'completed', changedBy: partnerRitika.id, changedAt: new Date('2026-08-20T12:30:00Z') },
        ],
      },
    },
  });

  // Upcoming grooming booking for Mochi (needs partner)
  await prisma.booking.create({
    data: {
      type: 'grooming',
      status: 'needs_partner',
      channel: 'app',
      customerId: customerSahana.id,
      petId: mochi.id,
      petName: mochi.name,
      petBreed: mochi.breed,
      petSize: mochi.size,
      petCareNotes: 'Mochi has long coat — take breaks during grooming. She gets stressed after 45 min.',
      packageId: pkgStandard.id,
      packageName: pkgStandard.name,
      packagePrice: pkgStandard.price,
      scheduledAt: new Date('2026-09-10T11:00:00Z'),
      addressId: sahanaAddress.id,
      addressLine: '22 Indiranagar 12th Main, Bengaluru',
      subtotal: 1399,
      discount: 200,
      total: 1199,
      couponCode: 'WAGWELCOME',
      paymentMethod: 'upi',
      paymentStatus: 'paid',
      statusHistory: {
        create: [
          { status: 'confirmed', changedBy: customerSahana.id },
          { status: 'needs_partner', changedBy: staff.id, note: 'Awaiting partner assignment' },
        ],
      },
    },
  });

  // Completed walk for Rio
  const completedWalkBooking = await prisma.booking.create({
    data: {
      type: 'walking',
      status: 'completed',
      channel: 'app',
      customerId: customerRohan.id,
      petId: rio.id,
      partnerId: partnerKaran.id,
      petName: rio.name,
      petBreed: rio.breed,
      petSize: rio.size,
      petCareNotes: 'Rio has a tendency to chew his leash. Please use the provided slip-lead.',
      durationMinutes: 30,
      scheduledAt: new Date('2026-09-01T07:00:00Z'),
      addressId: rohanAddress.id,
      addressLine: '7 HSR Layout Sector 2, Bengaluru',
      subtotal: 249,
      discount: 0,
      total: 249,
      paymentMethod: 'upi',
      paymentStatus: 'paid',
      completedAt: new Date('2026-09-01T07:35:00Z'),
      statusHistory: {
        create: [
          { status: 'accepted', changedBy: partnerKaran.id },
          { status: 'partner_on_the_way', changedBy: partnerKaran.id },
          { status: 'arrived', changedBy: partnerKaran.id },
          { status: 'in_progress', changedBy: partnerKaran.id },
          { status: 'completed', changedBy: partnerKaran.id },
        ],
      },
    },
  });

  // Walk session for Rio's walk
  await prisma.walkSession.create({
    data: {
      bookingId: completedWalkBooking.id,
      partnerId: partnerKaran.id,
      startedAt: new Date('2026-09-01T07:00:00Z'),
      endedAt: new Date('2026-09-01T07:35:00Z'),
      durationSeconds: 2100,
      distanceMeters: 1850,
      photos: [],
    },
  });

  // ── Reviews ────────────────────────────────────────────────────────────────
  console.log('  Creating reviews...');

  await prisma.review.create({
    data: {
      bookingId: completedBooking.id,
      reviewerId: customerArjun.id,
      reviewerName: 'Arjun Mehta',
      revieweeId: partnerRitika.id,
      revieweeType: 'partner',
      rating: 5,
      comment: 'Ritika was fantastic! Simba looked gorgeous and smelled amazing. Very professional and gentle with him. Will definitely book again!',
    },
  });

  await prisma.review.create({
    data: {
      bookingId: completedWalkBooking.id,
      reviewerId: customerRohan.id,
      reviewerName: 'Rohan Verma',
      revieweeId: partnerKaran.id,
      revieweeType: 'partner',
      rating: 5,
      comment: 'Karan is great! Rio came back tired and happy. Exactly what we needed. Very punctual and sends updates during the walk.',
    },
  });

  console.log('✅ Seed complete!');
  console.log('');
  console.log('Test accounts:');
  console.log('  Admin:    admin@wagandtails.in / WagTails@123');
  console.log('  Staff:    staff@wagandtails.in / WagTails@123');
  console.log('  Partners: ritika.sharma@wagpartner.in / Partner@123');
  console.log('            aman.verma@wagpartner.in / Partner@123');
  console.log('            neha.pillai@wagpartner.in / Partner@123');
  console.log('            karan.joshi@wagpartner.in / Partner@123');
  console.log('  Customer OTP login: +919876543210 (Arjun), +919876543211 (Sahana), +919876543212 (Rohan)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
