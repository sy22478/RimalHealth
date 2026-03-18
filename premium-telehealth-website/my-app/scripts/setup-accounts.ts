import 'dotenv/config';
import bcrypt from 'bcrypt';
import pg from 'pg';

const { Pool } = pg;

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  const passwordHash = await bcrypt.hash('RimalHealth2026!', 12);

  console.log('--- Clearing patient data ---');

  // Delete in dependency order to avoid FK violations
  const tables = [
    'Message', 'Notification', 'Document', 'RefillRequest',
    'Prescription', 'Review', 'Intake', 'Invoice',
    'Subscription', 'PatientProfile', 'Session', 'PasswordReset',
  ];

  for (const table of tables) {
    try {
      const result = await pool.query(`DELETE FROM "${table}"`);
      console.log(`Deleted from ${table}: ${result.rowCount} rows`);
    } catch (e) {
      console.log(`Skipping ${table}: ${(e as Error).message}`);
    }
  }

  // Delete patient users
  const patientResult = await pool.query(`DELETE FROM "User" WHERE role = 'PATIENT'`);
  console.log(`Deleted patient users: ${patientResult.rowCount}`);

  // Setup admin
  console.log('\n--- Setting up admin ---');
  const adminCheck = await pool.query(`SELECT id FROM "User" WHERE email = $1`, ['admin@rimalhealth.com']);
  if (adminCheck.rows.length > 0) {
    await pool.query(
      `UPDATE "User" SET "passwordHash" = $1, role = 'ADMIN', "emailVerified" = true WHERE email = $2`,
      [passwordHash, 'admin@rimalhealth.com']
    );
    console.log('Updated admin user:', adminCheck.rows[0].id);
  } else {
    const res = await pool.query(
      `INSERT INTO "User" (id, email, "passwordHash", role, "emailVerified", "tokenVersion", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, 'ADMIN', true, 0, NOW(), NOW()) RETURNING id`,
      ['admin@rimalhealth.com', passwordHash]
    );
    console.log('Created admin user:', res.rows[0].id);
  }

  // Setup physician
  console.log('\n--- Setting up physician ---');
  const docCheck = await pool.query(`SELECT id FROM "User" WHERE email = $1`, ['doctor@rimalhealth.com']);
  let physicianUserId: string;

  if (docCheck.rows.length > 0) {
    physicianUserId = docCheck.rows[0].id;
    await pool.query(
      `UPDATE "User" SET "passwordHash" = $1, role = 'PHYSICIAN', "emailVerified" = true WHERE email = $2`,
      [passwordHash, 'doctor@rimalhealth.com']
    );
    console.log('Updated physician user:', physicianUserId);
  } else {
    const res = await pool.query(
      `INSERT INTO "User" (id, email, "passwordHash", role, "emailVerified", "tokenVersion", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, 'PHYSICIAN', true, 0, NOW(), NOW()) RETURNING id`,
      ['doctor@rimalhealth.com', passwordHash]
    );
    physicianUserId = res.rows[0].id;
    console.log('Created physician user:', physicianUserId);
  }

  // Clean up old physician profiles and users that aren't our new accounts
  // Use quoted column names since Prisma maps to camelCase in DB
  try { await pool.query(`DELETE FROM "PhysicianNote" WHERE "physicianId" IN (SELECT id FROM "Physician" WHERE "userId" != $1)`, [physicianUserId]); } catch { /* table may not exist */ }
  try { await pool.query(`DELETE FROM "PhysicianMessage" WHERE "physicianId" IN (SELECT id FROM "Physician" WHERE "userId" != $1)`, [physicianUserId]); } catch { /* table may not exist */ }
  try { await pool.query(`DELETE FROM "PhysicianAuthorizationLog" WHERE "physicianId" IN (SELECT id FROM "Physician" WHERE "userId" != $1)`, [physicianUserId]); } catch { /* table may not exist */ }
  try { await pool.query(`DELETE FROM "Physician" WHERE "userId" != $1`, [physicianUserId]); } catch { /* may have FK constraints */ }

  // Delete old physician users (not our new doctor)
  await pool.query(`DELETE FROM "User" WHERE role = 'PHYSICIAN' AND id != $1`, [physicianUserId]);

  // Check/create physician profile for our doctor
  const physicianProfile = await pool.query(
    `SELECT id FROM "Physician" WHERE "userId" = $1`, [physicianUserId]
  );

  if (physicianProfile.rows.length === 0) {
    await pool.query(
      `INSERT INTO "Physician" (id, "userId", "firstName", "lastName", specialty, "npiNumber", "licenseNumber", "licenseState", status, "isActive", "maxDailyReviews", "totalReviews", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, 'Dr. Rimal', 'Health', 'Addiction Medicine', '1234567890', 'CA-12345', 'CA', 'ACTIVE', true, 20, 0, NOW(), NOW())`,
      [physicianUserId]
    );
    console.log('Created physician profile');
  } else {
    await pool.query(
      `UPDATE "Physician" SET status = 'ACTIVE', "isActive" = true WHERE "userId" = $1`,
      [physicianUserId]
    );
    console.log('Updated physician profile:', physicianProfile.rows[0].id);
  }

  console.log('\n--- Done! ---');
  console.log('Admin:     admin@rimalhealth.com / RimalHealth2026!');
  console.log('Physician: doctor@rimalhealth.com / RimalHealth2026!');
  console.log('Patient data: cleared');

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
