import { Op } from 'sequelize';
import WithdrawalCommissionTier from '../models/WithdrawalCommissionTier.js';
import SendMoneyCommissionTier from '../models/SendMoneyCommissionTier.js';

/* Fallback tiers, used only when no tier row covers the amount. Kept here so
   the quote the user is shown and the amount actually charged can never drift
   apart — this used to be copy-pasted into both withdrawal paths. */
const DEFAULT_TIERS = [
  { minAmount: 0, maxAmount: 99, agentPercent: 0, companyPercent: 0 },
  { minAmount: 100, maxAmount: 499, agentPercent: 1, companyPercent: 0.5 },
  { minAmount: 500, maxAmount: 999, agentPercent: 1.5, companyPercent: 0.5 },
  { minAmount: 1000, maxAmount: Infinity, agentPercent: 2, companyPercent: 1 },
];

/* A withdrawal costs the user the amount PLUS both commissions, so anything
   that previews a balance has to call this rather than subtracting the amount
   alone. Returns zero commission if the tier lookup fails, matching what the
   charging paths have always done on error. */
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
    } else {
      const fallback = DEFAULT_TIERS.find(
        (t) => (parseFloat(t.minAmount) || 0) <= amount && amount <= (parseFloat(t.maxAmount) || Infinity)
      );
      if (fallback) {
        agentPercent = fallback.agentPercent || 0;
        companyPercent = fallback.companyPercent || 0;
      }
    }
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

export { DEFAULT_TIERS };

/* Send money charges the sender a company commission on top of the amount —
   the recipient always receives the full amount. There is no agent leg here,
   so only companyPercent applies. */
const DEFAULT_SEND_TIERS = [
  { minAmount: 0, maxAmount: 99, companyPercent: 0 },
  { minAmount: 100, maxAmount: 499, companyPercent: 1 },
  { minAmount: 500, maxAmount: 999, companyPercent: 2 },
  { minAmount: 1000, maxAmount: Infinity, companyPercent: 3 },
];

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
    } else {
      const fallback = DEFAULT_SEND_TIERS.find(
        (t) => (parseFloat(t.minAmount) || 0) <= amount && amount <= (parseFloat(t.maxAmount) || Infinity)
      );
      companyPercent = fallback ? fallback.companyPercent : 0;
    }
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

export { DEFAULT_SEND_TIERS };

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
  const tiers = await loadTiers(WithdrawalCommissionTier, DEFAULT_TIERS);
  return solveMax(balance, quoteWithdrawal, tiers);
}

export async function maxSendable(balance) {
  const tiers = await loadTiers(SendMoneyCommissionTier, DEFAULT_SEND_TIERS);
  return solveMax(balance, quoteSendMoney, tiers);
}
