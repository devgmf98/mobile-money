import express from 'express';
import { sendMoney, withdrawMoney, getTransactions, getTransactionStats, getUserInfo, getAgentInfo, getWithdrawalQuote, getSendQuote } from '../controllers/transactionController.js';
import { authMiddleware, notSuspended } from '../middleware/auth.js';

const router = express.Router();

router.post('/send-money', authMiddleware, notSuspended, sendMoney);
router.post('/withdraw', authMiddleware, notSuspended, withdrawMoney);
router.get('/transactions', authMiddleware, getTransactions);
router.get('/stats', authMiddleware, getTransactionStats);
router.get('/user-info/:phoneNumber', authMiddleware, getUserInfo);
router.get('/agent-info/:agentId', authMiddleware, getAgentInfo);
router.get('/withdrawal-quote', authMiddleware, getWithdrawalQuote);
router.get('/send-quote', authMiddleware, getSendQuote);

export default router;
