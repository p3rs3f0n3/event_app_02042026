const crypto = require('crypto');

const hashPassword = (password, salt) => crypto.scryptSync(password, salt, 64).toString('hex');
const isPasswordHash = (value) => typeof value === 'string' && value.includes(':');

const createPasswordHash = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${hashPassword(password, salt)}`;
};

const verifyPassword = (password, storedHash) => {
  if (typeof storedHash !== 'string' || !storedHash.includes(':')) {
    return false;
  }

  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) {
    return false;
  }

  const computedHash = hashPassword(password, salt);
  const hashBuffer = Buffer.from(hash, 'hex');
  const computedBuffer = Buffer.from(computedHash, 'hex');

  if (hashBuffer.length !== computedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(hashBuffer, computedBuffer);
};

const comparePassword = (password, storedValue) => {
  if (isPasswordHash(storedValue)) {
    return verifyPassword(password, storedValue);
  }

  return typeof storedValue === 'string' && storedValue === password;
};

module.exports = {
  comparePassword,
  createPasswordHash,
  isPasswordHash,
  verifyPassword,
};
