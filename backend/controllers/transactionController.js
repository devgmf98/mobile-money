import { Op } from 'sequelize';
import { quoteWithdrawal, quoteSendMoney, maxWithdrawable, maxSendable } from '../utils/commission.js';
import sequelize from '../config/database.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import WithdrawalRequest from '../models/WithdrawalRequest.js';
import { phoneVariants, generateTransactionId } from '../utils/helpers.js';
import { sendSMS, sendTransactionSMS } from '../utils/sms.js';
import { getIO } from '../utils/socket.js';

/* Single source of truth for who may pay whom — also used by the send-quote
   endpoint so the form can refuse a pairing before pricing it. */
export const transferAllowed = (senderRole, recipientRole) => {
  if (!recipientRole) return true;
  if (recipientRole === 'admin') return false;
  if (senderRole === 'agent' && recipientRole === 'agent') return false;
  if (senderRole === 'user') return ['user', 'agent'].includes(recipientRole);
  if (senderRole === 'agent') return recipientRole === 'user';
  return true;
};

export const sendMoney = async (req, res) => {
  try {
    const { recipientPhone, description } = req.body;
    const amount = parseFloat(req.body.amount);
    const sender = await User.findByPk(req.userId);

    if (!sender) {
      return res.status(404).json({ message: 'Sender not found' });
    }

    /* Resolve the recipient BEFORE pricing: sending to an agent is a cash-out
       in all but name, so it is charged on the withdrawal tier, while a
       transfer between two users uses the send-money tier. */
    let recipient = null;
    for (const variant of phoneVariants(recipientPhone)) {
      recipient = await User.findOne({ where: { phone: variant } });
      if (recipient) break;
    }
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    /* Who may pay whom:
         user  -> user   yes (send-money tier)
         user  -> agent  yes (withdrawal tier — it is a cash-out)
         agent -> user   yes (send-money tier)
         agent -> agent  no  — agents settle through the admin, not each other
         anyone -> admin no
       Stated as a matrix because the old single condition only constrained
       senders with the 'user' role, leaving agent-to-agent wide open. */
    if (!transferAllowed(sender.role, recipient.role)) {
      return res.status(400).json({
        message: sender.role === 'agent' && recipient.role === 'agent'
          ? "Agents can't send money to other agents"
          : "You can't send money to this person",
      });
    }

    const toAgent = recipient.role === 'agent';
    /* Same helpers the send form quotes from, so the fee previewed and the fee
       charged are one calculation. */
    const quote = toAgent ? await quoteWithdrawal(amount) : await quoteSendMoney(amount);
    const companyPercent = quote.companyPercent;
    const companyCommission = quote.companyCommission;
    /* Only the withdrawal tier has an agent leg. As on a withdrawal, that
       share is credited to the agent rather than kept — otherwise the sender
       would be charged for it and nobody would receive it. */
    const agentPercent = toAgent ? quote.agentPercent : 0;
    const agentCommission = toAgent ? quote.agentCommission : 0;

    if (parseFloat(sender.balance) < quote.totalDebit) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    const transactionId = generateTransactionId();
    const senderPreviousBalance = parseFloat(sender.balance);
    const receiverPreviousBalance = parseFloat(recipient.balance);

    // Sender pays the amount plus every fee on it
    sender.balance = senderPreviousBalance - quote.totalDebit;
    recipient.balance = receiverPreviousBalance + amount + agentCommission;

    await sender.save();
    await recipient.save();

    // Create transaction record
    const transaction = await Transaction.create({
      transactionId,
      senderId: req.userId,
      receiverId: recipient.id,
      amount,
      type: 'transfer',
      status: 'completed',
      description,
      senderBalance: sender.balance,
      receiverBalance: recipient.balance,
      senderLocation: sender.currentLocation || null,
      receiverLocation: recipient.currentLocation || null,
      companyCommission,
      companyCommissionPercent: companyPercent,
      commission: agentCommission,
      commissionPercent: agentPercent,
      agentCommission,
      agentCommissionPercent: agentPercent
    });

    // Create notifications
    const senderNotif = await Notification.create({
      recipientId: req.userId,
      title: 'Money Sent',
      message: `You sent SSP ${amount} to ${recipient.phone}`,
      type: 'transaction',
      relatedTransactionId: transaction.id
    });

    const receiverNotif = await Notification.create({
      recipientId: recipient.id,
      title: 'Money Received',
      message: `You received SSP ${amount} from ${sender.phone}`,
      type: 'transaction',
      relatedTransactionId: transaction.id
    });

    // Send SMS
    try {
      await sendSMS(sender.phone, `MoneyPay: You sent SSP ${amount} to ${recipient.phone}. TX: ${transactionId}`);
      await sendSMS(recipient.phone, `MoneyPay: You received SSP ${amount} from ${sender.phone}. TX: ${transactionId}`);
    } catch (error) {
      console.error('SMS failed:', error);
    }

    // Emit real-time events: notifications and balance updates for sender and recipient
    try {
      const io = getIO();
      if (io) {
        // Sender notification + balance update
        io.to(`user-${req.userId}`).emit('new-notification', {
          recipient: req.userId,
          title: 'Money Sent',
          message: `You sent SSP ${amount} to ${recipient.phone}`,
          type: 'transaction',
          relatedTransaction: transaction._id
        });

        io.to(`user-${req.userId}`).emit('balance-updated', {
          userId: req.userId,
          balance: parseFloat(sender.balance)
        });

        // Recipient notification + balance update
        io.to(`user-${recipient.id}`).emit('new-notification', {
          recipientId: recipient.id,
          title: 'Money Received',
          message: `You received SSP ${amount} from ${sender.phone}`,
          type: 'transaction',
          relatedTransactionId: transaction.id
        });

        io.to(`user-${recipient.id}`).emit('balance-updated', {
          userId: recipient.id,
          balance: parseFloat(recipient.balance)
        });
      } else {
        console.error('IO instance not available for sendMoney emits');
      }
    } catch (err) {
      console.error('Socket emit failed for sendMoney:', err);
    }

    res.json({
      message: 'Money sent successfully',
      transaction: {
        id: transaction.id,
        transactionId,
        amount,
        recipient: recipient.phone,
        status: 'completed'
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const withdrawMoney = async (req, res) => {
  try {
    const { agentId } = req.body;
    const amount = parseFloat(req.body.amount);
    const user = await User.findByPk(req.userId);
    
    // Find agent by agentId field (6-digit string), not MongoDB _id
    const agent = await User.findOne({ where: { agentId } });

    if (!user || !agent) {
      return res.status(404).json({ message: 'User or agent not found' });
    }

    if (agent.role !== 'agent') {
      return res.status(400).json({ message: 'Invalid agent' });
    }

    /* Tier lookup and rounding live in quoteWithdrawal so the figure shown in
       the withdraw form is produced by the same code that charges it. */
    const q = await quoteWithdrawal(amount);
    const commissionPercent = q.agentPercent;
    const companyCommissionPercent = q.companyPercent;
    const commissionAmount = q.agentCommission;
    const companyCommissionAmount = q.companyCommission;

    const transactionId = generateTransactionId();

    // Deduct from user (amount + agent commission + company commission)
    const totalDebit = amount + commissionAmount + companyCommissionAmount;
    if (parseFloat(user.balance) < totalDebit) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    user.balance = parseFloat(user.balance) - totalDebit;
    // Agent receives the withdrawn amount plus their commission (company commission is separate)
    agent.balance = (parseFloat(agent.balance) || 0) + amount + commissionAmount;

    console.log(`Withdrawal: User ${user._id} withdrawing ${amount} to Agent ${agent._id}`);
    console.log(`User balance before save: ${user.balance}`);
    console.log(`Agent balance before save: ${agent.balance}`);

    // Save both documents
    await user.save();
    await agent.save();

    console.log(`User saved with balance: ${user.balance}`);
    console.log(`Agent saved with balance: ${agent.balance}`);

    const transaction = await Transaction.create({
      transactionId,
      senderId: req.userId,
      receiverId: agent.id,
      amount,
      type: 'user_withdraw',
      // legacy commission fields
      commission: commissionAmount,
      commissionPercent,
      // new agent-specific commission fields (for UI and receipts)
      agentCommission: commissionAmount,
      agentCommissionPercent: commissionPercent,
      companyCommission: companyCommissionAmount,
      companyCommissionPercent: companyCommissionPercent,
      status: 'completed',
      senderBalance: user.balance,
      receiverBalance: agent.balance,
      senderLocation: user.currentLocation || null,
      receiverLocation: agent.currentLocation || null
    });

    // Notifications
    const userNotif = await Notification.create({
      recipientId: req.userId,
      title: 'Withdrawal Initiated',
      message: `Withdrawal of SSP ${amount} initiated. Meet agent ${agent.name}`,
      type: 'transaction',
      relatedTransactionId: transaction.id
    });

    const agentNotif = await Notification.create({
      recipientId: agent.id,
      title: 'Withdrawal Request',
      message: `${user.name} requested withdrawal of SSP ${amount}`,
      type: 'transaction',
      relatedTransactionId: transaction.id
    });

    // Emit real-time events to both user and agent
    try {
      const io = getIO();
      if (io) {
        console.log(`Emitting balance-updated to user-${req.userId} with balance ${user.balance}`);
        console.log(`Emitting balance-updated to user-${agent._id} with balance ${agent.balance}`);

        // Notify user of withdrawal and update balance
        io.to(`user-${req.userId}`).emit('new-notification', {
          recipient: req.userId,
          title: userNotif.title,
          message: userNotif.message,
          type: userNotif.type,
          relatedTransaction: userNotif.relatedTransaction
        });

        io.to(`user-${req.userId}`).emit('balance-updated', {
          userId: req.userId,
          balance: parseFloat(user.balance)
        });

        // Notify agent of withdrawal request and update balance
        io.to(`user-${agent.id}`).emit('new-notification', {
          recipientId: agent.id,
          title: agentNotif.title,
          message: agentNotif.message,
          type: agentNotif.type,
          relatedTransactionId: agentNotif.relatedTransactionId
        });

        io.to(`user-${agent.id}`).emit('balance-updated', {
          userId: agent.id,
          balance: parseFloat(agent.balance)
        });
      } else {
        console.error('IO instance not available');
      }
    } catch (err) {
      console.error('Socket emit failed:', err);
    }

    res.json({
      message: 'Withdrawal initiated',
      transaction: { id: transaction.id, transactionId, amount }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.findAll({
      where: {
        [Op.or]: [
          { senderId: req.userId },
          { receiverId: req.userId }
        ]
      },
      include: [
        { model: User, as: 'sender', attributes: ['name', 'phone'] },
        { model: User, as: 'receiver', attributes: ['name', 'phone'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getTransactionStats = async (req, res) => {
  try {
    const userId = req.userId;

    // Calculate pending commissions from pending withdrawal requests
    const pendingAgentCommission = await WithdrawalRequest.sum('agentCommission', {
      where: {
        agentId: userId,
        status: 'pending'
      }
    }) || 0;

    const pendingCompanyCommission = await WithdrawalRequest.sum('companyCommission', {
      where: {
        agentId: userId,
        status: 'pending'
      }
    }) || 0;

    // Get transaction statistics using separate queries
    const totalTransactions = await Transaction.count({
      where: {
        [Op.or]: [
          { senderId: userId },
          { receiverId: userId }
        ]
      }
    });

    const totalSent = await Transaction.sum('amount', {
      where: { senderId: userId }
    }) || 0;

    const totalReceived = await Transaction.sum('amount', {
      where: { receiverId: userId }
    }) || 0;

    // Calculate commission earned by agent from transactions where they received commission
    const commissionEarned = await Transaction.sum('agentCommission', {
      where: {
        receiverId: userId,
        status: 'completed',
        agentCommission: { [Op.gt]: 0 }
      }
    }) || 0;

    res.json({
      totalTransactions,
      totalSent: parseFloat(totalSent),
      totalReceived: parseFloat(totalReceived),
      withdrawalsCompletedCount: 0,
      withdrawalsCompletedAmount: 0,
      transfersCompletedCount: 0,
      transfersCompletedAmount: 0,
      transfersSentCount: 0,
      transfersSentAmount: 0,
      commissionEarned: parseFloat(commissionEarned),
      pullsReceivedAmount: 0,
      transfersReceivedAmount: 0,
      pendingAgentCommission,
      pendingCompanyCommission
    });
  } catch (error) {
    console.error('Transaction stats error:', error);
    res.status(500).json({ message: error.message });
  }
};

/* Price a withdrawal before it happens, so the form can show the true cost.
   The user is debited amount + agent commission + company commission, and the
   page previously previewed the amount alone — which understated the hit to
   their balance by the whole fee. Shares quoteWithdrawal() with the charging
   path so the two cannot disagree. */
export const getSendQuote = async (req, res) => {
  try {
    /* Which tier applies depends on who is being paid: an agent is a cash-out
       and uses the withdrawal tier, another user uses the send-money tier. The
       form passes the recipient's number as soon as it has one; without it we
       quote the user-to-user rate, which is what the form starts out showing. */
    let recipient = null;
    if (req.query.recipientPhone) {
      for (const variant of phoneVariants(req.query.recipientPhone)) {
        recipient = await User.findOne({ where: { phone: variant } });
        if (recipient) break;
      }
    }
    const toAgent = recipient?.role === 'agent';

    const quote = toAgent
      ? await quoteWithdrawal(req.query.amount)
      : await quoteSendMoney(req.query.amount);
    /* Tells the form which breakdown to render, and lets it label the fee. */
    quote.tier = toAgent ? 'withdrawal' : 'send';
    quote.recipientRole = recipient?.role || null;
    const sender = await User.findByPk(req.userId);
    quote.allowed = transferAllowed(sender?.role, recipient?.role);

    quote.maxAmount = sender
      ? (toAgent ? await maxWithdrawable(sender.balance) : await maxSendable(sender.balance))
      : 0;
    res.json(quote);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getWithdrawalQuote = async (req, res) => {
  try {
    const quote = await quoteWithdrawal(req.query.amount);
    /* maxAmount lets the "All" button pick a figure that still fits once fees
       are added — the client cannot work it out, since the rate changes by
       tier. Always the caller's own balance; never a balance they supply. */
    /* Agents pulling from a customer need that customer's ceiling, not their
       own. Restricted to staff so a user cannot probe other people's balances
       through the max figure. */
    let holder = await User.findByPk(req.userId);
    if (req.query.forPhone && ['agent', 'admin'].includes(holder?.role)) {
      for (const variant of phoneVariants(req.query.forPhone)) {
        const found = await User.findOne({ where: { phone: variant } });
        if (found) { holder = found; break; }
      }
    }
    quote.maxAmount = holder ? await maxWithdrawable(holder.balance) : 0;
    res.json(quote);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* Look up an agent by the 6-digit ID printed on their badge, so the withdraw
   form can confirm who the customer is about to hand cash to before they type
   an amount. Deliberately narrower than getUserInfo: a withdrawing user has no
   business seeing an agent's balance or email, so only the name and phone they
   would verify in person are returned. */
export const getAgentInfo = async (req, res) => {
  try {
    const id = (req.params.agentId || '').trim();
    if (!/^\d{6}$/.test(id)) {
      return res.status(400).json({ message: 'Agent ID must be 6 digits' });
    }

    const agent = await User.findOne({ where: { agentId: id } });
    /* Same response for "no such ID" and "that ID is not an agent" — telling
       the difference apart would let anyone enumerate which IDs exist. */
    if (!agent || agent.role !== 'agent') {
      return res.status(404).json({ message: 'No agent found with that ID' });
    }

    res.json({
      agentId: agent.agentId,
      name: agent.name,
      phone: agent.phone,
      isSuspended: !!agent.isSuspended,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getUserInfo = async (req, res) => {
  try {

    const { phoneNumber } = req.params;
    /* Shares phoneVariants with send-money and the quote endpoints — this used
       to be its own copy that never stripped the national trunk zero, so
       0912345002 failed to verify while +211912345002 succeeded. */
    let user = null;
    for (const variant of phoneVariants(phoneNumber)) {
      user = await User.findOne({ where: { phone: variant } });
      if (user) break;
    }
    // Only search by phone variants, not agentId/adminId
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: user.id,
      name: user.name,
      phone: user.phone,
      balance: parseFloat(user.balance) || 0,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      isSuspended: user.isSuspended
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
