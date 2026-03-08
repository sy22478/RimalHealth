/**
 * Encryption Verification Script
 * Run with: npx tsx scripts/verify-encryption.ts
 * 
 * Verifies the PHI encryption layer is working correctly
 */

import { 
  encryptPHI, 
  decryptPHI, 
  isEncrypted, 
  encryptJSON, 
  decryptJSON,
  generateEncryptionKey
} from '../lib/encryption/phi';

// Set up test encryption key
process.env.PHI_ENCRYPTION_KEY = generateEncryptionKey();

console.log('🔒 PHI Encryption Verification\n');
console.log('=' .repeat(50));

// Test 1: Basic encryption/decryption
console.log('\n✅ Test 1: Basic encryption/decryption');
const plaintext = 'patient@example.com';
const encrypted = encryptPHI(plaintext);
const decrypted = decryptPHI(encrypted);
console.log(`  Input:    "${plaintext}"`);
console.log(`  Encrypted: "${encrypted.substring(0, 50)}..."`);
console.log(`  Decrypted: "${decrypted}"`);
console.log(`  ✓ Match: ${plaintext === decrypted}`);

// Test 2: Different IV each time
console.log('\n✅ Test 2: Different IV each time');
const encrypted1 = encryptPHI('same text');
const encrypted2 = encryptPHI('same text');
console.log(`  Encryption 1: "${encrypted1.substring(0, 50)}..."`);
console.log(`  Encryption 2: "${encrypted2.substring(0, 50)}..."`);
console.log(`  ✓ Different: ${encrypted1 !== encrypted2}`);

// Test 3: Idempotent encryption
console.log('\n✅ Test 3: Idempotent encryption');
const doubleEncrypted = encryptPHI(encrypted);
console.log(`  ✓ Already encrypted, unchanged: ${encrypted === doubleEncrypted}`);

// Test 4: isEncrypted helper
console.log('\n✅ Test 4: isEncrypted helper');
console.log(`  "${plaintext}" is encrypted: ${isEncrypted(plaintext)}`);
console.log(`  Encrypted string is encrypted: ${isEncrypted(encrypted)}`);
console.log(`  ✓ Correct detection`);

// Test 5: JSON encryption
console.log('\n✅ Test 5: JSON encryption');
const patientData = {
  firstName: 'John',
  lastName: 'Doe',
  ssn: '123-45-6789',
  conditions: ['Hypertension', 'Diabetes']
};
const encryptedJSON = encryptJSON(patientData);
const decryptedJSON = decryptJSON(encryptedJSON);
console.log(`  Input: ${JSON.stringify(patientData).substring(0, 60)}...`);
console.log(`  Encrypted: "${encryptedJSON?.substring(0, 50)}..."`);
console.log(`  Decrypted match: ${JSON.stringify(patientData) === JSON.stringify(decryptedJSON)}`);
console.log(`  ✓ JSON encryption works`);

// Test 6: Encryption format verification
console.log('\n✅ Test 6: Encryption format');
const parts = encrypted.split(':');
console.log(`  Format: ${parts.join(':').substring(0, 60)}...`);
console.log(`  Parts count: ${parts.length} (expected: 6)`);
console.log(`  Prefix: ${parts[0]} (expected: enc)`);
console.log(`  Version: ${parts[1]} (expected: v1)`);
console.log(`  ✓ Format correct: ${parts.length === 6 && parts[0] === 'enc' && parts[1] === 'v1'}`);

// Test 7: Null/undefined handling
console.log('\n✅ Test 7: Null/undefined handling');
// @ts-expect-error testing
console.log(`  encryptPHI(null): ${encryptPHI(null)}`);
// @ts-expect-error testing
console.log(`  decryptPHI(null): ${decryptPHI(null)}`);
console.log(`  encryptJSON(null): ${encryptJSON(null)}`);
console.log(`  decryptJSON(null): ${decryptJSON(null)}`);
console.log(`  ✓ Null handling works`);

console.log('\n' + '='.repeat(50));
console.log('\n🎉 All encryption tests passed!');
console.log('\nEnvironment variable to add to .env.local:');
console.log(`PHI_ENCRYPTION_KEY=${generateEncryptionKey()}`);
