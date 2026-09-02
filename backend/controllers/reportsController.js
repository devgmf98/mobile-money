import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';

/* ==========================================================================
   Reports — one row per person, with what they did in a window.

   The analytics panel answers "what happened"; this answers "who did it". Every
   user, agent, admin and sub-admin appears with their balance, their standing,
   and the money they moved in the period.

   Money is reported per currency and never added across them: the app holds no
   cross-rate at report time, so a single figure spanning SSP, USD and UGX would
   be arithmetic on unlike units. Counts span everything, because a transaction
   is a transaction whatever it was denominated in.

   Four queries regardless of how many people there are — the per-person figures
   come from grouped aggregates stitched onto the user rows, not a query each.
   ========================================================================== */

const DAY = 24 * 60 * 60 * 1000;
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

function presetWindow(range) {
  const now = new Date();
  if (range === 'today') return { from: startOfDay(now), to: endOfDay(now) };
  if (range === 'week') return { from: startOfDay(new Date(now.getTime() - 6 * DAY)), to: endOfDay(now) };
  /* Monthly means the CALENDAR month — the 1st to the last day, whether that
     is the 28th, 29th, 30th or 31st. `new Date(y, m + 1, 0)` is the last day of
     month m, so leap years and short months need no special case.

     It used to be a rolling window ending today, which made "Monthly" span two
     part-months: on 2 September it covered 2 Aug to 2 Sept. An invoice for a
     month has to be the month. Changed here rather than in the statement alone,
     so the document and the table it was opened from can never disagree. */
  if (range === 'month') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: startOfDay(first), to: endOfDay(last) };
  }
  if (range === 'year') { const f = new Date(now); f.setFullYear(f.getFullYear() - 1); return { from: startOfDay(f), to: endOfDay(now) }; }
  return null;
}

/* An unlabelled row predates the currency columns. SSP is the base every
   balance is held in, so that is where it belongs. */
const code = (c) => (c || 'SSP').toUpperCase();

const asList = (map) =>
  Object.entries(map || {})
    .map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);

/* Same, but ordered by size regardless of sign — for figures that can go
   negative. Sorting those by value puts 0.00 above -2,374,300.00, which then
   leads the panel in the largest type while the figure that matters is pushed
   below it in small print. */
const asSignedList = (map) =>
  Object.entries(map || {})
    .map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

export const getPeopleReport = async (req, res) => {
  try {
    const { from, to, range, role, destination, status, search, sort, personId } = req.query;

    /* --- the window --- */
    const preset = presetWindow(range);
    const fromDate = from ? startOfDay(new Date(from)) : (preset ? preset.from : null);
    const toDate = to ? endOfDay(new Date(to)) : (preset ? preset.to : null);
    const period = {};
    if (fromDate && !isNaN(fromDate) && toDate && !isNaN(toDate)) period.createdAt = { [Op.between]: [fromDate, toDate] };
    else if (fromDate && !isNaN(fromDate)) period.createdAt = { [Op.gte]: fromDate };
    else if (toDate && !isNaN(toDate)) period.createdAt = { [Op.lte]: toDate };

    /* --- who is in the report --- */
    const where = {};
    /* One named person. Narrower than every other filter here, so it simply
       wins: picking a person and a role that person does not have returns
       nothing, which is the honest answer rather than a silently widened one. */
    if (personId && personId !== 'all') {
      const pid = Number(personId);
      if (!isNaN(pid)) where.id = pid;
    }
    if (role && role !== 'all') where.role = role;
    if (destination && destination !== 'all') where.state = destination;
    if (status === 'suspended') where.isSuspended = true;
    if (status === 'active') where.isSuspended = { [Op.not]: true };
    if (status === 'unverified') where.isVerified = { [Op.not]: true };
    if (search && search.trim()) {
      const q = '%' + search.trim() + '%';
      where[Op.or] = [
        { name: { [Op.like]: q } },
        { email: { [Op.like]: q } },
        { phone: { [Op.like]: q } },
        { agentId: { [Op.like]: q } },
        { adminId: { [Op.like]: q } },
      ];
    }

    const people = await User.findAll({
      where,
      attributes: [
        'id', 'name', 'email', 'phone', 'role', 'state', 'balance',
        'isVerified', 'isSuspended', 'agentId', 'adminId', 'createdAt',
      ],
      order: [['createdAt', 'DESC']],
      raw: true,
    });

    const ids = people.map((p) => p.id);
    const money = [sequelize.fn('SUM', sequelize.col('amount')), 'amount'];
    const rows = [sequelize.fn('COUNT', sequelize.col('id')), 'count'];

    /* Nobody matched the filters — the aggregates below would scan the whole
       table for an empty IN (), so stop here. */
    const empty = {
      rowsOut: [], rowsIn: [], commissionRows: [], agentCommissionRows: [],
      settledRows: [],
    };
    const { rowsOut, rowsIn, commissionRows, agentCommissionRows, settledRows } = ids.length
      ? await (async () => {
          const [o, i, c, ac, st] = await Promise.all([
            Transaction.findAll({
              where: { ...period, senderId: { [Op.in]: ids } },
              attributes: ['senderId', 'currencyCode', money, rows],
              group: ['senderId', 'currencyCode'],
              raw: true,
            }),
            Transaction.findAll({
              where: { ...period, receiverId: { [Op.in]: ids } },
              attributes: ['receiverId', 'currencyCode', money, rows],
              group: ['receiverId', 'currencyCode'],
              raw: true,
            }),
            Transaction.findAll({
              where: {
                ...period,
                senderId: { [Op.in]: ids },
                /* A cancelled transfer earned nothing; its commission is left
                   on the row for the record, so it is excluded by status. */
                status: { [Op.ne]: 'cancelled' },
                commission: { [Op.gt]: 0 },
              },
              attributes: [
                'senderId',
                'currencyCode',
                [sequelize.fn('SUM', sequelize.col('commission')), 'amount'],
                rows,
              ],
              group: ['senderId', 'currencyCode'],
              raw: true,
            }),
            /* An agent's earnings are a different column on a different side of
               the row. Every agent flow — user_withdraw, transfer to an agent —
               books the agent as the RECEIVER and pays them `agentCommission`;
               the `commission` column on those same rows is the fee the paying
               user was charged. Summing `commission` by sender therefore found
               nothing for agents and credited their customers instead. */
            Transaction.findAll({
              where: {
                ...period,
                receiverId: { [Op.in]: ids },
                status: { [Op.ne]: 'cancelled' },
                agentCommission: { [Op.gt]: 0 },
              },
              attributes: [
                'receiverId',
                'currencyCode',
                [sequelize.fn('SUM', sequelize.col('agentCommission')), 'amount'],
                rows,
              ],
              group: ['receiverId', 'currencyCode'],
              raw: true,
            }),
            /* What a staff member marked as received — the transfers they
               personally confirmed had landed, not the ones merely addressed to
               them. Settling is the action a destination admin actually takes,
               so it is the one their Received column reports.

               No fallback: a push completed before settledById existed records
               no settler, and "marked as received by" cannot honestly name
               someone the row does not. Those rows count for nobody.

               Cancelling stamps the same column, so status pins this to the
               transfers that completed. */
            Transaction.findAll({
              where: { ...period, settledById: { [Op.in]: ids }, status: 'completed' },
              attributes: ['settledById', 'currencyCode', money, rows],
              group: ['settledById', 'currencyCode'],
              raw: true,
            }),
          ]);
          return {
            rowsOut: o, rowsIn: i, commissionRows: c,
            agentCommissionRows: ac, settledRows: st,
          };
        })()
      : empty;

    const fold = (list, key) => {
      const acc = {};
      for (const r of list) {
        const id = r[key];
        if (id == null) continue;
        acc[id] = acc[id] || { count: 0, byCurrency: {} };
        const cur = code(r.currencyCode);
        acc[id].byCurrency[cur] = (acc[id].byCurrency[cur] || 0) + (Number(r.amount) || 0);
        acc[id].count += Number(r.count) || 0;
      }
      return acc;
    };

    const outBy = fold(rowsOut, 'senderId');
    const inBy = fold(rowsIn, 'receiverId');
    const commBy = fold(commissionRows, 'senderId');
    const agentCommBy = fold(agentCommissionRows, 'receiverId');
    const settledBy = fold(settledRows, 'settledById');

    /* ======================================================================
       AMOUNT COLLECTED  (admins and sub-admins only)

       What the staff member should be holding in cash for the period: every
       movement that puts money into their hands, less every movement that
       takes it back out.

         + Amount sent      (state push)     cash taken in to push it
         + Commission       (state push)     their fee on that push
         + Amount           (top-up)         cash taken in to credit a wallet
         - Amount received  (state push)     cash paid out on arrival
         - Amount           (money exchange) the currency given out to exchange
         + Converted amount (money exchange) the currency taken back in return
         - Amount           (agent cash out) cash paid out to an agent

       Two rules govern the whole figure.

       COMPLETED ONLY. A pending push has collected nothing yet and a cancelled
       one never will, so only `status = 'completed'` rows count anywhere in
       this sum.

       PER CURRENCY, NEVER ACROSS. Each term lands in the bucket of the currency
       it was denominated in, and the arithmetic happens inside that bucket. A
       figure spanning SSP, USD and UGX would be adding unlike units.

       An exchange contributes TWO terms in TWO different currencies: `amount`
       is subtracted from `currencyCode` and `convertedAmount` is added to
       `toCurrencyCode`. One trade therefore moves two buckets in opposite
       directions, which is why netting the legs into a single number would be
       meaningless — they are different units.

       Which side of a row the staff member sits on differs by type, and getting
       it wrong would silently invert a term:
         state push      they are the SENDER
         money exchange  they are the SENDER (an exchange has no receiver)
         top-up          they are the SENDER (the customer is the receiver)
         agent cash out  they are the RECEIVER (the agent is the sender)
       ====================================================================== */
    const collectedRows = ids.length
      ? await Promise.all([
          /* Pushes they sent: the amount and the commission both come in. */
          Transaction.findAll({
            where: { ...period, type: 'admin_state_push', status: 'completed', senderId: { [Op.in]: ids } },
            attributes: [
              'senderId', 'currencyCode',
              [sequelize.fn('SUM', sequelize.col('amount')), 'amount'],
              [sequelize.fn('SUM', sequelize.col('commission')), 'commission'],
            ],
            group: ['senderId', 'currencyCode'],
            raw: true,
          }),
          /* Pushes they marked as received: cash goes back out at that end.

             Strictly the people recorded in settledById — nobody is inferred.
             A push completed before that column existed has no settler, so it
             is in no one's subtraction. Same definition as the Received
             column, so the two reconcile. */
          Transaction.findAll({
            where: { ...period, type: 'admin_state_push', status: 'completed', settledById: { [Op.in]: ids } },
            attributes: ['settledById', 'currencyCode', [sequelize.fn('SUM', sequelize.col('amount')), 'amount']],
            group: ['settledById', 'currencyCode'],
            raw: true,
          }),
          /* Both legs of an exchange, each in its own currency: the amount given
             out (subtracted, in currencyCode) and what came back in return
             (added, in toCurrencyCode). Grouping by both codes keeps each sum
             attached to the code it is denominated in. */
          Transaction.findAll({
            where: { ...period, type: 'money_exchange', status: 'completed', senderId: { [Op.in]: ids } },
            attributes: [
              'senderId', 'currencyCode', 'toCurrencyCode',
              [sequelize.fn('SUM', sequelize.col('amount')), 'amount'],
              [sequelize.fn('SUM', sequelize.col('convertedAmount')), 'converted'],
            ],
            group: ['senderId', 'currencyCode', 'toCurrencyCode'],
            raw: true,
          }),
          /* Top-ups they performed: cash in, wallet credit out. */
          Transaction.findAll({
            where: { ...period, type: 'topup', status: 'completed', senderId: { [Op.in]: ids } },
            attributes: ['senderId', 'currencyCode', [sequelize.fn('SUM', sequelize.col('amount')), 'amount']],
            group: ['senderId', 'currencyCode'],
            raw: true,
          }),
          /* Agent cash out: the agent is the sender and the admin pays out the
             cash, so it is a subtraction on the admin's side. */
          Transaction.findAll({
            where: { ...period, type: 'agent_cash_out_money', status: 'completed', receiverId: { [Op.in]: ids } },
            attributes: ['receiverId', 'currencyCode', [sequelize.fn('SUM', sequelize.col('amount')), 'amount']],
            group: ['receiverId', 'currencyCode'],
            raw: true,
          }),
        ])
      : [[], [], [], [], []];

    const [cSent, cSettled, cExchange, cTopup, cCashout] = collectedRows;

    const collectedBy = {};
    const post = (id, currency, delta) => {
      if (id == null || !delta) return;
      const acc = (collectedBy[id] = collectedBy[id] || {});
      const cur = code(currency);
      acc[cur] = (acc[cur] || 0) + delta;
    };

    for (const r of cSent) {
      post(r.senderId, r.currencyCode, Number(r.amount) || 0);
      post(r.senderId, r.currencyCode, Number(r.commission) || 0);
    }
    for (const r of cSettled) post(r.settledById, r.currencyCode, -(Number(r.amount) || 0));
    for (const r of cExchange) {
      post(r.senderId, r.currencyCode, -(Number(r.amount) || 0));
      /* Older exchanges recorded no target code at all. There is nothing to add
         back for those, and inventing a currency would be worse than leaving
         the term out of that one row. */
      if (r.toCurrencyCode) post(r.senderId, r.toCurrencyCode, Number(r.converted) || 0);
    }
    for (const r of cTopup) post(r.senderId, r.currencyCode, Number(r.amount) || 0);
    for (const r of cCashout) post(r.receiverId, r.currencyCode, -(Number(r.amount) || 0));

    /* Every currency the staff member deals in gets a line, whether or not it
       nets to anything.

       Only completed rows contribute to the sum, so a currency whose activity
       is all still pending — or that cancels out exactly — produced no bucket
       at all and silently vanished from the column. A reader could not tell
       "no UGX business" from "UGX business, none of it settled yet", which are
       very different things to a person counting cash.

       So presence is decided over every status, while the arithmetic stays
       completed-only. A currency with nothing settled reads 0.00, which is the
       true answer to "how much UGX should I be holding". */
    const presenceSql = (() => {
      let clause = '';
      if (fromDate && !isNaN(fromDate)) clause += ' AND createdAt >= :from';
      if (toDate && !isNaN(toDate)) clause += ' AND createdAt <= :to';
      const side = (idCol, curCol, types) =>
        'SELECT ' + idCol + ' personId, ' + curCol + ' cur FROM Transactions WHERE type IN (' + types +
        ') AND ' + idCol + ' IN (:ids) AND ' + curCol + ' IS NOT NULL' + clause;
      return [
        side('senderId', 'currencyCode', "'admin_state_push','money_exchange','topup'"),
        side('senderId', 'toCurrencyCode', "'money_exchange'"),
        side('settledById', 'currencyCode', "'admin_state_push'"),
        side('receiverId', 'currencyCode', "'admin_state_push','agent_cash_out_money'"),
      ].join(' UNION ');
    })();

    const presence = {};
    if (ids.length) {
      const replacements = { ids };
      if (fromDate && !isNaN(fromDate)) replacements.from = fromDate;
      if (toDate && !isNaN(toDate)) replacements.to = toDate;
      const rows = await sequelize.query(presenceSql, {
        replacements,
        type: sequelize.QueryTypes.SELECT,
      });
      for (const r of rows) {
        if (r.personId == null) continue;
        (presence[r.personId] = presence[r.personId] || new Set()).add(code(r.cur));
      }
    }

    const collectedFor = (p) => {
      if (!staffRole(p.role)) return [];
      const acc = collectedBy[p.id] || {};
      const seen = presence[p.id] || new Set();
      const full = {};
      for (const cur of seen) full[cur] = 0;
      for (const [cur, v] of Object.entries(acc)) full[cur] = v;
      return asSignedList(full);
    };

    /* How many transactions this person actually took part in — counted once
       each, on whichever side they appear.

       This used to be sent.count + received.count, which was wrong twice over.
       It DOUBLE-COUNTED anyone who appeared on both sides of one row: an admin
       who settles a push they sent themselves is one transaction, not two. And
       it UNDERCOUNTED staff badly, because their "received" only counts pushes
       they settled — so being the addressee of a push still pending, or the
       receiver of an agent cash-out, did not register at all. One sub-admin was
       showing 6 against 9 real transactions; two admins showed 0 against 2 and
       5.

       A UNION dedupes the (person, transaction) pairs, so appearing as sender,
       receiver and settler on the same row still counts once. */
    const involvement = {};
    if (ids.length) {
      let clause = '';
      const replacements = { ids };
      if (fromDate && !isNaN(fromDate)) { clause += ' AND createdAt >= :from'; replacements.from = fromDate; }
      if (toDate && !isNaN(toDate)) { clause += ' AND createdAt <= :to'; replacements.to = toDate; }
      const side = (col) =>
        'SELECT ' + col + ' personId, id FROM Transactions WHERE ' + col + ' IN (:ids)' + clause;
      const rows = await sequelize.query(
        'SELECT personId, COUNT(*) n FROM (' +
          [side('senderId'), side('receiverId'), side('settledById')].join(' UNION ') +
        ') t GROUP BY personId',
        { replacements, type: sequelize.QueryTypes.SELECT },
      );
      for (const r of rows) if (r.personId != null) involvement[r.personId] = Number(r.n) || 0;
    }

    const nothing = { count: 0, byCurrency: {} };
    const staffRole = (r) => r === 'admin' || r === 'sub-admin';

    /* Who earns what, and from which column.

       Staff earn `commission` on the destination transfers they SEND.
       Agents earn `agentCommission` on the flows where they RECEIVE.
       A plain user earns nothing at all — the `commission` on a row they sent
       is the fee they were CHARGED, which is why a customer was appearing with
       2.50 SSP of "commission" they had in fact paid out. A charge is not an
       earning, so it is not reported as one. */
    const earningsFor = (p) => {
      if (staffRole(p.role)) return commBy[p.id] || nothing;
      if (p.role === 'agent') return agentCommBy[p.id] || nothing;
      return nothing;
    };

    /* "Received" means two different things depending on who is being asked
       about, so it is answered two different ways.

       A user or agent receives money: it arrives in their wallet, and the row
       that records it names them as the receiver.

       An admin or sub-admin does not — a destination transfer never moves their
       balance. What they do is mark a transfer as received, confirming the
       money reached the destination. That action is the one worth reporting
       against their name, so theirs counts what they settled rather than what
       merely had their name on it. */
    const receivedFor = (p) => {
      if (!staffRole(p.role)) return inBy[p.id] || nothing;
      return settledBy[p.id] || nothing;
    };

    const report = people.map((p) => {
      const out = outBy[p.id] || nothing;
      const inn = receivedFor(p);
      const com = earningsFor(p);
      return {
        id: p.id,
        name: p.name,
        email: p.email,
        phone: p.phone,
        role: p.role,
        destination: p.state || null,
        reference: p.agentId || p.adminId || null,
        balance: parseFloat(p.balance) || 0,
        /* Which kind of figure the balance is, so the table can label it
           rather than leaving the reader to infer it from the sign. */
        balanceKind: (p.role === 'admin' || p.role === 'sub-admin') ? 'net' : 'wallet',
        isVerified: !!p.isVerified,
        isSuspended: !!p.isSuspended,
        joined: p.createdAt,
        transactions: involvement[p.id] || 0,
        sent: { count: out.count, totals: asList(out.byCurrency) },
        received: { count: inn.count, totals: asList(inn.byCurrency) },
        commission: { count: com.count, totals: asList(com.byCurrency) },
        collected: collectedFor(p),
      };
    });

    /* Sorting happens here rather than in SQL: the interesting orders are on
       figures that only exist after the aggregates are stitched on. */
    const peak = (r) => Math.max(0, ...r.map((t) => t.amount));
    const sorters = {
      transactions: (a, b) => b.transactions - a.transactions,
      balance: (a, b) => b.balance - a.balance,
      commission: (a, b) => peak(b.commission.totals) - peak(a.commission.totals),
      name: (a, b) => String(a.name || a.email).localeCompare(String(b.name || b.email)),
      joined: (a, b) => new Date(b.joined) - new Date(a.joined),
    };
    report.sort(sorters[sort] || sorters.transactions);

    /* Two different things share the `balance` column, and adding them gives a
       number that means nothing.

       A user or agent has a WALLET: it is checked before they can spend and
       never goes negative. An admin or sub-admin is not gated at all — they
       send with no balance check — so theirs is a running position: commission
       earned, plus transfers received, minus transfers sent. Negative means
       they have pushed more out than they have taken in.

       Summing customer money and staff float together produced the app's cash
       position minus its own float, which is not a figure anyone asked for. */
    const summary = {
      total: report.length,
      byRole: {},
      transactions: 0,
      customerBalance: 0,      // money users and agents actually hold
      staffCommission: [],     // what admins and sub-admins earned in the window
      agentCommission: [],     // what agents earned in the window
      netCollected: [],        // money in through staff, less money paid out
    };
    const staffEarned = {};
    const agentEarned = {};

    /* The company's own position: everything that came in through an admin or
       sub-admin, less everything that went back out.

       It is the per-person Collected figure added up across all staff, so the
       two always agree — the same definition, at a different scale. Netting
       across people is safe in a way netting across currencies is not: a
       thousand SSP is a thousand SSP whoever took it in, while a thousand SSP
       and a thousand UGX are not two thousand of anything. So this stays split
       by currency like everything else here.

       A negative line means the company paid out more of that currency than it
       took in over the period — which is a real answer, not an error. */
    const netCollected = {};

    for (const r of report) {
      summary.byRole[r.role] = (summary.byRole[r.role] || 0) + 1;
      summary.transactions += r.transactions;
      if (!staffRole(r.role)) summary.customerBalance += r.balance;
      for (const t of r.collected || []) {
        netCollected[t.currency] = (netCollected[t.currency] || 0) + t.amount;
      }
      /* The cards follow the filters, exactly as the table does — a period with
         no commission in it reports zero for that period, which the page shows
         as 0.00 rather than a dash so it reads as an answer and not an absence.

         Commission is per currency and never added across them, for the same
         reason as every other figure here: there is no cross-rate. */
      const bucket = staffRole(r.role) ? staffEarned : (r.role === 'agent' ? agentEarned : null);
      if (bucket) for (const t of r.commission.totals) bucket[t.currency] = (bucket[t.currency] || 0) + t.amount;
    }
    summary.customerBalance = Math.round(summary.customerBalance * 100) / 100;
    summary.staffCommission = asList(staffEarned);
    summary.agentCommission = asList(agentEarned);
    summary.netCollected = asSignedList(netCollected);

    res.json({ summary, people: report });
  } catch (error) {
    console.error('People report failed:', error);
    res.status(500).json({ message: error.message });
  }
};

/* ==========================================================================
   Statement for one person — the data behind the downloadable invoice.

   The six terms of Amount Collected, the exchanges they made, an outstanding
   figure, and every transaction they took part in.

   The totals are COMPLETED ONLY, exactly as the Collected column is, so the
   terms printed on the document actually add up to the outstanding figure
   beneath them. The transaction list is deliberately not filtered that way —
   "all the transaction records" means all of them — so every row carries its
   status and the document states which basis the totals use. A reader adding
   the list up by hand would otherwise reach a different number with no way to
   see why.
   ========================================================================== */
export const getPersonStatement = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'A person id is required' });

    const person = await User.findByPk(id, {
      attributes: [
        'id', 'name', 'email', 'phone', 'role', 'state', 'balance',
        'isVerified', 'isSuspended', 'agentId', 'adminId', 'createdAt',
      ],
      raw: true,
    });
    if (!person) return res.status(404).json({ message: 'That person no longer exists' });

    const { from, to, range } = req.query;
    const preset = presetWindow(range);
    const fromDate = from ? startOfDay(new Date(from)) : (preset ? preset.from : null);
    const toDate = to ? endOfDay(new Date(to)) : (preset ? preset.to : null);
    const period = {};
    if (fromDate && !isNaN(fromDate) && toDate && !isNaN(toDate)) period.createdAt = { [Op.between]: [fromDate, toDate] };
    else if (fromDate && !isNaN(fromDate)) period.createdAt = { [Op.gte]: fromDate };
    else if (toDate && !isNaN(toDate)) period.createdAt = { [Op.lte]: toDate };

    const done = { ...period, status: 'completed' };
    const sum = (col, alias) => [sequelize.fn('SUM', sequelize.col(col)), alias];

    const [sent, received, topup, cashOut, exchanges, agentComm, txns] = await Promise.all([
      Transaction.findAll({
        where: { ...done, type: 'admin_state_push', senderId: id },
        attributes: ['currencyCode', sum('amount', 'amount'), sum('commission', 'commission')],
        group: ['currencyCode'], raw: true,
      }),
      Transaction.findAll({
        where: { ...done, type: 'admin_state_push', settledById: id },
        attributes: ['currencyCode', sum('amount', 'amount')],
        group: ['currencyCode'], raw: true,
      }),
      Transaction.findAll({
        where: { ...done, type: 'topup', senderId: id },
        attributes: ['currencyCode', sum('amount', 'amount')],
        group: ['currencyCode'], raw: true,
      }),
      Transaction.findAll({
        where: { ...done, type: 'agent_cash_out_money', receiverId: id },
        attributes: ['currencyCode', sum('amount', 'amount')],
        group: ['currencyCode'], raw: true,
      }),
      /* Kept as pairs. An exchange is "SSP to USD", and collapsing it to one
         currency loses the half that says what it was turned into. */
      Transaction.findAll({
        where: { ...done, type: 'money_exchange', senderId: id },
        attributes: [
          'currencyCode', 'toCurrencyCode',
          sum('amount', 'amount'), sum('convertedAmount', 'converted'),
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        ],
        group: ['currencyCode', 'toCurrencyCode'], raw: true,
      }),
      /* An agent earns on the other side of the row, so without this their
         document would show no earnings at all. */
      Transaction.findAll({
        where: { ...period, status: { [Op.ne]: 'cancelled' }, receiverId: id, agentCommission: { [Op.gt]: 0 } },
        attributes: ['currencyCode', sum('agentCommission', 'amount')],
        group: ['currencyCode'], raw: true,
      }),
      Transaction.findAll({
        where: {
          ...period,
          [Op.or]: [{ senderId: id }, { receiverId: id }, { settledById: id }],
        },
        include: [
          { model: User, as: 'sender', attributes: ['name', 'phone'] },
          { model: User, as: 'receiver', attributes: ['name', 'phone'] },
          { model: User, as: 'settledBy', attributes: ['name', 'email'], required: false },
        ],
        order: [['createdAt', 'DESC']],
      }),
    ]);

    const bucket = (list, key = 'amount') => {
      const acc = {};
      for (const r of list) acc[code(r.currencyCode)] = (acc[code(r.currencyCode)] || 0) + (Number(r[key]) || 0);
      return acc;
    };

    const sentBy = bucket(sent);
    const commissionBy = bucket(sent, 'commission');
    const receivedBy = bucket(received);
    const topupBy = bucket(topup);
    const cashOutBy = bucket(cashOut);
    const exchangedBy = bucket(exchanges);
    const agentCommBy = bucket(agentComm);

    /* The converted leg lands in the TARGET currency, so it cannot share the
       bucketing helper above — that keys on currencyCode. */
    const convertedBy = {};
    for (const r of exchanges) {
      if (!r.toCurrencyCode) continue;
      const cur = code(r.toCurrencyCode);
      convertedBy[cur] = (convertedBy[cur] || 0) + (Number(r.converted) || 0);
    }

    /* Outstanding, term for term, exactly as the Collected column computes it:
       sent + commission + top-up + converted, less received, exchanged and
       cash out. */
    const outstanding = {};
    const post = (map, sign) => {
      for (const [cur, v] of Object.entries(map)) outstanding[cur] = (outstanding[cur] || 0) + sign * v;
    };
    post(sentBy, +1);
    post(commissionBy, +1);
    post(topupBy, +1);
    post(receivedBy, -1);
    post(exchangedBy, -1);
    post(convertedBy, +1);
    post(cashOutBy, -1);

    const staff = person.role === 'admin' || person.role === 'sub-admin';

    res.json({
      person: {
        id: person.id,
        name: person.name,
        email: person.email,
        phone: person.phone,
        role: person.role,
        destination: person.state || null,
        reference: person.agentId || person.adminId || null,
        balance: parseFloat(person.balance) || 0,
        isVerified: !!person.isVerified,
        isSuspended: !!person.isSuspended,
        joined: person.createdAt,
      },
      period: { from: fromDate || null, to: toDate || null, range: range || null },
      totals: {
        commission: asList(staff ? commissionBy : agentCommBy),
        sent: asList(sentBy),
        received: asList(receivedBy),
        topup: asList(topupBy),
        cashOut: asList(cashOutBy),
        exchanged: asList(exchangedBy),
        converted: asList(convertedBy),
        exchanges: exchanges
          .map((r) => ({
            from: code(r.currencyCode),
            to: r.toCurrencyCode ? code(r.toCurrencyCode) : null,
            amount: Math.round((Number(r.amount) || 0) * 100) / 100,
            converted: Math.round((Number(r.converted) || 0) * 100) / 100,
            count: Number(r.count) || 0,
          }))
          .sort((a, b) => b.amount - a.amount),
        outstanding: asSignedList(outstanding),
      },
      transactions: txns.map((t) => ({
        id: t.id,
        transactionId: t.transactionId,
        type: t.type,
        status: t.status,
        amount: parseFloat(t.amount) || 0,
        currencyCode: code(t.currencyCode),
        toCurrencyCode: t.toCurrencyCode ? code(t.toCurrencyCode) : null,
        convertedAmount: t.convertedAmount == null ? null : parseFloat(t.convertedAmount),
        commission: parseFloat(t.commission) || 0,
        agentCommission: parseFloat(t.agentCommission) || 0,
        fromStateName: t.fromStateName || null,
        toStateName: t.toStateName || null,
        sender: t.sender ? (t.sender.name || t.sender.phone) : null,
        receiver: t.receiver ? (t.receiver.name || t.receiver.phone) : null,
        settledBy: t.settledBy ? (t.settledBy.name || t.settledBy.email) : null,
        settledAt: t.settledAt || null,
        /* Which side this person was on, so the document can say so without a
           reader cross-referencing names. */
        direction: Number(t.senderId) === id ? 'out' : (Number(t.receiverId) === id ? 'in' : 'settled'),
        createdAt: t.createdAt,
      })),
    });
  } catch (error) {
    console.error('Person statement failed:', error);
    res.status(500).json({ message: error.message });
  }
};
