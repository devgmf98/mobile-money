/* Labels for Transaction.type.

   The enum lives in backend/models/Transaction.js. Every value there needs an
   entry here, or the fallback below prints the raw column value.

   This exists because the labels had drifted: Transactions.jsx and
   AdminTransactions.jsx each carried their own map (one said "Account top-up",
   the other "Top-up"; one "Destination push", the other "State push"), and the
   two dashboards had no map at all — they labelled every outgoing row "Money
   Sent", so an agent cash-out was indistinguishable from a transfer.
*/

export const TYPE_LABELS = {
  transfer: 'Transfer',
  topup: 'Account top-up',
  withdrawal: 'Withdrawal',
  user_withdraw: 'Withdrawal',
  agent_deposit: 'Agent deposit',
  agent_cash_out_money: 'Agent cash out',
  admin_push: 'Refunded by admin',
  admin_state_push: 'Destination push',
  money_exchange: 'Money exchange',
};

/* Unknown types print readably rather than as a raw enum value, so a type
   added to the backend without a label here degrades to "some new type"
   instead of "some_new_type". */
export const typeLabel = (t) => TYPE_LABELS[t] || String(t || '').replace(/_/g, ' ');

/* A plain transfer is the only type where direction is the whole story — it is
   the same operation for both parties, so it reads as sent or received
   depending on who is looking. Everything else names an operation that means
   the same thing to everyone, and should say what it was. */
export function txLabel(tx, isOutgoing) {
  if (!tx?.type || tx.type === 'transfer' || tx.type === 'sent' || tx.type === 'received') {
    return isOutgoing ? 'Money Sent' : 'Money Received';
  }
  return typeLabel(tx.type);
}
