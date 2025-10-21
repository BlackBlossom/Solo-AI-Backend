const crypto = require('crypto');

// Generate random string
const generateRandomString = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Generate JWT Secret Key
const generateJWTSecretKey = (length = 64) => {
  return crypto.randomBytes(length).toString('hex');
};

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║        JWT SECRET KEYS GENERATOR FOR SOLO AI              ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

console.log('🔐 USER AUTHENTICATION SECRETS\n');
console.log('JWT_SECRET (for user access tokens):');
console.log(generateJWTSecretKey(64));
console.log('\nJWT_REFRESH_SECRET (for user refresh tokens):');
console.log(generateJWTSecretKey(64));

console.log('\n' + '═'.repeat(63) + '\n');

console.log('🔐 ADMIN PANEL SECRETS\n');
console.log('ADMIN_JWT_SECRET (for admin access tokens):');
console.log(generateJWTSecretKey(64));
console.log('\nADMIN_JWT_REFRESH_SECRET (for admin refresh tokens):');
console.log(generateJWTSecretKey(64));

console.log('\n' + '═'.repeat(63) + '\n');

console.log('💡 INSTRUCTIONS:\n');
console.log('1. Copy these keys to your .env file');
console.log('2. Keep them SECRET and NEVER commit them to version control');
console.log('3. Use different keys for development and production');
console.log('4. Admin keys MUST be different from user keys for security');
console.log('\n' + '═'.repeat(63) + '\n');
