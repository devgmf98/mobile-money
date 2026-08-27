import User from '../models/User.js';
import { hashPassword } from './helpers.js';

/* A freshly deployed database has tables but no accounts, so there is nobody
   who can sign in and nothing that can create the first admin — the dashboard
   is unreachable. This runs once at startup to break that deadlock.

   Credentials come from the environment rather than being hardcoded. Seeding a
   well-known default like admin@example.com / admin123 into a live money
   transfer app would hand an admin account to anyone who reads this file. */
export async function bootstrapAdmin() {
  const existing = await User.findOne({ where: { role: 'admin' } });
  if (existing) return { created: false, reason: 'an admin already exists' };

  const email = (process.env.ADMIN_EMAIL || '').trim();
  const password = process.env.ADMIN_PASSWORD || '';
  const phone = (process.env.ADMIN_PHONE || '').trim();

  if (!email || !password) {
    return {
      created: false,
      reason:
        'no admin exists and ADMIN_EMAIL / ADMIN_PASSWORD are not set — ' +
        'set them and restart to create the first admin',
    };
  }

  if (password.length < 8) {
    return { created: false, reason: 'ADMIN_PASSWORD must be at least 8 characters' };
  }

  /* An admin ID is a unique 6-digit string, generated the same way register
     does, retrying on the rare collision. */
  let adminId = null;
  for (let i = 0; i < 10; i++) {
    const candidate = String(Math.floor(100000 + Math.random() * 900000));
    const clash = await User.findOne({ where: { adminId: candidate } });
    if (!clash) {
      adminId = candidate;
      break;
    }
  }

  const admin = await User.create({
    name: process.env.ADMIN_NAME || 'Administrator',
    email,
    phone: phone || null,
    password: await hashPassword(password),
    role: 'admin',
    adminId,
    /* Verified on creation: there is no phone to send a code to during a
       deployment, and an unverified account cannot sign in. */
    isVerified: true,
    balance: 0,
    theme: 'light',
  });

  return { created: true, email: admin.email, adminId: admin.adminId };
}
