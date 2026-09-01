// Get user/agent details by id or phone
export const getUserOrAgentDetails = async (req, res) => {
  try {
    const { id, phone } = req.query;
    let user;
    if (id) {
      user = await User.findByPk(id);
    } else if (phone) {
      // Normalize phone: trim and allow with or without +
      const normalized = phone.trim();
      // Try exact match first
      user = await User.findOne({ where: { phone: normalized } });
      // If not found, try with/without +
      if (!user) {
        if (normalized.startsWith('+')) {
          user = await User.findOne({ where: { phone: normalized.replace(/^\+/, '') } });
        } else {
          user = await User.findOne({ where: { phone: '+' + normalized } });
        }
      }
    } else {
      return res.status(400).json({ message: 'Missing phone or id parameter' });
    }
    if (!user) return res.status(404).json({ message: 'User, agent, or admin not found' });
    const {
      id: userId,
      name,
      email,
      phone: userPhone,
      role,
      balance,
      isVerified,
      isSuspended,
      agentId,
      adminId,
      createdAt
    } = user;
    res.json({
      id: userId,
      name,
      email,
      phone: userPhone,
      role,
      balance: parseFloat(balance),
      isVerified,
      isSuspended,
      agentId: agentId || null,
      adminId: adminId || null,
      createdAt
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Notification from '../models/Notification.js';
import WithdrawalRequest from '../models/WithdrawalRequest.js';
import { generateTransactionId, isStaffRole } from '../utils/helpers.js';
import { sendSMS } from '../utils/sms.js';
import { getIO } from '../utils/socket.js';
import SendMoneyCommissionTier from '../models/SendMoneyCommissionTier.js';
import WithdrawalCommissionTier from '../models/WithdrawalCommissionTier.js';
import StateSetting from '../models/StateSetting.js';
import Currency from '../models/Currency.js';
import ExchangeRate from '../models/ExchangeRate.js';

export const topupUser = async (req, res) => {
  try {

    const { userId, description } = req.body;
    const amount = parseFloat(req.body.amount);

    // Prevent admin from topping up their own account
    if (parseInt(userId) === parseInt(req.userId)) {
      return res.status(400).json({ message: 'Admins cannot top up their own account.' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Validate user balance exists
    if (user.balance === undefined || user.balance === null) {
      return res.status(500).json({ message: 'User balance is invalid' });
    }

    user.balance = parseFloat(user.balance) + amount;
    await user.save();

    const transactionId = generateTransactionId();
    const admin = await User.findByPk(req.userId);
    const transaction = await Transaction.create({
      transactionId,
      senderId: req.userId,
      receiverId: userId,
      amount,
      type: 'topup',
      status: 'completed',
      description,
      senderBalance: 0,
      receiverBalance: user.balance,
      senderLocation: admin?.currentLocation || null,
      receiverLocation: user.currentLocation || null
    });

    const notification = await Notification.create({
      recipientId: userId,
      title: 'Account Topped Up',
      message: `Your account has been topped up with SSP ${amount}`,
      type: 'system',
      relatedTransactionId: transaction.id
    });

    try {
      await sendSMS(user.phone, `MoneyPay: Your account has been credited with SSP ${amount}`);
    } catch (error) {
      console.error('SMS failed:', error);
    }

    // Emit socket event to update user balance in real time
    try {
      const io = getIO();
      if (io && userId) {
        io.to(`user-${userId}`).emit('balance-updated', {
          userId,
          balance: parseFloat(user.balance)
        });
      }
    } catch (e) {
      console.error('Socket emit failed:', e);
    }
    res.json({
      message: 'Topup successful',
      transaction: { id: transaction.id, transactionId, amount },
      user: { id: user.id, balance: parseFloat(user.balance) }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// State settings CRUD
export const createStateSetting = async (req, res) => {
  try {
    const { name, commissionPercent } = req.body;
    if (!name) return res.status(400).json({ message: 'State name is required' });
    const existing = await StateSetting.findOne({ where: { name } });
    if (existing) return res.status(400).json({ message: 'State already exists' });
    const s = await StateSetting.create({ name, commissionPercent: Number(commissionPercent) || 0 });
    res.json({ message: 'State created', state: s });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Currency CRUD for admin
export const createCurrency = async (req, res) => {
  try {
    const { name, code, symbol, countries, exchangeRate, tier, buyingPrice, sellingPrice, priceType } = req.body;
    if (!name || !code) return res.status(400).json({ message: 'name and code are required' });
    const existing = await Currency.findOne({ where: { code } });
    if (existing) return res.status(400).json({ message: 'Currency with this code already exists' });
    const cData = {
      name,
      code,
      symbol,
      countries: countries || [],
      tier,
      buyingPrice: buyingPrice && buyingPrice !== '' ? Number(buyingPrice) : null,
      sellingPrice: sellingPrice && sellingPrice !== '' ? Number(sellingPrice) : null,
      priceType: priceType || 'fixed'
    };
    // Only set exchangeRate if a value was provided (avoid defaulting to 1)
    if (exchangeRate !== undefined && exchangeRate !== null && exchangeRate !== '') {
      cData.exchangeRate = Number(exchangeRate);
    }
    const c = await Currency.create(cData);
    res.json({ message: 'Currency created', currency: c });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getCurrencies = async (req, res) => {
  try {
    const list = await Currency.findAll({ order: [['name', 'ASC']] });
    res.json({ currencies: list });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateCurrency = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;
    const cur = await Currency.findByPk(id);
    if (!cur) return res.status(404).json({ message: 'Currency not found' });

    const updateData = {};
    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.code !== undefined) updateData.code = payload.code;
    if (payload.symbol !== undefined) updateData.symbol = payload.symbol;
    if (Array.isArray(payload.countries)) updateData.countries = payload.countries;
    if (payload.exchangeRate !== undefined) updateData.exchangeRate = Number(payload.exchangeRate);
    if (payload.tier !== undefined) updateData.tier = payload.tier;
    if (payload.buyingPrice !== undefined) updateData.buyingPrice = payload.buyingPrice && payload.buyingPrice !== '' ? Number(payload.buyingPrice) : null;
    if (payload.sellingPrice !== undefined) updateData.sellingPrice = payload.sellingPrice && payload.sellingPrice !== '' ? Number(payload.sellingPrice) : null;
    if (payload.priceType !== undefined) updateData.priceType = payload.priceType;

    await cur.update(updateData);
    res.json({ message: 'Currency updated', currency: cur });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteCurrency = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedRowsCount = await Currency.destroy({ where: { id } });
    if (deletedRowsCount === 0) return res.status(404).json({ message: 'Currency not found' });
    res.json({ message: 'Currency deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Pairwise ExchangeRate CRUD
export const createExchangeRate = async (req, res) => {
  try {
    const { fromCode, toCode, buyingPrice, sellingPrice, priceType } = req.body;
    if (!fromCode || !toCode) return res.status(400).json({ message: 'fromCode and toCode are required' });
    const existing = await ExchangeRate.findOne({ where: { fromCode: fromCode.toUpperCase(), toCode: toCode.toUpperCase() } });
    if (existing) return res.status(400).json({ message: 'Exchange rate for this pair already exists' });
    const er = await ExchangeRate.create({
      fromCode: fromCode.toUpperCase(),
      toCode: toCode.toUpperCase(),
      buyingPrice: buyingPrice !== undefined && buyingPrice !== '' ? Number(buyingPrice) : null,
      sellingPrice: sellingPrice !== undefined && sellingPrice !== '' ? Number(sellingPrice) : null,
      priceType: priceType || 'fixed'
    });
    res.json({ message: 'Exchange rate created', exchangeRate: er });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getExchangeRates = async (req, res) => {
  try {
    const { fromCode, toCode } = req.query;
    const where = {};
    if (fromCode) where.fromCode = fromCode.toUpperCase();
    if (toCode) where.toCode = toCode.toUpperCase();
    const list = await ExchangeRate.findAll({ where, order: [['fromCode', 'ASC'], ['toCode', 'ASC']] });
    res.json({ exchangeRates: list });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateExchangeRate = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;
    const er = await ExchangeRate.findByPk(id);
    if (!er) return res.status(404).json({ message: 'Exchange rate not found' });
    const updateData = {};
    if (payload.fromCode) updateData.fromCode = payload.fromCode.toUpperCase();
    if (payload.toCode) updateData.toCode = payload.toCode.toUpperCase();
    if (typeof payload.buyingPrice !== 'undefined') updateData.buyingPrice = payload.buyingPrice !== '' ? Number(payload.buyingPrice) : null;
    if (typeof payload.sellingPrice !== 'undefined') updateData.sellingPrice = payload.sellingPrice !== '' ? Number(payload.sellingPrice) : null;
    if (payload.priceType) updateData.priceType = payload.priceType;
    await er.update(updateData);
    res.json({ message: 'Exchange rate updated', exchangeRate: er });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteExchangeRate = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedRowsCount = await ExchangeRate.destroy({ where: { id } });
    if (deletedRowsCount === 0) return res.status(404).json({ message: 'Exchange rate not found' });
    res.json({ message: 'Exchange rate deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};



export const getStateSettings = async (req, res) => {
  try {
    const states = await StateSetting.findAll({ order: [['name', 'ASC']] });
    res.json({ states });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateStateSetting = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, commissionPercent } = req.body;
    const state = await StateSetting.findByPk(id);
    if (!state) return res.status(404).json({ message: 'State not found' });
    const updateData = {};
    if (name) updateData.name = name;
    if (typeof commissionPercent !== 'undefined') updateData.commissionPercent = Number(commissionPercent) || 0;
    await state.update(updateData);
    res.json({ message: 'State updated', state });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteStateSetting = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedRowsCount = await StateSetting.destroy({ where: { id } });
    if (deletedRowsCount === 0) return res.status(404).json({ message: 'State not found' });
    res.json({ message: 'State deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin -> Admin send within/between states
export const sendMoneyBetweenAdminsByState = async (req, res) => {
  try {
    const senderId = req.userId;
    /* stateId is no longer read from the request. The origin is a property of
       who is sending, not something the sender chooses per transfer — letting
       it be picked meant an admin could book commission against a destination
       they have nothing to do with. */
    const { toAdminId, amount: amtRaw, deductCommissionFromAmount, currencyId } = req.body;
    const amount = parseFloat(amtRaw);
    if (!toAdminId || isNaN(amount) || amount <= 0) return res.status(400).json({ message: 'toAdminId and valid amount required' });

    const sender = await User.findByPk(senderId);
    const receiver = await User.findByPk(toAdminId);
    if (!sender || !isStaffRole(sender.role)) return res.status(403).json({ message: 'Sender must be an admin' });
    if (!receiver || !isStaffRole(receiver.role)) return res.status(404).json({ message: 'To Destination not found' });

    /* FROM is the sender's own destination, assigned when their account was
       created; TO is the destination of the admin being paid. Both are stored
       on the transaction so a transfer reads as "Juba -> Wau" later. */
    const fromState = sender.state ? await StateSetting.findOne({ where: { name: sender.state } }) : null;
    const toState = receiver.state ? await StateSetting.findOne({ where: { name: receiver.state } }) : null;

    if (!fromState) {
      return res.status(400).json({
        message:
          'Your account has no destination assigned, so commission cannot be calculated. ' +
          'Ask an administrator to set your destination.',
      });
    }

    /* Commission is based on the sender's own destination (From Destination) */
    const percent = fromState ? parseFloat(fromState.commissionPercent) || 0 : 0;
    const commissionAmount = Math.round((amount * (percent / 100)) * 100) / 100; // 2 decimals

    // Apply transfer logic (admins have unlimited send rights - no balance check needed)
    let companyCommission = 0;
    let senderCommissionGiven = 0;
    let receiverCommissionGiven = 0;
    let senderDebit = amount;
    let receiverCredit = amount;

    if (deductCommissionFromAmount) {
      // Deduct mode: receiver gets amount less commission, sender gets the commission
      senderCommissionGiven = commissionAmount;
      receiverCredit = Math.round((amount - commissionAmount) * 100) / 100;
      senderDebit = amount;
    } else {
      // Full amount mode: sender sends full amount, receiver gets full amount,
      // commission is added to sender's card
      senderCommissionGiven = commissionAmount;
      senderDebit = amount;
      receiverCredit = amount;
    }

    // Update sender balance only and create a PENDING transaction
    const currentSenderBalance = parseFloat(sender.balance) || 0;
    sender.balance = Math.round((currentSenderBalance - senderDebit) * 100) / 100;
    await sender.update({ balance: sender.balance });

    // attach currency if provided
    let currencyCode = null;
    let currencySymbol = null;
    let exchangeRate = 1;
    let currencyTier = null;
    if (currencyId) {
      try {
        const cur = await Currency.findByPk(currencyId);
        if (cur) {
          currencyCode = cur.code;
          currencySymbol = cur.symbol;
          exchangeRate = Number(cur.exchangeRate) || 1;
          currencyTier = cur.tier || cur.name;
        }
      } catch (e) {
        console.warn('Currency lookup failed', e.message);
      }
    }

    // Create pending transaction record (receiver will confirm to complete)
    const transaction = await Transaction.create({
      transactionId: generateTransactionId(),
      senderId: senderId,
      receiverId: toAdminId,
      amount,
      type: 'admin_state_push',
      status: 'pending',
      /* "Destination" is what this is called throughout the UI — Send To
         Destination, Destination Settings — so the description matches rather
         than calling it a state. It now names both ends of the journey. */
      description: toState
        ? `Admin transfer from ${fromState.name} to ${toState.name}`
        : `Admin transfer from ${fromState.name}`,
      fromStateId: fromState.id,
      fromStateName: fromState.name,
      toStateId: toState ? toState.id : null,
      toStateName: toState ? toState.name : null,
      commission: senderCommissionGiven,
      receiverCommission: receiverCommissionGiven,
      commissionPercent: senderCommissionGiven ? percent : 0,
      companyCommission: companyCommission,
      companyCommissionPercent: companyCommission ? percent : 0,
      receiverCredit: receiverCredit,
      currencyCode,
      currencySymbol,
      exchangeRate,
      currencyTier,
      senderBalance: sender.balance,
      receiverBalance: receiver.balance,
      senderLocation: sender.currentLocation || null,
      receiverLocation: receiver.currentLocation || null
    });

    console.log('Pending transaction created:', {
      id: transaction.id,
      sender: transaction.sender,
      receiver: transaction.receiver,
      type: transaction.type,
      commission: transaction.commission,
      amount: transaction.amount,
      receiverCredit: transaction.receiverCredit
    });

    // Notifications (inform receiver there's a pending transfer)
    await Notification.create({
      recipientId: toAdminId,
      title: 'Admin Transfer Pending',
      message: `You have a pending transfer of SSP ${receiverCredit.toFixed(2)} from admin ${sender.name}`,
      type: 'system',
      relatedTransactionId: transaction.id
    });
    await Notification.create({
      recipientId: senderId,
      title: 'Admin Transfer Created',
      message: `You created a pending transfer of SSP ${amount.toFixed(2)} to admin ${receiver.name}`,
      type: 'system',
      relatedTransactionId: transaction.id
    });

    try { await sendSMS(receiver.phone, `MoneyPay: You have a pending transfer of SSP ${receiverCredit.toFixed(2)} from admin ${sender.name}`); } catch (e) {}
    try { await sendSMS(sender.phone, `MoneyPay: You created a pending transfer of SSP ${amount.toFixed(2)} to admin ${receiver.name}`); } catch (e) {}

    // Emit socket update for sender balance only
    try {
      const io = getIO();
      if (io) {
        io.to(`user-${senderId}`).emit('balance-updated', { userId: senderId, balance: parseFloat(sender.balance) });
      }
    } catch (err) {
      console.error('Socket emit failed:', err);
    }

    res.json({ message: 'Transfer created and pending', transactionId: transaction.transactionId, transaction });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const withdrawFromUser = async (req, res) => {
  try {
    const { userId, description } = req.body;
    const amount = parseFloat(req.body.amount);

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Validate user balance exists
    if (user.balance === undefined || user.balance === null) {
      return res.status(500).json({ message: 'User balance is invalid' });
    }

    if (parseFloat(user.balance) < amount) {
      return res.status(400).json({ message: 'Insufficient user balance' });
    }

    user.balance = parseFloat(user.balance) - amount;
    await user.update({ balance: user.balance });

    const transactionId = generateTransactionId();
    const admin = await User.findByPk(req.userId);
    const transaction = await Transaction.create({
      transactionId,
      senderId: userId,
      receiverId: req.userId,
      amount,
      type: 'withdrawal',
      status: 'completed',
      description,
      senderBalance: user.balance,
      receiverBalance: 0,
      senderLocation: user.currentLocation || null,
      receiverLocation: admin?.currentLocation || null
    });

    await Notification.create({
      recipientId: userId,
      title: 'Withdrawal Processed',
      message: `SSP ${amount} has been withdrawn from your account`,
      type: 'system',
      relatedTransactionId: transaction.id
    });

    try {
      await sendSMS(user.phone, `MoneyPay: SSP ${amount} has been withdrawn from your account`);
    } catch (error) {
      console.error('SMS failed:', error);
    }

    res.json({
      message: 'Withdrawal successful',
      transaction: { id: transaction.id, transactionId, amount }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const withdrawFromAgent = async (req, res) => {
  try {
    console.log('POST /api/admin/withdraw-from-agent called');
    console.log('Request body:', req.body);
    console.log('Request userId:', req.userId);
    const { agentId, description } = req.body;
    const amount = parseFloat(req.body.amount);
    const adminId = req.userId;

    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    const agent = await User.findByPk(agentId);
    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    if (agent.role !== 'agent') {
      return res.status(400).json({ message: 'Specified user is not an agent' });
    }

    // Validate agent balance exists
    if (agent.balance === undefined || agent.balance === null) {
      return res.status(500).json({ message: 'Agent balance is invalid' });
    }

    if (agent.balance < amount) {
      return res.status(400).json({ message: 'Insufficient agent balance' });
    }

    // If agent does NOT allow instant admin cashouts (autoAdminCashout = false), approval IS needed
    // Send request to agent for approval
    if (!agent.autoAdminCashout) {
      const request = await WithdrawalRequest.create({
        agentId: agentId,
        userId: adminId,
        amount: amount,
        commission: 0,
        commissionPercent: 0,
        companyCommission: 0,
        companyCommissionPercent: 0,
        status: 'pending',
        description: 'Admin cash out request'
      });

      // Notify agent of withdrawal request
      await Notification.create({
        recipientId: agentId,
        title: 'Cash Out Request from Admin',
        message: `Admin requested to cash out SSP ${amount} from your agent account. Please approve or reject.`,
        type: 'withdrawal_request',
        relatedTransactionId: request.id
      });

      // Emit socket event so agent gets a real-time notification
      try {
        const io = getIO();
        if (io) {
          io.to(`user-${agentId}`).emit('new-notification', {
            recipient: agentId,
            title: notification.title,
            message: notification.message,
            type: notification.type,
            relatedTransaction: request.id
          });
        }
      } catch (err) {
        console.error('Socket emit failed:', err);
      }

      try {
        await sendSMS(agent.phone, `MoneyPay: Admin requested to cash out SSP ${amount} from your agent account. Please approve or reject.`);
      } catch (err) {
        console.error('SMS failed:', err);
      }

      return res.json({
        message: 'Cash out request created and sent to agent for approval',
        request: {
          id: request.id,
          amount: request.amount,
          status: request.status
        }
      });
    }

    // If agent allows instant admin cashouts (autoAdminCashout = true), process immediately
    if (agent.autoAdminCashout) {
      const parsedAmount = parseFloat(amount) || 0;
      const agentBalance = parseFloat(agent.balance) || 0;
      if (agentBalance < parsedAmount) {
        return res.status(400).json({ message: 'Insufficient agent balance' });
      }

      // Get admin user to credit
      const admin = await User.findByPk(adminId);
      if (!admin) return res.status(404).json({ message: 'Admin not found' });

      const adminBalance = parseFloat(admin.balance) || 0;

      // Update balances
      agent.balance = agentBalance - parsedAmount;
      admin.balance = adminBalance + parsedAmount;

      await agent.update({ balance: agent.balance });
      await admin.update({ balance: admin.balance });

      // Create transaction
      const transactionId = generateTransactionId();
      const transaction = await Transaction.create({
        transactionId,
        senderId: agentId,
        receiverId: adminId,
        amount: parsedAmount,
        type: 'agent_cash_out_money',
        status: 'completed',
        commission: 0,
        commissionPercent: 0,
        companyCommission: 0,
        companyCommissionPercent: 0,
        senderBalance: agent.balance,
        receiverBalance: admin.balance,
        senderLocation: agent.currentLocation || null,
        receiverLocation: admin.currentLocation || null
      });

      const notification = await Notification.create({
        recipientId: agentId,
        title: 'Admin Cash Out Processed',
        message: `Admin cashed out SSP ${parsedAmount} from your agent account.`,
        type: 'transaction',
        relatedTransactionId: transaction.id
      });

      try { await sendSMS(agent.phone, `MoneyPay: Admin cashed out SSP ${parsedAmount} from your account.`); } catch (e) { console.error('SMS failed:', e); }

      // Emit socket events
      try {
        const io = getIO();
        if (io) {
          io.to(`user-${agentId}`).emit('balance-updated', { userId: agentId, balance: parseFloat(agent.balance) });
          io.to(`user-${adminId}`).emit('balance-updated', { userId: adminId, balance: parseFloat(admin.balance) });
          io.to(`user-${agentId}`).emit('new-notification', { recipient: agentId, title: notification.title, message: notification.message, type: notification.type });
        }
      } catch (err) {
        console.error('Socket emit failed:', err);
      }

      return res.json({ message: 'Cash out processed', agent });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const findAgentByAgentId = async (req, res) => {
  try {
    const { agentId } = req.query;

    if (!agentId) {
      return res.status(400).json({ message: 'agentId is required' });
    }

    const agent = await User.findOne({ where: { agentId }, attributes: ['id', 'name', 'phone', 'balance', 'role', 'isVerified', 'autoAdminCashout', 'currentLocation'] });

    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    if (agent.role !== 'agent') {
      return res.status(400).json({ message: 'Specified user is not an agent' });
    }

    res.json({
      ...agent.toJSON(),
      balance: parseFloat(agent.balance) || 0
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    /* A sub-admin has no Users page; the only reason they reach this endpoint
       is the Send To Destination form, which needs the list of admins to send
       to. Returning the full directory to satisfy that would hand them every
       customer's balance, email and phone, so they get the admins only. */
    const staffOnly = req.userRole === 'sub-admin';
    const users = await User.findAll({
      where: staffOnly ? { role: ['admin', 'sub-admin'] } : undefined,
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']],
    });
    const usersWithNumericBalance = users.map(user => ({
      ...user.toJSON(),
      balance: parseFloat(user.balance) || 0
    }));
    res.json(usersWithNumericBalance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};;

export const getAllTransactions = async (req, res) => {
  try {
    /* An admin sees the whole ledger. A sub-admin sees their own destination:
       transfers in or out of it, plus anything they handled themselves.

       The second half is not redundant. Only admin_state_push records a
       destination — a top-up, a withdrawal or an exchange carries none — so a
       state match alone would hide a sub-admin's own work from them. Matching
       on their id as well brings that back, and it is also what scopes the
       exchange list: an exchange stores the acting admin as its sender, so
       theirs match and other people's cannot. */
    let where;
    if (req.userRole === 'sub-admin') {
      const me = await User.findByPk(req.userId, { attributes: ['id', 'state'] });
      const mine = [{ senderId: req.userId }, { receiverId: req.userId }];
      const ofState = me && me.state
        ? [{ fromStateName: me.state }, { toStateName: me.state }]
        : [];
      where = { [Op.or]: [...mine, ...ofState] };
    }

    const transactions = await Transaction.findAll({
      where,
      include: [
        { model: User, as: 'sender', attributes: ['name', 'phone', 'role'] },
        { model: User, as: 'receiver', attributes: ['name', 'phone', 'role'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const suspendUser = async (req, res) => {
  try {
    const { userId } = req.body;

    const user = await User.findByPk(userId);
    if (user) {
      await user.update({ isSuspended: true });
    }

    await Notification.create({
      recipientId: userId,
      title: 'Account Suspended',
      message: 'Your account has been suspended. Contact support for details.',
      type: 'alert'
    });

    try {
      const foundUser = await User.findByPk(userId);
      await sendSMS(foundUser.phone, 'MoneyPay: Your account has been suspended');
    } catch (error) {
      console.error('SMS failed:', error);
    }

    res.json({ message: 'User suspended', user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};;

export const unsuspendUser = async (req, res) => {
  try {
    const { userId } = req.body;

    const user = await User.findByPk(userId);
    if (user) {
      await user.update({ isSuspended: false });
    }

    await Notification.create({
      recipientId: userId,
      title: 'Account Restored',
      message: 'Your account has been restored. You can now access all features.',
      type: 'system'
    });

    try {
      const foundUser = await User.findByPk(userId);
      await sendSMS(foundUser.phone, 'MoneyPay: Your account has been restored');
    } catch (error) {
      console.error('SMS failed:', error);
    }

    res.json({ message: 'User unsuspended', user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAdminStats = async (req, res) => {
  try {
    const totalUsers = await User.count();
    const totalTransactions = await Transaction.count();

    /* Total Cash Out counts cash-outs only.

       It used to sum every type except money_exchange, so transfers, top-ups,
       withdrawals and admin pushes all landed in the same figure — which made
       it a total of unrelated movements rather than a volume of anything in
       particular.

       'agent_cash_out_money' is the cash-out type; the same filter is used by
       totalAdminCashOut below, so the two figures agree on what a cash-out is.
       Withdrawals ('withdrawal', 'user_withdraw') are deliberately excluded —
       they are a different operation. */
    const totalVolume = await Transaction.sum('amount', {
      where: { type: 'agent_cash_out_money' }
    }) || 0;

    /* Money loaded into the system, shown on the dashboard as "Total Volume".
       Separate from the cash-out figures, which measure money going out. */
    const totalTopupVolume = await Transaction.sum('amount', {
      where: { type: 'topup' }
    }) || 0;
    const completedTransactions = await Transaction.count({ where: { status: 'completed' } });
    const pendingTransactions = await Transaction.count({ where: { status: 'pending' } });

    // Group by the statuses that actually exist, rather than deriving a
    // "failed" bucket as total - completed - pending, which silently relabels
    // any other status (cancelled, rejected, ...) as a failure.
    const transactionsByStatus = await Transaction.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('status')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    // Get users by role
    const usersByRole = await User.findAll({
      attributes: [
        'role',
        [sequelize.fn('COUNT', sequelize.col('role')), 'count']
      ],
      group: ['role'],
      raw: true
    });

    /* This admin's own cash-outs, not every admin's. The unscoped sum showed
       the same company-wide figure on every admin's dashboard, so an admin who
       had taken 300 saw 400 because a colleague had taken the other 100.
       An admin is the RECEIVER of an agent cash-out, which is how
       getMyAdminCashOut below already scopes it. */
    const totalAdminCashOut = await Transaction.sum('amount', {
      where: { type: 'agent_cash_out_money', receiverId: req.userId }
    }) || 0;

    /* Exchange activity for THIS admin, grouped by the PAIR rather than the
       source currency alone. "Exchanges in SSP" lumped SSP->USD together with
       SSP->UGX, which are different trades; the card now names both ends, as
       "SSP - USD".

       currencyCode holds the currency sold and toCurrencyCode the one bought.
       Rows written before toCurrencyCode existed left it null but put the
       bought currency in currencySymbol — that column has always held a code
       here, not a symbol — so it stands in for them. */
    const myExchangeRows = await Transaction.findAll({
      attributes: [
        'currencyCode',
        'toCurrencyCode',
        'currencySymbol',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'total'],
        /* What the pair bought, so the card can state both sides.

           Rows written before convertedAmount existed leave it null, which
           would drop them from the total and leave those cards with only half
           the trade. The rate is on the row though, so the figure is derived
           from it: on every row that stores both, amount * exchangeRate equals
           convertedAmount exactly, and for the older rows it reproduces the
           number written in their own description. */
        [
          sequelize.fn('SUM', sequelize.literal('COALESCE(`convertedAmount`, `amount` * `exchangeRate`)')),
          'converted',
        ]
      ],
      /* An admin oversees the desk, so they see every exchange anyone has
         made. A sub-admin sees only their own — the same line their scoped
         transaction list draws. Exchanges can only be created through a
         staff-only endpoint, so "everything" is already "everything by an
         admin or sub-admin". */
      where: {
        type: 'money_exchange',
        ...(req.userRole === 'sub-admin' ? { senderId: req.userId } : {}),
      },
      group: ['currencyCode', 'toCurrencyCode', 'currencySymbol'],
      raw: true
    });

    const myExchangesByCurrency = myExchangeRows.reduce((acc, r) => {
      const from = (r.currencyCode || '').toUpperCase();
      const to = (r.toCurrencyCode || r.currencySymbol || '').toUpperCase();
      if (!from) return acc;
      /* A row with no destination recorded at all is still counted against its
         source rather than dropped. */
      const key = to && to !== from ? from + ' - ' + to : from;
      const seen = acc[key] || { count: 0, total: 0, converted: 0, from, to: to || null };
      seen.count += Number(r.count) || 0;
      seen.total += Number(r.total) || 0;
      seen.converted += Number(r.converted) || 0;
      acc[key] = seen;
      return acc;
    }, {});

    /* Destination-send commission this admin earned, split by currency and
       zero-filled from the Currencies table — a currency that has earned
       nothing still gets a card, and a newly added currency gets one the
       moment it exists, without another code change. */
    const commissionRows = await Transaction.findAll({
      attributes: [
        'currencyCode',
        [sequelize.fn('SUM', sequelize.col('commission')), 'total'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      where: {
        type: 'admin_state_push',
        /* An admin oversees the desk, so these cards count every destination
           send anyone made. A sub-admin sees only their own — the same split
           their transaction list and exchange cards already use. */
        ...(req.userRole === 'sub-admin' ? { senderId: req.userId } : {}),
        /* A cancelled transfer earned nothing. Its commission stays on the row
           so the record is honest, so it has to be excluded here by status. */
        status: { [Op.ne]: 'cancelled' },
        commission: { [Op.gt]: 0 },
      },
      group: ['currencyCode'],
      raw: true,
    });

    const currencies = await Currency.findAll({
      attributes: ['code', 'name'],
      order: [['code', 'ASC']],
      raw: true,
    });

    const earned = commissionRows.reduce((acc, r) => {
      /* Older rows predate the currency columns; SSP is the base currency
         every balance is held in, so an unlabelled row belongs to it. */
      const code = (r.currencyCode || 'SSP').toUpperCase();
      acc[code] = acc[code] || { total: 0, count: 0 };
      acc[code].total += Number(r.total) || 0;
      acc[code].count += Number(r.count) || 0;
      return acc;
    }, {});

    /* Union of configured currencies and any code that has actually earned,
       so a commission booked against a since-deleted currency is not lost. */
    const codes = [...new Set([
      ...currencies.map((c) => (c.code || '').toUpperCase()).filter(Boolean),
      ...Object.keys(earned),
    ])].sort();

    const myCommissionByCurrency = codes.map((code) => ({
      code,
      name: (currencies.find((c) => (c.code || '').toUpperCase() === code) || {}).name || code,
      total: earned[code] ? earned[code].total : 0,
      count: earned[code] ? earned[code].count : 0,
    }));

    // Get company benefits (total company commission)
    const companyBenefits = await Transaction.sum('companyCommission', {
      where: { status: 'completed' }
    }) || 0;

    res.json({
      totalUsers,
      totalTransactions,
      totalVolume,
      totalTopupVolume,
      myCommissionByCurrency,
      completedTransactions,
      pendingTransactions,
      usersByRole,
      transactionsByStatus,
      totalAdminCashOut,
      companyBenefits,
      myExchangesByCurrency
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const grantLocationPermissionToAll = async (req, res) => {
  try {
    const [affectedRows] = await User.update({ adminLocationConsent: true }, { where: {} });
    res.json({ message: 'Admin location consent granted to all users', modifiedCount: affectedRows });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getCommission = async (req, res) => {
  try {
    // Return default values since we now use only tiered commissions
    res.json({
      percent: 0,
      sendPercent: 0,
      withdrawPercent: 0
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const setCommission = async (req, res) => {
  try {
    // Commission settings are now handled via TieredCommissions only
    // Return success but don't modify anything
    res.json({ message: 'Commission settings are now managed via Tiered Commissions' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Request agent withdrawal (pending agent approval)
export const requestAgentWithdrawal = async (req, res) => {
  try {
    const { agentId, amount } = req.body;
    const adminId = req.userId;
    const parsedAmount = parseFloat(amount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    const agent = await User.findByPk(agentId);
    if (!agent || agent.role !== 'agent') {
      return res.status(400).json({ message: 'Agent not found' });
    }

    // Validate agent balance exists
    if (agent.balance === undefined || agent.balance === null) {
      return res.status(500).json({ message: 'Agent balance is invalid' });
    }

    if (agent.balance < parsedAmount) {
      return res.status(400).json({ message: 'Insufficient agent balance' });
    }

    // If agent allows instant admin cashouts, process immediately
    if (agent.autoAdminCashout) {
      const amountToProcess = parsedAmount || 0;
      const agentBalance = parseFloat(agent.balance) || 0;
      if (agentBalance < amountToProcess) {
        return res.status(400).json({ message: 'Insufficient agent balance' });
      }

      const admin = await User.findByPk(adminId);
      if (!admin) return res.status(404).json({ message: 'Admin not found' });

      const adminBalance = parseFloat(admin.balance) || 0;

      agent.balance = agentBalance - amountToProcess;
      admin.balance = adminBalance + amountToProcess;

      await agent.update({ balance: agent.balance });
      await admin.update({ balance: admin.balance });

      const transactionId = generateTransactionId();
      const transaction = await Transaction.create({
        transactionId,
        senderId: agentId,
        receiverId: adminId,
        amount: amountToProcess,
        type: 'agent_cash_out_money',
        status: 'completed',
        commission: 0,
        commissionPercent: 0,
        companyCommission: 0,
        companyCommissionPercent: 0,
        senderBalance: agent.balance,
        receiverBalance: admin.balance,
        senderLocation: agent.currentLocation || null,
        receiverLocation: admin.currentLocation || null
      });

      const notification = await Notification.create({
        recipientId: agentId,
        title: 'Withdrawal Processed by Admin',
        message: `Admin withdrew SSP ${amountToProcess} from your account.`,
        type: 'transaction',
        relatedTransactionId: transaction.id
      });

      try { await sendSMS(agent.phone, `MoneyPay: Admin withdrew SSP ${amountToProcess} from your account.`); } catch (e) { console.error('SMS failed:', e); }

      try {
        const io = getIO();
        if (io) {
          io.to(`user-${agentId}`).emit('balance-updated', { userId: agentId, balance: parseFloat(agent.balance) });
          io.to(`user-${adminId}`).emit('balance-updated', { userId: adminId, balance: parseFloat(admin.balance) });
        }
      } catch (err) {
        console.error('Socket emit failed:', err);
      }

      return res.json({ message: 'Withdrawal processed', agent });
    }

    // For admin cash-out requests from agent, do NOT charge commission — create a pending request
    const request = await WithdrawalRequest.create({
      agent: agentId,
      user: adminId,
      amount: parsedAmount,
      commission: 0,
      commissionPercent: 0,
      companyCommission: 0,
      companyCommissionPercent: 0,
      status: 'pending'
    });

    // Notify agent of withdrawal request
    await Notification.create({
      recipientId: agentId,
      title: 'Withdrawal Request from Admin',
      message: `Admin requested to withdraw SSP ${parsedAmount} from your account. Please approve or reject.`,
      type: 'withdrawal_request',
      relatedTransactionId: request.id
    });

    try {
      await sendSMS(agent.phone, `MoneyPay: Admin requested to withdraw SSP ${parsedAmount} from your account. Please approve or reject.`);
    } catch (err) {
      console.error('SMS failed:', err);
    }

    res.json({
      message: 'Withdrawal request created and sent to agent',
      request: {
        id: request.id,
        amount: request.amount,
        status: request.status
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Agent approves admin withdrawal request
export const approveAdminWithdrawalRequest = async (req, res) => {
  try {
    const { requestId } = req.body;
    const agentId = req.userId;

    const request = await WithdrawalRequest.findByPk(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.agentId.toString() !== agentId.toString()) {
      return res.status(403).json({ message: 'Only the agent can approve their withdrawal' });
    }

    if (request.status !== 'pending') {
      return res.status(409).json({ 
        message: `Request has already been ${request.status}`,
        currentStatus: request.status
      });
    }

    const agent = await User.findByPk(agentId);
    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    // Validate agent balance exists
    if (agent.balance === undefined || agent.balance === null) {
      return res.status(500).json({ message: 'Agent balance is invalid' });
    }

    // Coerce numeric values to avoid issues when amounts or balances are strings
    const parsedAmount = parseFloat(request.amount) || 0;

    // Ensure agent balance is numeric
    const agentBalance = parseFloat(agent.balance) || 0;

    // Check balance again (only debit the request amount)
    const totalDebit = parsedAmount;
    if (agentBalance < totalDebit) {
      await request.update({ status: 'rejected', rejectedAt: new Date() });
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    // Get the admin user to credit their balance
    const admin = await User.findByPk(request.userId);
    if (!admin) {
      return res.status(404).json({ message: 'Admin user not found' });
    }

    // Ensure admin balance is numeric
    const adminBalance = parseFloat(admin.balance) || 0;

    // Process withdrawal: update agent balance and save
    agent.balance = agentBalance - totalDebit;
    await agent.update({ balance: agent.balance });

    // Credit admin's balance and save
    admin.balance = adminBalance + parsedAmount;
    await admin.update({ balance: admin.balance });

    // Create transaction
    const transactionId = generateTransactionId();
    const transaction = await Transaction.create({
      transactionId,
      senderId: agentId,
      receiverId: request.userId,
      amount: parsedAmount,
      type: 'agent_cash_out_money',
      status: 'completed',
      commission: request.commission,
      commissionPercent: request.commissionPercent,
      companyCommission: request.companyCommission || 0,
      companyCommissionPercent: request.companyCommissionPercent || 0,
      senderBalance: agent.balance,
      receiverBalance: admin.balance || 0,
      senderLocation: agent.currentLocation || null,
      receiverLocation: admin.currentLocation || null
    });

    // Update request status
    await request.update({ status: 'approved', approvedAt: new Date() });

    // Notify
    const notification = await Notification.create({
      recipientId: agentId,
      title: 'Withdrawal Approved',
      message: `Your withdrawal of SSP ${request.amount} has been completed.`,
      type: 'transaction',
      relatedTransactionId: transaction.id
    });

    try {
      await sendSMS(agent.phone, `MoneyPay: Your withdrawal of SSP ${request.amount} has been completed.`);
    } catch (err) {
      console.error('SMS failed:', err);
    }

    // Emit socket events to update connected clients about balance change and new notification
    try {
      const io = getIO();
      if (io) {
        io.to(`user-${agentId}`).emit('balance-updated', {
          userId: agentId,
          balance: parseFloat(agent.balance)
        });

        io.to(`user-${request.userId}`).emit('balance-updated', {
          userId: request.userId,
          balance: parseFloat(admin.balance)
        });

        io.to(`user-${agentId}`).emit('new-notification', {
          recipient: agentId,
          title: notification.title,
          message: notification.message,
          type: notification.type
        });
      }
    } catch (err) {
      console.error('Socket emit failed:', err);
    }

    res.json({
      message: 'Withdrawal approved and processed',
      transaction: { _id: transaction._id, transactionId, amount: request.amount }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Agent rejects admin withdrawal request
export const rejectAdminWithdrawalRequest = async (req, res) => {
  try {
    const { requestId, reason } = req.body;
    const agentId = req.userId;

    const request = await WithdrawalRequest.findByPk(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.agentId.toString() !== agentId.toString()) {
      return res.status(403).json({ message: 'Only the agent can reject their withdrawal' });
    }

    if (request.status !== 'pending') {
      return res.status(409).json({ 
        message: `Request has already been ${request.status}`,
        currentStatus: request.status
      });
    }

    await request.update({ status: 'rejected', rejectedAt: new Date(), reason });

    // Notify
    const notification = await Notification.create({
      recipient: agentId,
      title: 'Withdrawal Rejected',
      message: `You rejected the admin withdrawal request of SSP ${request.amount}`,
      type: 'system'
    });

    // Emit socket event to notify admin their request was rejected
    try {
      const io = getIO();
      if (io) {
        io.to(`user-${request.userId}`).emit('new-notification', {
          recipient: request.userId,
          title: 'Withdrawal Request Rejected',
          message: `Agent rejected your withdrawal request of SSP ${request.amount}`,
          type: 'system'
        });
      }
    } catch (err) {
      console.error('Socket emit failed:', err);
    }

    res.json({ message: 'Withdrawal request rejected' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get pending admin withdrawal requests for agent
export const getAgentWithdrawalRequests = async (req, res) => {
  try {
    const agentId = req.userId;

    const requests = await WithdrawalRequest.findAll({
      where: { agentId: agentId, status: 'pending' },
      include: [{ model: User, as: 'user', attributes: ['name', 'phone'] }],
      order: [['createdAt', 'DESC']]
    });

    res.json({ requests });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const pushMoneyBetweenUsers = async (req, res) => {
  try {
    const { fromPhone, toPhone, amount: amtRaw, description } = req.body;
    const amount = parseFloat(amtRaw);
    
    // Normalize phone numbers (trim whitespace)
    const normalizedFromPhone = fromPhone?.trim();
    const normalizedToPhone = toPhone?.trim();
    
    if (!normalizedFromPhone || !normalizedToPhone || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: 'fromPhone, toPhone and valid amount are required' });
    }

    if (normalizedFromPhone === normalizedToPhone) {
      return res.status(400).json({ message: 'Source and destination cannot be the same' });
    }

    const actingAdmin = await User.findByPk(req.userId);
    const fromUser = await User.findOne({ where: { phone: normalizedFromPhone } });
    const toUser = await User.findOne({ where: { phone: normalizedToPhone } });

    if (!fromUser) return res.status(404).json({ message: 'Source user not found' });
    if (!toUser) return res.status(404).json({ message: 'Destination user not found' });

    // Validate balances exist
    if (fromUser.balance === undefined || fromUser.balance === null) {
      return res.status(500).json({ message: 'Source user balance is invalid' });
    }
    if (toUser.balance === undefined || toUser.balance === null) {
      return res.status(500).json({ message: 'Destination user balance is invalid' });
    }

    if (fromUser.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance on source user' });
    }

    // Adjust balances
    const fromPreviousBalance = parseFloat(fromUser.balance);
    const toPreviousBalance = parseFloat(toUser.balance);
    
    fromUser.balance = fromPreviousBalance - amount;
    toUser.balance = toPreviousBalance + amount;

    await fromUser.update({ balance: fromUser.balance });
    await toUser.update({ balance: toUser.balance });

    // Create transaction record
    const transaction = await Transaction.create({
      transactionId: generateTransactionId(),
      senderId: fromUser.id,
      receiverId: toUser.id,
      amount,
      type: 'admin_push',
      status: 'completed',
      /* Records WHO moved the money, not just that an admin did. These pushes
         are corrections, so the acting admin has to be identifiable from the
         transaction itself when it is queried later. */
      description: description || `Refunded by admin (${actingAdmin?.email || 'unknown admin'}) from ${normalizedFromPhone} to ${normalizedToPhone}`,
      senderBalance: fromUser.balance,
      receiverBalance: toUser.balance,
      senderLocation: fromUser.currentLocation || null,
      receiverLocation: toUser.currentLocation || null,
      commission: 0,
      commissionPercent: 0,
      agentCommission: 0,
      agentCommissionPercent: 0,
      companyCommission: 0,
      companyCommissionPercent: 0
    });

    // Notifications
    await Notification.create({
      recipientId: fromUser.id,
      title: 'Debit by Admin',
      message: `SSP ${amount.toFixed(2)} was debited from your account by admin`,
      type: 'system',
      relatedTransactionId: transaction.id
    });
    await Notification.create({
      recipientId: toUser.id,
      title: 'Credit by Admin',
      message: `SSP ${amount.toFixed(2)} was credited to your account by admin`,
      type: 'system',
      relatedTransactionId: transaction.id
    });

    // Try SMS (non-blocking)
    try { await sendSMS(fromUser.phone, `MoneyPay: SSP ${amount.toFixed(2)} debited from your account by admin.`); } catch (e) { }
    try { await sendSMS(toUser.phone, `MoneyPay: SSP ${amount.toFixed(2)} credited to your account by admin.`); } catch (e) { }

    res.json({ message: 'Transfer completed', transactionId: transaction.transactionId });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getTieredCommission = async (req, res) => {
  try {
    // Get send-money tiers
    const sendTiers = await SendMoneyCommissionTier.findAll({
      order: [['minAmount', 'ASC']]
    });

    // Get withdrawal tiers
    const withdrawalTiers = await WithdrawalCommissionTier.findAll({
      order: [['minAmount', 'ASC']]
    });

    res.json({
      tiers: sendTiers,
      withdrawalTiers: withdrawalTiers
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const setTieredCommission = async (req, res) => {
  try {
    const { tiers, withdrawalTiers } = req.body;

    // Update or create send-money tiers
    let sendDoc = await TieredCommission.findOne({ where: { type: 'send-money' } });
    if (sendDoc) {
      await sendDoc.update({ tiers: tiers || [] });
    } else {
      sendDoc = await TieredCommission.create({ type: 'send-money', tiers: tiers || [] });
    }

    // Update or create withdrawal tiers
    let withdrawDoc = await TieredCommission.findOne({ where: { type: 'withdraw' } });
    if (withdrawDoc) {
      await withdrawDoc.update({ withdrawalTiers: withdrawalTiers || [] });
    } else {
      withdrawDoc = await TieredCommission.create({ type: 'withdraw', withdrawalTiers: withdrawalTiers || [] });
    }

    res.json({
      message: 'Tiered commission settings saved successfully',
      tiers: sendDoc.tiers,
      withdrawalTiers: withdrawDoc.withdrawalTiers
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const setSendMoneyTiers = async (req, res) => {
  try {
    const { tiers } = req.body;

    if (!Array.isArray(tiers)) {
      return res.status(400).json({ message: 'Tiers must be an array' });
    }

    // Delete all existing send money tiers
    await SendMoneyCommissionTier.destroy({ where: {} });

    // Create new send money tiers
    const createdTiers = [];
    for (const tier of tiers) {
      const newTier = await SendMoneyCommissionTier.create({
        minAmount: tier.minAmount,
        maxAmount: tier.maxAmount,
        companyPercent: tier.companyPercent || 0,
        userPercent: tier.userPercent || 0
      });
      createdTiers.push(newTier);
    }

    res.json({
      message: 'Send Money Commission Tiers saved successfully',
      tiers: createdTiers
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const setWithdrawalTiers = async (req, res) => {
  try {
    const { withdrawalTiers } = req.body;

    if (!Array.isArray(withdrawalTiers)) {
      return res.status(400).json({ message: 'Withdrawal tiers must be an array' });
    }

    // Delete all existing withdrawal tiers
    await WithdrawalCommissionTier.destroy({ where: {} });

    // Create new withdrawal tiers
    const createdTiers = [];
    for (const tier of withdrawalTiers) {
      const newTier = await WithdrawalCommissionTier.create({
        minAmount: tier.minAmount,
        maxAmount: tier.maxAmount,
        agentPercent: tier.agentPercent || 0,
        companyPercent: tier.companyPercent || 0
      });
      createdTiers.push(newTier);
    }

    res.json({
      message: 'Withdrawal Commission Tiers saved successfully',
      withdrawalTiers: createdTiers
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Return the total 'agent_cash_out_money' amount received by the logged-in admin
export const getMyAdminCashOut = async (req, res) => {
  try {
    const adminId = req.userId;
    const total = await Transaction.sum('amount', {
      where: { type: 'agent_cash_out_money', receiverId: adminId }
    }) || 0;
    res.json({ totalAdminCashOut: total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Return total commission earned by the logged-in admin from admin_state_push transfers
export const getMyAdminCommission = async (req, res) => {
  try {
    const adminId = req.userId;
    
    // All commission goes to sender (both deduct and full amount modes)
    const totalCommission = await Transaction.sum('commission', {
      where: {
          senderId: adminId,
          type: 'admin_state_push',
          status: { [Op.ne]: 'cancelled' },
          commission: { [Op.gt]: 0 },
        }
    }) || 0;
    
    res.json({ totalAdminCommission: parseFloat(totalCommission) });
  } catch (err) {
    console.error('getMyAdminCommission error:', err);
    res.status(500).json({ message: err.message });
  }
};

// Get pending send-by-state transactions
export const getPendingSendByState = async (req, res) => {
  try {
    const adminId = req.userId;
    const admin = await User.findByPk(adminId);
    if (!admin) return res.json({ pending: [] });

    /* An admin oversees every destination, so they see every transfer. A
       sub-admin works one destination and sees what touches it:
       - the destination they receive into
       - the requests they created themselves
       - transfers leaving their own destination, which they may need to
         review or cancel
       A sub-admin with no destination assigned has nothing to show. */
    const isSub = req.userRole === 'sub-admin';
    if (isSub && !admin.state) return res.json({ pending: [] });

    const stateName = admin.state;
    const scope = isSub
      ? {
          [Op.or]: [
            { toStateName: stateName },
            { fromStateName: stateName },
            { senderId: adminId },
            { receiverId: adminId },
          ],
        }
      : {};

    const pending = await Transaction.findAll({
      where: {
        type: 'admin_state_push',
        status: { [Op.in]: ['pending', 'completed', 'cancelled'] },
        ...scope,
      },
      include: [
        { model: User, as: 'sender', attributes: ['name', 'phone'] },
        { model: User, as: 'receiver', attributes: ['name', 'phone'] }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json({ pending });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Receiver marks pending send as received -> credits receiver and completes txn
export const receiveSendByState = async (req, res) => {
  try {
    const adminId = req.userId;
    const { id } = req.params;
    const tx = await Transaction.findByPk(id);
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });
    if (tx.type !== 'admin_state_push') return res.status(400).json({ message: 'Invalid transaction type' });
    if (tx.status !== 'pending') return res.status(400).json({ message: 'Transaction is not pending' });

    const actor = await User.findByPk(adminId);
    if (!actor || !isStaffRole(actor.role)) return res.status(403).json({ message: 'Only admins can mark this transfer as received' });

    /* An admin can settle any transfer; a sub-admin only one addressed to them
       or arriving at the destination they work. */
    const addressedToActor = Number(tx.receiverId) === Number(adminId);
    const atActorsDestination = Boolean(actor.state && tx.toStateName && actor.state === tx.toStateName);
    if (actor.role !== 'admin' && !addressedToActor && !atActorsDestination) {
      return res.status(403).json({ message: 'Only admins in the destination state can mark this transfer as received' });
    }

    /* The money goes to the admin the transfer was addressed to, not to whoever
       pressed the button. This used to credit the acting account, which the
       destination check happened to contain — but it already meant any admin
       sharing that destination could take a colleague's transfer, and once an
       admin may settle ANY transfer it would have become a way to collect money
       addressed to anyone. */
    const receiver = tx.receiverId ? await User.findByPk(tx.receiverId) : null;
    if (!receiver) return res.status(404).json({ message: 'The admin this transfer was addressed to no longer exists' });

    const receiverCredit = Number(tx.receiverCredit || tx.amount || 0);
    receiver.balance = Math.round(((parseFloat(receiver.balance) || 0) + receiverCredit) * 100) / 100;
    await receiver.update({ balance: receiver.balance });

    /* Pay the sender the commission they earned. The send screen states it
       plainly — "Commission, credited to your Admin Cash, +SSP 6,000.00" — but
       nothing ever added it to a balance: the figure was written onto the
       transaction, which fed the dashboard card, and went no further. The
       sender was left holding only the debit.

       It is paid here rather than at send because a pending transfer can be
       cancelled, and cancelling refunds the sender and zeroes the commission.
       Commission is earned when the money lands, so it is credited when the
       transfer completes. */
    const earned = Number(tx.commission || 0);
    let senderBalance = tx.senderBalance;
    if (earned > 0 && tx.senderId) {
      const sender = await User.findByPk(tx.senderId);
      if (sender) {
        sender.balance = Math.round(((parseFloat(sender.balance) || 0) + earned) * 100) / 100;
        await sender.update({ balance: sender.balance });
        senderBalance = sender.balance;

        await Notification.create({
          recipientId: sender.id,
          title: 'Commission earned',
          message: `Your transfer was received. ${tx.currencyCode || 'SSP'} ${earned.toFixed(2)} commission was credited to your Admin Cash.`,
          type: 'system',
          relatedTransactionId: tx.id,
        });

        try {
          const io = req.app.get('io');
          if (io) io.to(`user-${sender.id}`).emit('balance-updated', { userId: sender.id, balance: parseFloat(sender.balance) });
        } catch (e) { /* the credit is done; a missed socket only delays the UI */ }
      }
    }

    // Update transaction
    await tx.update({
      status: 'completed',
      receiverBalance: receiver.balance,
      senderBalance,
      /* Who closed it, which is not always who it was addressed to — an admin
         can settle on another destination's behalf. */
      settledAt: new Date(),
      settledById: actor.id,
      settledByEmail: actor.email,
    });

    // Notifications
    await Notification.create({
      recipientId: receiver.id,
      title: 'Transfer Received',
      message: `You received SSP ${receiverCredit.toFixed(2)} from admin transfer`,
      type: 'system',
      relatedTransactionId: tx.id
    });

    try { await sendSMS(receiver.phone, `MoneyPay: You have received SSP ${receiverCredit.toFixed(2)}`); } catch (e) {}

    // Emit socket update for receiver
    try {
      const io = getIO();
      if (io) {
        io.to(`user-${receiver.id}`).emit('balance-updated', { userId: receiver.id, balance: parseFloat(receiver.balance) });
      }
    } catch (err) {
      console.error('Socket emit failed:', err);
    }

    res.json({ message: 'Transaction marked as received', transaction: tx });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Return count of pending send-by-state transactions for logged-in admin (receiver)
export const getPendingSendByStateCount = async (req, res) => {
  try {
    const adminId = req.userId;
    const admin = await User.findByPk(adminId);
    if (!admin) return res.json({ count: 0 });

    /* The badge counts exactly what the page lists, so the two cannot
       disagree — a "7" over a page showing 12 rows is worse than no badge. */
    const isSub = req.userRole === 'sub-admin';
    if (isSub && !admin.state) return res.json({ count: 0 });

    const scope = isSub
      ? {
          [Op.or]: [
            { senderId: adminId },
            { receiverId: adminId },
            { fromStateName: admin.state },
            { toStateName: admin.state },
          ],
        }
      : {};

    const count = await Transaction.count({
      where: {
        type: 'admin_state_push',
        status: 'pending',
        ...scope,
      },
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Sender cancels a pending send-by-state transaction
export const cancelSendByState = async (req, res) => {
  try {
    const adminId = req.userId;
    const { id } = req.params;
    const tx = await Transaction.findByPk(id);
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });
    if (tx.type !== 'admin_state_push') return res.status(400).json({ message: 'Invalid transaction type' });
    if (tx.status !== 'pending') return res.status(400).json({ message: 'Transaction is not pending' });

    const actingAdmin = await User.findByPk(adminId);
    const sender = await User.findByPk(tx.senderId);
    const receiver = await User.findByPk(tx.receiverId);
    if (!actingAdmin || !isStaffRole(actingAdmin.role)) return res.status(403).json({ message: 'Only admins can cancel this transfer' });
    if (!sender) return res.status(404).json({ message: 'Sender not found' });

    /* An admin can cancel any pending transfer; a sub-admin only their own or
       one leaving the destination they work. The refund goes to the sender
       either way, so widening this moves no money sideways. */
    const isSender = Number(tx.senderId) === Number(adminId);
    const isSameStateAdmin = Boolean(actingAdmin.state && tx.fromStateName && actingAdmin.state === tx.fromStateName);
    if (actingAdmin.role !== 'admin' && !isSender && !isSameStateAdmin) {
      return res.status(403).json({ message: 'Only the sender or an admin from the same state can cancel this transfer' });
    }

    // Compute how much was debited from sender when creating the pending tx
    const amount = Number(tx.amount || 0);
    const commission = Number(tx.commission || 0);
    /* Both modes debit the sender the full amount — they differ only in what
       the recipient is due and whether commission is earned — so cancelling
       refunds the amount.

       This used to read companyCommission to decide, which a destination
       transfer never sets: it is 0 either way, so the test was always false
       and every cancellation refunded amount-minus-commission. The sender
       silently lost the commission on a transfer that never happened. */
    const senderDebit = amount;

    // Refund sender
    sender.balance = Math.round(((parseFloat(sender.balance) || 0) + senderDebit) * 100) / 100;
    await sender.save();

    tx.status = 'cancelled';
    /* Was `tx.cancelledAt`, which is neither a model field nor a column — the
       assignment went nowhere and no cancellation was ever timestamped. */
    tx.settledAt = new Date();
    tx.settledById = actingAdmin.id;
    tx.settledByEmail = actingAdmin.email;
    tx.senderBalance = sender.balance;
    /* The commission figures are left on the row. They used to be zeroed here
       so a cancelled transfer would not count toward the totals, but that also
       erased what the commission on the request had been — the row then read
       "0.00" as though none was ever charged, which is not what happened.

       The totals exclude cancelled transfers by status instead, which says the
       same thing without destroying the record. */
    await tx.save();

    // Notifications
    const notifSender = await Notification.create({
      recipientId: sender.id,
      title: 'Transfer Cancelled',
      message: `You cancelled the pending transfer of SSP ${amount.toFixed(2)}`,
      type: 'system',
      relatedTransactionId: tx.id
    });

    if (receiver) {
      const notifReceiver = await Notification.create({
        recipientId: receiver.id,
        title: 'Pending Transfer Cancelled',
        message: `Pending transfer of SSP ${tx.receiverCredit ? Number(tx.receiverCredit).toFixed(2) : amount.toFixed(2)} was cancelled by sender`,
        type: 'system',
        relatedTransactionId: tx.id
      });
    }

    try { await sendSMS(sender.phone, `MoneyPay: Your pending transfer of SSP ${amount.toFixed(2)} was cancelled and refunded.`); } catch (e) { }
    try { if (receiver) await sendSMS(receiver.phone, `MoneyPay: Pending transfer of SSP ${tx.receiverCredit ? Number(tx.receiverCredit).toFixed(2) : amount.toFixed(2)} was cancelled by sender.`); } catch (e) { }

    // Emit socket update for sender (and receiver if connected)
    try {
      const io = getIO();
      if (io) {
        io.to(`user-${sender._id}`).emit('balance-updated', { userId: sender._id, balance: parseFloat(sender.balance) });
        if (receiver) io.to(`user-${receiver._id}`).emit('transaction-updated', { transactionId: tx._id, status: tx.status });
      }
    } catch (err) {
      console.error('Socket emit failed:', err);
    }

    res.json({ message: 'Pending transfer cancelled', transaction: tx });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Sender edits pending transaction details (currently only description)
export const editSendByState = async (req, res) => {
  try {
    const adminId = req.userId;
    const { id } = req.params;
    const { description, amount, toAdminId, deductCommissionFromAmount } = req.body;

    const tx = await Transaction.findByPk(id);
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });
    if (tx.type !== 'admin_state_push') return res.status(400).json({ message: 'Invalid transaction type' });
    if (tx.status !== 'pending') return res.status(400).json({ message: 'Only pending transactions can be edited' });
    if (tx.senderId !== adminId) return res.status(403).json({ message: 'Only the sender can edit this transaction' });

    // Fetch latest sender record
    const sender = await User.findByPk(tx.senderId);
    if (!sender) return res.status(404).json({ message: 'Sender not found' });

    // If receiver changed, validate their existence
    let newReceiverId = tx.receiverId;
    if (toAdminId) {
      const newReceiver = await User.findByPk(toAdminId);
      if (!newReceiver || !isStaffRole(newReceiver.role)) return res.status(404).json({ message: 'To Destination not found' });
      newReceiverId = newReceiver.id;
    }

    // Determine commission percent from sender's state (From Destination)
    const senderState = sender.state ? await StateSetting.findOne({ where: { name: sender.state } }) : null;
    const percent = senderState ? parseFloat(senderState.commissionPercent) || 0 : 0;

    // Compute original sender debit
    const origCommission = Number(tx.commission || 0);
    const origReceiverCommission = Number(tx.receiverCommission || 0);
    const origAmount = Number(tx.amount || 0);
    // In both modes, sender debited for full amount
    const originalSenderDebit = origAmount;

    let newAmount = typeof amount !== 'undefined' ? parseFloat(amount) : Number(tx.amount || 0);
    if (isNaN(newAmount) || newAmount <= 0) newAmount = Number(tx.amount || 0);

    const commissionAmount = Math.round((newAmount * (percent / 100)) * 100) / 100;

    let companyCommission = 0;
    let senderCommissionGiven = 0;
    let receiverCommissionGiven = 0;
    let senderDebit = newAmount;
    let receiverCredit = newAmount;

    const deduct = deductCommissionFromAmount === true || deductCommissionFromAmount === 'true' || (typeof deductCommissionFromAmount === 'undefined' ? (origCompanyCommission > 0) : false);

    if (deduct) {
      // Deduct mode: receiver gets amount less commission, sender gets the commission
      senderCommissionGiven = commissionAmount;
      receiverCredit = Math.round((newAmount - commissionAmount) * 100) / 100;
      senderDebit = newAmount;
    } else {
      // Full amount mode: receiver gets full amount, sender gets commission added to their card
      senderCommissionGiven = commissionAmount;
      senderDebit = newAmount;
      receiverCredit = newAmount;
    }

    // Compute delta to apply to sender balance
    const delta = Math.round((senderDebit - originalSenderDebit) * 100) / 100;
    if (delta > 0) {
      // Need additional funds from sender
      const currentSenderBalance = parseFloat(sender.balance) || 0;
      if (currentSenderBalance < delta) return res.status(400).json({ message: 'Insufficient sender balance for updated amount' });
      sender.balance = Math.round(((currentSenderBalance - delta) * 100)) / 100;
    } else if (delta < 0) {
      sender.balance = Math.round(((parseFloat(sender.balance) || 0) - delta) * 100) / 100; // delta negative => refund
    }

    await sender.save();

    // Apply updates to transaction
    tx.amount = newAmount;
    tx.receiver = newReceiverId;
    tx.description = typeof description !== 'undefined' ? description : tx.description;
    tx.commission = senderCommissionGiven;
    tx.receiverCommission = receiverCommissionGiven;
    tx.commissionPercent = senderCommissionGiven ? percent : 0;
    tx.companyCommission = companyCommission;
    tx.companyCommissionPercent = companyCommission ? percent : 0;
    tx.receiverCredit = receiverCredit;
    tx.senderBalance = sender.balance;
    tx.updatedAt = new Date();

    await tx.save();

    // Notify parties
    const notifSender = await Notification.create({
      recipientId: sender.id,
      title: 'Transfer Updated',
      message: `You updated the pending transfer ${tx.transactionId}`,
      type: 'system',
      relatedTransactionId: tx.id
    });

    if (newReceiverId) {
      const notifReceiver = await Notification.create({
        recipientId: newReceiverId,
        title: 'Pending Transfer Updated',
        message: `A pending transfer to you (SSP ${receiverCredit.toFixed(2)}) was updated by the sender.`,
        type: 'system',
        relatedTransactionId: tx.id
      });
    }

    try {
      const io = getIO();
      if (io) {
        io.to(`user-${sender._id}`).emit('balance-updated', { userId: sender._id, balance: parseFloat(sender.balance) });
        if (newReceiverId) io.to(`user-${newReceiverId}`).emit('transaction-updated', { transactionId: tx._id, status: tx.status });
      }
    } catch (err) {
      console.error('Socket emit failed:', err);
    }

    res.json({ message: 'Transaction updated', transaction: tx });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createMoneyExchangeTransaction = async (req, res) => {
  try {
    const { amount, fromCurrency, toCurrency, convertedAmount, priceMode, pairUsed, description } = req.body;
    const adminId = req.userId; // from auth middleware

    // Validate required fields
    if (!amount || !fromCurrency || !toCurrency || convertedAmount === undefined) {
      return res.status(400).json({ message: 'Missing required fields: amount, fromCurrency, toCurrency, convertedAmount' });
    }

    // Generate unique transaction ID
    const transactionId = `ME-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Effective rate actually applied. The old version always read
    // buyingPrice and relied on pairUsed.inverse, which the client never
    // sends - so selling-mode exchanges recorded the buying rate.
    const mode = priceMode === 'selling' ? 'selling' : 'buying';
    let effectiveRate = null;
    if (Number(amount) > 0 && Number(convertedAmount) >= 0) {
      effectiveRate = Number(convertedAmount) / Number(amount);
    } else if (pairUsed) {
      const quoted = mode === 'selling' ? pairUsed.sellingPrice : pairUsed.buyingPrice;
      effectiveRate = Number(quoted);
    }
    if (!Number.isFinite(effectiveRate)) effectiveRate = 1;

    const admin = await User.findByPk(adminId, { attributes: ['id', 'name', 'phone'] });
    const adminName = admin?.name || 'Admin';

    const transaction = await Transaction.create({
      transactionId,
      senderId: adminId,
      amount,
      type: 'money_exchange',
      status: 'completed',
      description:
        description ||
        `Money Exchange by ${adminName}: ${amount} ${fromCurrency} → ${convertedAmount} ${toCurrency} (${mode} @ ${effectiveRate})`,
      currencyCode: fromCurrency,
      currencySymbol: pairUsed ? pairUsed.toCode : toCurrency,
      toCurrencyCode: toCurrency,
      convertedAmount,
      exchangeMode: mode,
      receiverCredit: convertedAmount,
      exchangeRate: effectiveRate
    });

    res.status(201).json({
      message: 'Money exchange transaction saved successfully',
      transaction: {
        transactionId: transaction.transactionId,
        fromCurrency,
        toCurrency,
        amount: transaction.amount,
        convertedAmount: transaction.convertedAmount,
        exchangeRate: transaction.exchangeRate,
        exchangeMode: transaction.exchangeMode,
        admin: { id: adminId, name: adminName },
        status: transaction.status,
        createdAt: transaction.createdAt
      }
    });
  } catch (error) {
    console.error('Money exchange error:', error);
    res.status(500).json({ message: 'Failed to save transaction: ' + error.message });
  }
};

export const convertMoneyExchange = async (req, res) => {
  try {
    const { amount, fromCurrency, toCurrency, priceMode } = req.body;

    if (!amount || !fromCurrency || !toCurrency || !priceMode) {
      return res.status(400).json({ message: 'Missing required fields: amount, fromCurrency, toCurrency, priceMode' });
    }

    // Round to at most 6 decimals and drop trailing zeros. The previous
    // Math.round() destroyed every sub-unit value (0.0125 USD became 0).
    const fmt = (n) => {
      if (!Number.isFinite(n)) return null;
      return String(Number(n.toFixed(6)));
    };

    const pairRates = await ExchangeRate.findAll();
    const currencies = await Currency.findAll();

    // Find direct pair
    const pair = pairRates.find(p => 
      (p.fromCode || '').toUpperCase() === fromCurrency.toUpperCase() && 
      (p.toCode || '').toUpperCase() === toCurrency.toUpperCase()
    );

    let convertedAmount = null;
    let usedPair = null;

    if (pair) {
      const key = priceMode === 'buying' ? 'buyingPrice' : 'sellingPrice';
      const val = pair[key];
      const rate = Number(val);
      if (val !== undefined && val !== null && val !== '' && Number.isFinite(rate)) {
        // direct pair: 1 fromCode = rate * toCode
        convertedAmount = fmt(Number(amount) * rate);
        usedPair = { pair: pair.toJSON(), inverse: false };
      }
    }

    // Find inverse pair
    if (convertedAmount === null || convertedAmount === undefined) {
      const inverse = pairRates.find(p => 
        (p.fromCode || '').toUpperCase() === toCurrency.toUpperCase() && 
        (p.toCode || '').toUpperCase() === fromCurrency.toUpperCase()
      );

      if (inverse) {
        const invKey = priceMode === 'buying' ? 'buyingPrice' : 'sellingPrice';
        const invVal = inverse[invKey];
        const invRate = Number(invVal);
        if (invVal !== undefined && invVal !== null && invVal !== '' && Number.isFinite(invRate) && invRate !== 0) {
          // stored the other way round: 1 toCode = invRate * fromCode
          convertedAmount = fmt(Number(amount) / invRate);
          usedPair = { pair: inverse.toJSON(), inverse: true };
        }
      }
    }

    // Fallback to currency-level rates
    if (convertedAmount === null || convertedAmount === undefined) {
      const f = currencies.find(c => (c.code || '').toUpperCase() === fromCurrency.toUpperCase());
      const t = currencies.find(c => (c.code || '').toUpperCase() === toCurrency.toUpperCase());

      if (f && t) {
        const getEff = (cur, side) => {
          const pt = cur.priceType || 'fixed';
          if (pt === 'fixed') {
            const v = side === 'buying' ? cur.buyingPrice : cur.sellingPrice;
            if (v !== undefined && v !== null && v !== '') return Number(v);
            if ((cur.code || '').toUpperCase() === 'SSP') return 1;
            return null;
          }
          return null;
        };

        const fromRate = priceMode === 'buying' ? getEff(f, 'selling') : getEff(f, 'buying');
        const toRate = priceMode === 'buying' ? getEff(t, 'buying') : getEff(t, 'selling');

        if (fromRate != null && toRate != null && Number(toRate) !== 0) {
          convertedAmount = fmt(Number(amount) * (Number(fromRate) / Number(toRate)));
        }
      }
    }

    if (convertedAmount === null || convertedAmount === undefined) {
      return res.status(400).json({ message: 'Unable to convert currencies with available rates' });
    }

    res.json({
      convertedAmount: Number(convertedAmount),
      usedPair
    });
  } catch (error) {
    console.error('Money exchange conversion error:', error);
    res.status(500).json({ message: 'Failed to convert: ' + error.message });
  }
};