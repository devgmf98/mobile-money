import { Op } from 'sequelize';
import WithdrawalCommissionTier from '../models/WithdrawalCommissionTier.js';
import SendMoneyCommissionTier from '../models/SendMoneyCommissionTier.js';

/* A withdrawal costs the user the amount PLUS both commissions, so anything
   that previews a balance has to call this rather than subtracting the amount
   alone. Returns zero commission if the tier lookup fails, matching what the
   charging paths have always done on error.

   As with send money, there is deliberately no fallback tier table. This used
   to fall back to a hardcoded 1-2% agent plus 0.5-1% company, so an
   installation that had never configured a withdrawal tier still charged a
   commission nobody had set up and could not switch off. Note what this means
   on the agent side: with no configured tier the agent's share is zero too, so
   tiers have to exist for agents to earn anything on a cash-out. */
export async function quoteWithdrawal(rawAmount) {
  const amount = parseFloat(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      amount: 0, agentPercent: 0, companyPercent: 0,
      agentCommission: 0, companyCommission: 0, totalFee: 0, totalDebit: 0,
    };
  }

  let agentPercent = 0;
  let companyPercent = 0;
  try {
    const tier = await WithdrawalCommissionTier.findOne({
      where: {
        minAmount: { [Op.lte]: amount },
        maxAmount: { [Op.gte]: amount },
      },
      order: [['minAmount', 'ASC']],
    });
    if (tier) {
      agentPercent = parseFloat(tier.agentPercent) || 0;
      companyPercent = parseFloat(tier.companyPercent) || 0;
    }
    /* No tier covers this amount: no commission, by design. */
  } catch {
    /* leave both at 0 */
  }

  const agentCommission = parseFloat(((amount * agentPercent) / 100).toFixed(2)) || 0;
  const companyCommission = parseFloat(((amount * companyPercent) / 100).toFixed(2)) || 0;

  return {
    amount,
    agentPercent,
    companyPercent,
    agentCommission,
    companyCommission,
    totalFee: parseFloat((agentCommission + companyCommission).toFixed(2)),
    totalDebit: parseFloat((amount + agentCommission + companyCommission).toFixed(2)),
  };
}

/* Send money charges the sender a company commission on top of the amount —
   the recipient always receives the full amount. There is no agent leg here,
   so only companyPercent applies.

   There is deliberately no fallback tier table. This used to fall back to a
   hardcoded 1-3%, which meant an installation that had never configured a
   send-money tier still charged senders a "service fee" nobody had set up, and
   there was no way to turn it off from the admin screen. A fee is now charged
   only where a configured tier actually covers the amount; anywhere else,
   including a completely empty tier table, sending is free. */

export async function quoteSendMoney(rawAmount) {
  const amount = parseFloat(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { amount: 0, companyPercent: 0, companyCommission: 0, totalFee: 0, totalDebit: 0 };
  }

  let companyPercent = 0;
  try {
    const tier = await SendMoneyCommissionTier.findOne({
      where: {
        minAmount: { [Op.lte]: amount },
        maxAmount: { [Op.gte]: amount },
      },
      order: [['minAmount', 'ASC']],
    });
    if (tier) {
      companyPercent = parseFloat(tier.companyPercent) || 0;
    }
    /* No tier covers this amount: no commission, by design. */
  } catch {
    /* leave at 0 */
  }

  const companyCommission = parseFloat(((amount * companyPercent) / 100).toFixed(2)) || 0;
  return {
    amount,
    companyPercent,
    companyCommission,
    totalFee: companyCommission,
    totalDebit: parseFloat((amount + companyCommission).toFixed(2)),
  };
}

/* Largest amount whose amount + fees still fits in `balance`.
   Cannot be solved as balance / (1 + rate) on the client, because the rate is
   tier-dependent: dividing by the current tier's rate lands in a HIGHER tier
   whose bigger fee no longer fits. So walk every tier, take the best candidate
   each one allows, then confirm against the real quote — the per-component
   rounding to 2dp can push the total up by a cent. */
async function solveMax(balance, quoteFn, tierBounds) {
  const funds = parseFloat(balance);
  if (!Number.isFinite(funds) || funds <= 0) return 0;

  const floor2 = (v) => Math.floor(v * 100) / 100;

  const candidates = [];
  for (const t of tierBounds) {
    const min = parseFloat(t.minAmount) || 0;
    const max = Number.isFinite(parseFloat(t.maxAmount)) ? parseFloat(t.maxAmount) : Infinity;
    const rate = ((parseFloat(t.agentPercent) || 0) + (parseFloat(t.companyPercent) || 0)) / 100;
    const best = Math.min(max, floor2(funds / (1 + rate)));
    if (best >= min && best > 0) candidates.push(best);
  }
  if (!candidates.length) return 0;

  let amount = Math.max(...candidates);
  /* Walk down at most a few cents to absorb rounding; each step re-prices. */
  for (let i = 0; i < 5 && amount > 0; i++) {
    const q = await quoteFn(amount);
    if (q.totalDebit <= funds) return amount;
    amount = floor2(amount - 0.01);
  }
  return 0;
}

async function loadTiers(Model, defaults) {
  try {
    const rows = await Model.findAll({ order: [['minAmount', 'ASC']] });
    if (rows.length) return rows;
  } catch {
    /* fall through */
  }
  return defaults;
}

export async function maxWithdrawable(balance) {
  const funds = parseFloat(balance);
  if (!Number.isFinite(funds) || funds <= 0) return 0;
  const whole = Math.floor(funds * 100) / 100;

  /* Same shape as maxSendable: with no tier covering the amount there is no
     fee, so the whole balance is withdrawable, and solveMax has nothing to
     propose from an empty table. */
  const quote = await quoteWithdrawal(whole);
  if (quote.totalDebit <= funds) return whole;

  const tiers = await loadTiers(WithdrawalCommissionTier, []);
  return tiers.length ? solveMax(funds, quoteWithdrawal, tiers) : whole;
}

export async function maxSendable(balance) {
  const funds = parseFloat(balance);
  if (!Number.isFinite(funds) || funds <= 0) return 0;
  const whole = Math.floor(funds * 100) / 100;

  /* With no tier covering the amount there is no fee, so the whole balance is
     sendable. Tried first because solveMax only ever proposes amounts that sit
     inside a configured tier: with an empty table it has nothing to propose,
     and with a partial one it would cap a sender at the top tier's ceiling
     even though everything above it is free. */
  const quote = await quoteSendMoney(whole);
  if (quote.totalDebit <= funds) return whole;

  const tiers = await loadTiers(SendMoneyCommissionTier, []);
  return tiers.length ? solveMax(funds, quoteSendMoney, tiers) : whole;
}
