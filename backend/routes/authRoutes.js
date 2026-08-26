import express from 'express';
import { register, verifyPhone, resendVerification, login, getProfile, updateProfile, checkUserBalance, forgotPassword, resetPassword } from '../controllers/authController.js';
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
router.get('/check-balance', authMiddleware, checkUserBalance);

export default router;
