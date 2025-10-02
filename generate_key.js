const crypto = require('crypto');

// Generate random string
const generateRandomString = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// generate JWT Scret Key
const generateJWTSecretKey = (length = 64) => {
  return crypto.randomBytes(length).toString('hex');
};

const jwtSecretKey = generateJWTSecretKey(64);
console.log('Generated JWT Secret Key:', jwtSecretKey);