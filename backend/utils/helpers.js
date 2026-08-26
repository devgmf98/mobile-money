import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const hashPassword = async (password) => {
  return await bcrypt.hash(password, 10);
};

export const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

export const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

export const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const generateTransactionId = () => {
  const prefix = 'TXN';
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}${timestamp}${random}`;
};

export const formatCurrency = (amount) => {
  return `SSP ${amount.toFixed(2)}`;
};

export const reverseGeocode = async (latitude, longitude) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
      { headers: { 'User-Agent': 'MPay-App' } }
    );
    const data = await response.json();
    return {
      city: data.address?.city || data.address?.town || data.address?.village || 'Unknown',
      country: data.address?.country || 'Unknown'
    };
  } catch (error) {
    console.error('Reverse geocode error:', error);
    return { city: 'Unknown', country: 'Unknown' };
  }
};


/* Numbers are stored inconsistently (+211…, 211…, 0…, bare local), so every
   lookup has to try the same set of variants or the same person resolves on
   one screen and not another. */
export const phoneVariants = (raw) => {
  const normalized = (raw || '').trim();
  const digits = normalized.replace(/(?!^\+)\D/g, '');
  const tries = [normalized, digits, digits.startsWith('211') ? '+' + digits : digits];
  if (digits && !digits.startsWith('211')) tries.push('+211' + digits);
  /* Locally people write 0912345002 for +211912345002, so the national
     trunk zero has to come off before the country code goes on — without
     this the same person fails to resolve when typed the local way. */
  if (digits.startsWith('0')) {
    const local = digits.replace(/^0+/, '');
    if (local) tries.push('+211' + local, '211' + local, local);
  }
  return [...new Set(tries.filter(Boolean))];
};
