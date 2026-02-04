import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'https://cash-app-api.up.railway.app/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  verifyPhone: (data) => api.post('/auth/verify-phone', data),
  login: (data) => api.post('/auth/login', data),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data)
};

export const transactionAPI = {
  sendMoney: (data) => api.post('/transactions/send-money', data),
  withdraw: (data) => api.post('/transactions/withdraw', data),
  getTransactions: () => api.get('/transactions/transactions'),
  getStats: () => api.get('/transactions/stats'),
  getUserInfo: (phoneNumber) => api.get(`/transactions/user-info/${phoneNumber}`)
};

export const adminAPI = {
  topupUser: (data) => api.post('/admin/topup-user', data),
  withdrawFromUser: (data) => api.post('/admin/withdraw-from-user', data),
  pushMoney: (data) => api.post('/admin/push-money', data),
  requestAgentWithdrawal: (data) => api.post('/admin/request-agent-withdrawal', data),
  getCommission: () => api.get('/admin/commission'),
  setCommission: (data) => api.post('/admin/commission', data),
  getTieredCommission: () => api.get('/admin/tiered-commission'),
  setTieredCommission: (data) => api.post('/admin/tiered-commission', data),
  setSendMoneyTiers: (data) => api.post('/admin/tiered-commission/send-money', data),
  setWithdrawalTiers: (data) => api.post('/admin/tiered-commission/withdrawal', data),
  getStateSettings: () => api.get('/admin/state-settings'),
  createStateSetting: (data) => api.post('/admin/state-settings', data),
  updateStateSetting: (id, data) => api.put(`/admin/state-settings/${id}`, data),
  deleteStateSetting: (id) => api.delete(`/admin/state-settings/${id}`),
  adminSendState: (data) => api.post('/admin/send-state', data),
  // currencies
  getCurrencies: () => api.get('/admin/currencies'),
  createCurrency: (data) => api.post('/admin/currencies', data),
  updateCurrency: (id, data) => api.put(`/admin/currencies/${id}`, data),
  deleteCurrency: (id) => api.delete(`/admin/currencies/${id}`),
  // (pairwise exchange-rate endpoints removed)
  // pairwise exchange-rates
  getExchangeRates: (params) => api.get('/admin/exchange-rates', { params }),
  createExchangeRate: (data) => api.post('/admin/exchange-rates', data),
  updateExchangeRate: (id, data) => api.put(`/admin/exchange-rates/${id}`, data),
  deleteExchangeRate: (id) => api.delete(`/admin/exchange-rates/${id}`),
  getPendingStateSends: () => api.get('/admin/send-state/pending'),
  getPendingStateSendsCount: () => api.get('/admin/send-state/pending/count'),
  receiveStateSend: (id) => api.post(`/admin/send-state/${id}/receive`),
  cancelStateSend: (id) => api.post(`/admin/send-state/${id}/cancel`),
  getMyAdminCashedOut: () => api.get('/admin/stats/my-cashed-out'),
  getMyAdminCommission: () => api.get('/admin/stats/my-commission'),
  getAllUsers: () => api.get('/admin/users'),
  getAllTransactions: () => api.get('/admin/transactions'),
  suspendUser: (data) => api.post('/admin/suspend-user', data),
  unsuspendUser: (data) => api.post('/admin/unsuspend-user', data),
  getStats: () => api.get('/admin/stats'),
  grantLocationPermissionToAll: () => api.post('/admin/grant-location'),
  createTransaction: (data) => api.post('/admin/money-exchange', data),
  convertMoneyExchange: (data) => api.post('/admin/convert-money-exchange', data)
};

export const notificationAPI = {
  getNotifications: () => api.get('/notifications'),
  markAsRead: (data) => api.post('/notifications/mark-as-read', data),
  markAllAsRead: () => api.post('/notifications/mark-all-as-read'),
  sendToAll: (data) => api.post('/notifications/send-to-all', data),
  sendToUser: (data) => api.post('/notifications/send-to-user', data),
  delete: (id) => api.delete(`/notifications/${id}`)
};

export const withdrawalAPI = {
  requestWithdrawal: (data) => api.post('/withdrawals/request', data),
  approveRequest: (data) => api.post('/withdrawals/approve', data),
  rejectRequest: (data) => api.post('/withdrawals/reject', data),
  getPendingRequests: () => api.get('/withdrawals/pending'),
  approveAdminWithdrawalRequest: (data) => api.post('/admin/approve-withdrawal-request', data),
  rejectAdminWithdrawalRequest: (data) => api.post('/admin/reject-withdrawal-request', data),
  getAgentWithdrawalRequests: () => api.get('/admin/agent-withdrawal-requests')
};

export default api;
