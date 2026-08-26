import express from 'express';
import { getUserOrAgentDetails } from '../controllers/adminController.js';
import {
  topupUser,
  withdrawFromUser,
  pushMoneyBetweenUsers,
  withdrawFromAgent,
  requestAgentWithdrawal,
  approveAdminWithdrawalRequest,
  rejectAdminWithdrawalRequest,
  getAgentWithdrawalRequests,
  findAgentByAgentId,
  getCommission,
  setCommission,
  getAllUsers,
  getAllTransactions,
  suspendUser,
  unsuspendUser,
  getAdminStats,
  grantLocationPermissionToAll,
  getTieredCommission,
  setTieredCommission,
  setSendMoneyTiers,
  setWithdrawalTiers,
  getMyAdminCashOut,
  getMyAdminCommission,
  createStateSetting,
  getStateSettings,
  updateStateSetting,
  deleteStateSetting,
  sendMoneyBetweenAdminsByState,
  getPendingSendByState,
  receiveSendByState,
  cancelSendByState
  ,editSendByState
  ,createExchangeRate, getExchangeRates, updateExchangeRate, deleteExchangeRate
  ,createMoneyExchangeTransaction, convertMoneyExchange
} from '../controllers/adminController.js';

import { createCurrency, getCurrencies, updateCurrency, deleteCurrency } from '../controllers/adminController.js';
import { getPendingSendByStateCount } from '../controllers/adminController.js';
import { authMiddleware, adminMiddleware, notSuspended } from '../middleware/auth.js';


const router = express.Router();

// Require authentication for all admin routes (must be first)
router.use(authMiddleware);
// prevent suspended admins from performing admin actions
router.use(notSuspended);

// User/Agent details endpoint
router.get('/user-details', adminMiddleware, getUserOrAgentDetails);

// Allow any authenticated user to read the commission percent
router.get('/commission', getCommission);

// The following routes require admin privileges
router.post('/topup-user', adminMiddleware, topupUser);
router.post('/push-money', adminMiddleware, pushMoneyBetweenUsers);
router.post('/withdraw-from-user', adminMiddleware, withdrawFromUser);
router.post('/withdraw-from-agent', adminMiddleware, withdrawFromAgent);
router.post('/request-agent-withdrawal', adminMiddleware, requestAgentWithdrawal);
router.get('/find-agent', adminMiddleware, findAgentByAgentId);
router.post('/commission', adminMiddleware, setCommission);
router.get('/users', adminMiddleware, getAllUsers);
router.get('/transactions', adminMiddleware, getAllTransactions);
router.post('/suspend-user', adminMiddleware, suspendUser);
router.post('/unsuspend-user', adminMiddleware, unsuspendUser);
router.get('/stats', adminMiddleware, getAdminStats);
router.post('/grant-location', adminMiddleware, grantLocationPermissionToAll);
router.get('/tiered-commission', adminMiddleware, getTieredCommission);
router.post('/tiered-commission', adminMiddleware, setTieredCommission);
router.post('/tiered-commission/send-money', adminMiddleware, setSendMoneyTiers);
router.post('/tiered-commission/withdrawal', adminMiddleware, setWithdrawalTiers);

// Return logged-in admin's cashed-out total
router.get('/stats/my-cashed-out', adminMiddleware, getMyAdminCashOut);
// Return logged-in admin's commission total
router.get('/stats/my-commission', adminMiddleware, getMyAdminCommission);

// State settings CRUD
router.get('/state-settings', adminMiddleware, getStateSettings);
router.post('/state-settings', adminMiddleware, createStateSetting);
router.put('/state-settings/:id', adminMiddleware, updateStateSetting);
router.delete('/state-settings/:id', adminMiddleware, deleteStateSetting);

// Admin send money by state
router.post('/send-state', adminMiddleware, sendMoneyBetweenAdminsByState);
router.get('/send-state/pending', adminMiddleware, getPendingSendByState);
router.post('/send-state/:id/receive', adminMiddleware, receiveSendByState);
router.post('/send-state/:id/cancel', adminMiddleware, cancelSendByState);
router.post('/send-state/:id/edit', adminMiddleware, editSendByState);
router.get('/send-state/pending/count', adminMiddleware, getPendingSendByStateCount);

// Currency management
router.get('/currencies', adminMiddleware, getCurrencies);
router.post('/currencies', adminMiddleware, createCurrency);
router.put('/currencies/:id', adminMiddleware, updateCurrency);
router.delete('/currencies/:id', adminMiddleware, deleteCurrency);

// Pairwise exchange-rate management
router.get('/exchange-rates', adminMiddleware, getExchangeRates);
router.post('/exchange-rates', adminMiddleware, createExchangeRate);
router.put('/exchange-rates/:id', adminMiddleware, updateExchangeRate);
router.delete('/exchange-rates/:id', adminMiddleware, deleteExchangeRate);

// Money exchange transactions
router.post('/money-exchange', adminMiddleware, createMoneyExchangeTransaction);
router.post('/convert-money-exchange', adminMiddleware, convertMoneyExchange);

// Agent withdrawal approval endpoints (agent role)
router.post('/approve-withdrawal-request', authMiddleware, notSuspended, approveAdminWithdrawalRequest);
router.post('/reject-withdrawal-request', authMiddleware, notSuspended, rejectAdminWithdrawalRequest);
router.get('/agent-withdrawal-requests', authMiddleware, notSuspended, getAgentWithdrawalRequests);

export default router;
