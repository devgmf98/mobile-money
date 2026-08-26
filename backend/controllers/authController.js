import User from '../models/User.js';
import { phoneVariants } from '../utils/helpers.js';
import { hashPassword, comparePassword, generateToken, generateVerificationCode, reverseGeocode } from '../utils/helpers.js';
import { sendVerificationCode, sendSMS } from '../utils/sms.js';
import Verification from '../models/Verification.js';
import { Op } from 'sequelize';

export const register = async (req, res) => {
  try {
    const { name, email, phone, password, role, agentId } = req.body;

    const existingUser = await User.findOne({ where: { [Op.or]: [{ email }, { phone }] } });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // If role is agent but no agentId provided, generate one
    let finalAgentId = agentId;
    if (role === 'agent') {
      if (!agentId) {
        // Auto-generate unique 6-digit agent ID
        let isUnique = false;
        while (!isUnique) {
          finalAgentId = Math.floor(Math.random() * 900000) + 100000;
          const existing = await User.findOne({ where: { agentId: finalAgentId.toString() } });
          if (!existing) {
            isUnique = true;
          }
        }
      } else {
        // Verify provided agentId is unique
        const existingAgent = await User.findOne({ where: { agentId } });
        if (existingAgent) {
          return res.status(400).json({ message: 'Agent ID already exists' });
        }
      }
    }

    // If role is admin, generate a unique 6-digit admin ID
    let finalAdminId = null;
    if (role === 'admin') {
      let isUnique = false;
      while (!isUnique) {
        finalAdminId = Math.floor(Math.random() * 900000) + 100000;
        const existing = await User.findOne({ where: { adminId: finalAdminId.toString() } });
        if (!existing) {
          isUnique = true;
        }
      }
    }

    const hashedPassword = await hashPassword(password);
    const verificationCode = generateVerificationCode();

    console.log('Registering user:', { name, email, phone, role, finalAgentId, finalAdminId });

    /* Admins are provisioned through the API by someone who already has
       access, not by self-signup, so there is no phone to prove ownership of —
       and the SMS code would strand them: sign-in refuses unverified accounts,
       so an admin created this way could never log in. */
    const isAdmin = role === 'admin';

    const user = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role: role || 'user',
      agentId: finalAgentId,
      adminId: finalAdminId,
      isVerified: isAdmin,
      verificationCode: isAdmin ? null : verificationCode,
      verificationExpiry: isAdmin ? null : new Date(Date.now() + 10 * 60000),
      theme: 'light'
    });

    // Send SMS verification code
    if (!isAdmin) {
      try {
        await sendVerificationCode(phone, verificationCode);
      } catch (error) {
        console.error('SMS failed but user registered:', error);
      }
    }

    res.status(201).json({
      message: isAdmin
        ? 'Admin registered. You can sign in now.'
        : 'User registered. Please verify your phone number.',
      userId: user.id,
      phone: user.phone,
      /* Says outright whether the account still needs a code. Admins come back
         true and can sign in immediately; everyone else must verify first, and
         the caller previously had to infer that from the message text. */
      isVerified: user.isVerified,
      agentId: finalAgentId || null,
      adminId: finalAdminId || null
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: error.message, details: error });
  }
};

export const verifyPhone = async (req, res) => {
  try {
    const { phone, code } = req.body;

    /* Exact match only used to be enough because one screen wrote and read the
       same string. It is not: the same person can arrive here as 912345001,
       0912345001 or +211912345001, and an exact lookup reports the account as
       missing rather than unverified. */
    let user = null;
    for (const variant of phoneVariants(phone)) {
      user = await User.findOne({ where: { phone: variant } });
      if (user) break;
    }
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.verificationCode !== code || user.verificationExpiry < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    user.isVerified = true;
    /* null, not undefined: Sequelize skips undefined assignments, so these two
       columns kept their values and a used verification code stayed valid
       indefinitely — it could be replayed long after the account was verified. */
    user.verificationCode = null;
    user.verificationExpiry = null;
    await user.save();

    res.json({ message: 'Phone verified successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* Codes last ten minutes, so anyone arriving here from the sign-in page will
   almost always need a fresh one. Always answers the same way whether or not
   the number exists, so this cannot be used to discover registered numbers. */
export const resendVerification = async (req, res) => {
  const generic = { message: 'If that number needs verification, a new code has been sent.' };
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    let user = null;
    for (const variant of phoneVariants(phone)) {
      user = await User.findOne({ where: { phone: variant } });
      if (user) break;
    }
    if (!user || user.isVerified) {
      return res.json(generic);
    }

    const code = generateVerificationCode();
    user.verificationCode = code;
    user.verificationExpiry = new Date(Date.now() + 10 * 60000);
    await user.save();

    try {
      await sendVerificationCode(user.phone, code);
    } catch (error) {
      console.error('Resend SMS failed:', error);
    }

    res.json(generic);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* Credentials may arrive in an `Authorization: Basic base64(email:password)`
   header instead of the JSON body — Postman's Basic Auth tab, curl -u, and any
   HTTP client's built-in credential field all send this form.

   Split on the FIRST colon only: an email cannot contain one, but a password
   certainly can, and splitting on every colon would silently truncate it. */
const basicAuthCredentials = (header) => {
  if (typeof header !== 'string' || !header.toLowerCase().startsWith('basic ')) return null;

  let decoded;
  try {
    decoded = Buffer.from(header.slice(6).trim(), 'base64').toString('utf8');
  } catch {
    return null;
  }

  const colon = decoded.indexOf(':');
  if (colon === -1) return null;

  return { email: decoded.slice(0, colon), password: decoded.slice(colon + 1) };
};

export const login = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    /* Basic Auth wins when present; the JSON body still works so the web app
       and any existing integration keep functioning unchanged. */
    const basic = basicAuthCredentials(req.headers.authorization);
    const email = basic ? basic.email : req.body.email;
    const password = basic ? basic.password : req.body.password;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Provide credentials in an Authorization: Basic header, or as email and password in the body.',
      });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.isVerified) {
      /* Flagged rather than a bare 403 so the sign-in page can send them to the
         verification step instead of showing a dead end. The phone comes back
         because that screen needs to know which number the code goes to. */
      return res.status(403).json({
        message: 'Please verify your phone number before signing in.',
        needsVerification: true,
        phone: user.phone,
      });
    }

    if (user.isSuspended) {
      return res.status(403).json({ message: 'Your account has been suspended. Please contact customer care to restore access.' });
    }

    const validPassword = await comparePassword(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Update location if provided
    if (latitude && longitude) {
      const locationData = await reverseGeocode(latitude, longitude);
      user.currentLocation = {
        latitude,
        longitude,
        city: locationData.city,
        country: locationData.country,
        timestamp: new Date()
      };
      await user.save();
    } else if (user.adminLocationConsent) {
      // Admin has opted users into server-side/IP-based location capture.
      try {
        const forwarded = req.headers['x-forwarded-for'] || req.headers['x-real-ip'];
        let ip = '';
        if (forwarded) ip = forwarded.split(',')[0].trim();
        if (!ip) ip = req.connection?.remoteAddress || req.socket?.remoteAddress || '';

        // ipapi accepts empty path to use caller IP; use client IP if available
        const ipPath = ip && !ip.startsWith('127.') && ip !== '::1' ? `${ip}/json/` : 'json/';
        const ipRes = await fetch(`https://ipapi.co/${ipPath}`);
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          const lat = ipData.latitude || ipData.lat || null;
          const lon = ipData.longitude || ipData.lon || null;
          if (lat && lon) {
            const locationData = await reverseGeocode(lat, lon);
            user.currentLocation = {
              latitude: lat,
              longitude: lon,
              city: locationData.city,
              country: locationData.country,
              timestamp: new Date()
            };
            await user.save();
          }
        }
      } catch (e) {
        console.warn('IP geolocation failed on login:', e.message || e);
      }
    }

    const token = generateToken(user.id, user.role);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        balance: parseFloat(user.balance) || 0,
        isVerified: user.isVerified,
        agentId: user.agentId || null,
        adminId: user.adminId || null,
        autoAdminCashout: user.autoAdminCashout || false,
        adminLocationConsent: user.adminLocationConsent || false,
        theme: user.theme || 'light',
        currentLocation: user.currentLocation || null
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.userId, {
      attributes: { exclude: ['password'] }
    });
    // Ensure balance is returned as a number
    const userData = user.toJSON();
    userData.balance = parseFloat(userData.balance) || 0;
    res.json(userData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, profileImage, idNumber, autoAdminCashout, theme } = req.body;

    // Build update object only with provided fields
    const update = { updatedAt: new Date() };
    if (typeof name !== 'undefined') update.name = name;
    if (typeof profileImage !== 'undefined') update.profileImage = profileImage;
    if (typeof idNumber !== 'undefined') update.idNumber = idNumber;
    if (typeof autoAdminCashout !== 'undefined') update.autoAdminCashout = !!autoAdminCashout;
    if (theme === 'light' || theme === 'dark') update.theme = theme;

    const user = await User.update(update, {
      where: { id: req.userId },
      returning: true
    });

    // Get the updated user
    const updatedUser = await User.findByPk(req.userId, {
      attributes: { exclude: ['password'] }
    });

    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const checkUserBalance = async (req, res) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    /* Same variant tolerance as everywhere else — a balance check must not
       depend on how the number happened to be typed. */
    let user = null;
    for (const variant of phoneVariants(phone)) {
      user = await User.findOne({
        where: { phone: variant },
        attributes: ['id', 'name', 'phone', 'balance', 'isVerified', 'isSuspended']
      });
      if (user) break;
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isSuspended) {
      return res.status(403).json({ message: 'User account is suspended' });
    }

    res.json({
      id: user.id,
      name: user.name,
      phone: user.phone,
      balance: parseFloat(user.balance) || 0,
      isVerified: user.isVerified
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ==========================================================================
   Password reset

   Two steps: request a code, then redeem it with a new password. The code is
   delivered by SMS to the phone on the account, reusing the verificationCode /
   verificationExpiry columns the registration flow already uses.
   ========================================================================== */

const RESET_WINDOW_MS = 15 * 60 * 1000;

// Both endpoints answer identically whether or not the account exists.
// Branching on that would turn this into an account enumerator: an attacker
// could confirm which emails are registered simply by watching the responses.
const GENERIC_REQUEST_REPLY = {
  message: 'If that email is registered, a reset code has been sent to the phone on the account.'
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const user = await User.findOne({ where: { email: String(email).trim() } });
    if (!user) return res.json(GENERIC_REQUEST_REPLY);

    const code = generateVerificationCode();
    user.verificationCode = code;
    user.verificationExpiry = new Date(Date.now() + RESET_WINDOW_MS);
    await user.save();

    // SMS failure must not reveal that the account exists, and must not fail
    // the request - sendSMS already swallows its own errors.
    try {
      await sendSMS(user.phone, `MoneyPay: Your password reset code is ${code}. It expires in 15 minutes.`);
    } catch (err) {
      console.error('Password reset SMS failed:', err);
    }

    return res.json(GENERIC_REQUEST_REPLY);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, code, password } = req.body;

    if (!email || !code || !password) {
      return res.status(400).json({ message: 'Email, code and new password are required.' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const user = await User.findOne({ where: { email: String(email).trim() } });

    // One message for every failure mode - wrong email, wrong code and expired
    // code are indistinguishable from the outside.
    const invalid = { message: 'Invalid or expired reset code.' };

    if (!user || !user.verificationCode || !user.verificationExpiry) {
      return res.status(400).json(invalid);
    }
    if (String(user.verificationCode) !== String(code).trim()) {
      return res.status(400).json(invalid);
    }
    if (new Date(user.verificationExpiry).getTime() < Date.now()) {
      return res.status(400).json(invalid);
    }

    user.password = await hashPassword(password);
    // Burn the code so it cannot be replayed.
    user.verificationCode = null;
    user.verificationExpiry = null;
    await user.save();

    res.json({ message: 'Password updated. You can now sign in with your new password.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
