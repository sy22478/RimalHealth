/**
 * Database Seed Script for Rimal Health
 * 
 * Creates test data for development:
 * - Test physician account
 * - Test pharmacy locations
 * - Sample audit log entries
 * 
 * HIPAA Compliance:
 * - No real patient data is seeded
 * - Test data uses fictional information only
 * - PHI fields use placeholder data
 * 
 * Usage:
 *   npm run db:seed
 *   npx tsx scripts/seed.ts
 */

import { PrismaClient, Role, PlanType, SubscriptionStatus, ConcernType } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Treatment products (multi-product spine). AUD is the first treatment,
// GLP-1 weight management the second. Mirrors the data migration
// (20260526010001_seed_products_backfill) so fresh dev DBs match production.
const PRODUCTS = [
  {
    slug: 'alcohol-aud',
    name: 'Alcohol Use Disorder',
    concernType: ConcernType.ALCOHOL,
  },
  {
    slug: 'weight-management',
    name: 'Weight Management',
    concernType: ConcernType.WEIGHT_MANAGEMENT,
  },
];

// Test physician credentials (for development only)
const TEST_PHYSICIAN = {
  email: 'dr.sarah.johnson@rimalhealth.test',
  password: 'TestPhysician123!',
  firstName: 'Sarah',
  lastName: 'Johnson',
  npiNumber: '1234567890',
  licenseNumber: 'A123456',
  deaNumber: 'BJ1234567',
  specialty: 'Addiction Medicine',
};

// Test admin credentials (for development only)
const TEST_ADMIN = {
  email: 'admin@rimalhealth.test',
  password: 'TestAdmin123!',
};

// California pharmacies for testing
const PHARMACIES = [
  {
    name: 'CVS Pharmacy - Downtown LA',
    ncpdpId: '0561234',
    phone: '(213) 555-0101',
    address: '123 S Main St, Los Angeles, CA 90012',
    city: 'Los Angeles',
    state: 'CA',
    zipCode: '90012',
    isActive: true,
  },
  {
    name: 'Walgreens - Santa Monica',
    ncpdpId: '0561235',
    phone: '(310) 555-0102',
    address: '456 Wilshire Blvd, Santa Monica, CA 90401',
    city: 'Santa Monica',
    state: 'CA',
    zipCode: '90401',
    isActive: true,
  },
  {
    name: 'Rite Aid - San Francisco',
    ncpdpId: '0561236',
    phone: '(415) 555-0103',
    address: '789 Market St, San Francisco, CA 94102',
    city: 'San Francisco',
    state: 'CA',
    zipCode: '94102',
    isActive: true,
  },
  {
    name: 'Costco Pharmacy - San Diego',
    ncpdpId: '0561237',
    phone: '(619) 555-0104',
    address: '321 Camino de la Plaza, San Diego, CA 92173',
    city: 'San Diego',
    state: 'CA',
    zipCode: '92173',
    isActive: true,
  },
  {
    name: 'Safeway Pharmacy - Sacramento',
    ncpdpId: '0561238',
    phone: '(916) 555-0105',
    address: '654 J St, Sacramento, CA 95814',
    city: 'Sacramento',
    state: 'CA',
    zipCode: '95814',
    isActive: true,
  },
];

/**
 * Hash password with bcrypt
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Seed test physician
 */
async function seedPhysician() {
  console.log('🔬 Creating test physician...');

  const existingUser = await prisma.user.findUnique({
    where: { email: TEST_PHYSICIAN.email },
  });

  if (existingUser) {
    console.log('  ℹ️  Test physician already exists, skipping...');
    return existingUser;
  }

  const passwordHash = await hashPassword(TEST_PHYSICIAN.password);

  const user = await prisma.user.create({
    data: {
      email: TEST_PHYSICIAN.email,
      passwordHash,
      role: Role.PHYSICIAN,
      emailVerified: true,
      physician: {
        create: {
          npiNumber: TEST_PHYSICIAN.npiNumber,
          licenseNumber: TEST_PHYSICIAN.licenseNumber,
          licenseState: 'CA',
          deaNumber: TEST_PHYSICIAN.deaNumber,
          firstName: TEST_PHYSICIAN.firstName,
          lastName: TEST_PHYSICIAN.lastName,
          specialty: TEST_PHYSICIAN.specialty,
          status: 'ACTIVE',
          isActive: true,
          maxDailyReviews: 25,
          authorizedAt: new Date(),
        },
      },
    },
    include: {
      physician: true,
    },
  });

  console.log(`  ✅ Created physician: ${user.email} (ID: ${user.id})`);
  console.log(`     NPI: ${TEST_PHYSICIAN.npiNumber}`);
  console.log(`     Password: ${TEST_PHYSICIAN.password}`);
  
  return user;
}

/**
 * Seed test admin
 */
async function seedAdmin() {
  console.log('🔐 Creating test admin...');

  const existingUser = await prisma.user.findUnique({
    where: { email: TEST_ADMIN.email },
  });

  if (existingUser) {
    console.log('  ℹ️  Test admin already exists, skipping...');
    return existingUser;
  }

  const passwordHash = await hashPassword(TEST_ADMIN.password);

  const user = await prisma.user.create({
    data: {
      email: TEST_ADMIN.email,
      passwordHash,
      role: Role.ADMIN,
      emailVerified: true,
    },
  });

  console.log(`  ✅ Created admin: ${user.email} (ID: ${user.id})`);
  console.log(`     Password: ${TEST_ADMIN.password}`);
  
  return user;
}

/**
 * Seed pharmacies
 */
async function seedPharmacies() {
  console.log('💊 Seeding pharmacies...');

  for (const pharmacy of PHARMACIES) {
    const existing = await prisma.pharmacy.findUnique({
      where: { ncpdpId: pharmacy.ncpdpId },
    });

    if (existing) {
      console.log(`  ℹ️  Pharmacy ${pharmacy.name} already exists, skipping...`);
      continue;
    }

    await prisma.pharmacy.create({
      data: pharmacy,
    });

    console.log(`  ✅ Created pharmacy: ${pharmacy.name}`);
  }
}

/**
 * Seed treatment products (idempotent) and backfill any unlinked AUD records.
 */
async function seedProducts() {
  console.log('🧬 Seeding treatment products...');

  for (const product of PRODUCTS) {
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: { name: product.name, concernType: product.concernType },
      create: product,
    });
    console.log(`  ✅ Upserted product: ${product.name} (${product.slug})`);
  }

  // Backfill existing intakes/prescriptions to the AUD product (the only
  // treatment that existed before the multi-product foundation).
  const audProduct = await prisma.product.findUnique({
    where: { slug: 'alcohol-aud' },
  });

  if (audProduct) {
    const intakes = await prisma.intake.updateMany({
      where: { productId: null },
      data: { productId: audProduct.id },
    });
    const prescriptions = await prisma.prescription.updateMany({
      where: { productId: null },
      data: { productId: audProduct.id },
    });
    if (intakes.count || prescriptions.count) {
      console.log(
        `  ✅ Backfilled ${intakes.count} intake(s) and ${prescriptions.count} prescription(s) to AUD`
      );
    }
  }
}

/**
 * Seed audit log with system events
 */
async function seedAuditLogs(physicianId: string) {
  console.log('📋 Creating sample audit logs...');

  const existingLogs = await prisma.auditLog.count();
  if (existingLogs > 0) {
    console.log('  ℹ️  Audit logs already exist, skipping...');
    return;
  }

  const logs = [
    {
      eventType: 'SYSTEM_STARTUP',
      severity: 'INFO',
      userId: null,
      userRole: 'SYSTEM',
      ipAddress: '127.0.0.1',
      resourceType: 'SYSTEM',
      resourceId: null,
      metadata: { version: '1.0.0', environment: 'development' },
      success: true,
    },
    {
      eventType: 'PHYSICIAN_CREATED',
      severity: 'INFO',
      userId: physicianId,
      userRole: 'ADMIN',
      ipAddress: '127.0.0.1',
      resourceType: 'Physician',
      resourceId: physicianId,
      metadata: { email: TEST_PHYSICIAN.email },
      success: true,
    },
  ];

  for (const log of logs) {
    await prisma.auditLog.create({
      data: log,
    });
  }

  console.log(`  ✅ Created ${logs.length} audit log entries`);
}

/**
 * Main seed function
 */
async function main() {
  console.log('🌱 Starting database seed...\n');

  try {
    // Seed in order of dependencies
    const physician = await seedPhysician();
    await seedAdmin();
    await seedProducts();
    await seedPharmacies();
    await seedAuditLogs(physician.id);

    console.log('\n✨ Seed completed successfully!');
    console.log('\n📋 Test Accounts:');
    console.log('  Physician:');
    console.log(`    Email: ${TEST_PHYSICIAN.email}`);
    console.log(`    Password: ${TEST_PHYSICIAN.password}`);
    console.log('  Admin:');
    console.log(`    Email: TEST_ADMIN.email`);
    console.log(`    Password: ${TEST_ADMIN.password}`);
    console.log('\n⚠️  WARNING: These are test credentials for development only!');
    console.log('   Never use these in production.');

  } catch (error) {
    console.error('\n❌ Seed failed:', error);
    process.exit(1);
  }
}

// Run seed
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
