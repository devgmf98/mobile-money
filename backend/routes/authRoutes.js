import express from 'express';
import { register, verifyPhone, resendVerification, login, getProfile, updateProfile, checkUserBalance, forgotPassword, resetPassword, registerDeviceToken, removeDeviceToken } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/verify-phone', verifyPhone);
router.post('/resend-verification', resendVerification);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, updateProfile);

// Where to push this account's notifications. Registered after sign-in and
// dropped on sign-out, so a shared phone stops receiving for the last person.
router.post('/device-token', authMiddleware, registerDeviceToken);
router.delete('/device-token', authMiddleware, removeDeviceToken);
router.get('/check-balance', authMiddleware, checkUserBalance);

export default router;
