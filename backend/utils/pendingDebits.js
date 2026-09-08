import { Op } from 'sequelize';
import User from '../models/User.js';
import WithdrawalRequest from '../models/WithdrawalRequest.js';

const STAFF_ROLES = ['admin', 'sub-admin'];
const n = (v) => parseFloat(v) || 0;

/* Money an account has already promised but not yet paid.

   A pending withdrawal request is a claim on a balance: the moment it is
   approved the funds leave. Every check that asked only "is this one amount
   affordable?" let a second request through against the same money, so two
   requests of 600 could both be raised against a balance of 1000 and the
   second failed at approval time -- after the person had been told it was
   accepted.

   Both flows live in the WithdrawalRequest table but debit opposite sides of
   the row, which is why this is two sums rather than one:

   - An admin cash-out request debits `agentId`. The agent approves it and the
     money leaves them; `userId` is the admin who asked. Approval takes the
     bare amount -- these carry no commission.
   - A pull-funds request debits `userId`. The user approves it and the money
     leaves them, along with both commissions, which approval takes as well
     (see approveWithdrawalRequest: amount + agentCommission +
     companyCommission).

   The two are told apart by the role of the `userId` party -- the same test
   getAgentWithdrawalRequests already uses to list one kind and not the other.
   An account can be on the debited side of both at once: an agent can have an
   admin cash-out waiting on them while another agent is pulling funds from
   them, and both will come out of the same balance. */
export async function pendingDebitTotal(accountId) {
  if (!accountId) return 0;

  const [adminCashOuts, pulls] = await Promise.all([
    /* Waiting on this account as the agent. Joined to the requester so a
       pull-funds row -- which also carries this account in agentId, but debits
       the other side -- is not counted here. */
    WithdrawalRequest.findAll({
      where: { agentId: accountId, status: 'pending' },
      attributes: ['amount'],
      include: [{
        model: User,
        as: 'user',
        attributes: [],
        where: { role: { [Op.in]: STAFF_ROLES } },
        required: true,
      }],
      raw: true,
    }),
    /* Waiting on this account as the user being pulled from. The same join in
       reverse: a row whose requester is staff is an admin cash-out, where this
       account is the one being credited rather than debited. */
    WithdrawalRequest.findAll({
      where: { userId: accountId, status: 'pending' },
      attributes: ['amount', 'agentCommission', 'companyCommission'],
      include: [{
        model: User,
        as: 'user',
        attributes: [],
        where: { role: { [Op.notIn]: STAFF_ROLES } },
        required: true,
      }],
      raw: true,
    }),
  ]);

  const fromCashOuts = adminCashOuts.reduce((sum, r) => sum + n(r.amount), 0);
  const fromPulls = pulls.reduce(
    (sum, r) => sum + n(r.amount) + n(r.agentCommission) + n(r.companyCommission),
    0,
  );

  return parseFloat((fromCashOuts + fromPulls).toFixed(2));
}

/* The one sentence every caller needs: what is already claimed, what is left,
   and whether this new amount fits in it. Shared so the wording is identical
   whichever endpoint refuses the request. */
export function describeShortfall({ balance, pending, amount, party = 'agent' }) {
  const available = parseFloat((n(balance) - n(pending)).toFixed(2));
  const requested = parseFloat((n(pending) + n(amount)).toFixed(2));
  const money = (v) => n(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return {
    available,
    requested,
    message:
      `Total amount requested is greater than ${party}'s balance. ` +
      `SSP ${money(pending)} is already awaiting approval, so only SSP ${money(available)} ` +
      `of the SSP ${money(balance)} balance is still free.`,
  };
}

export default pendingDebitTotal;
