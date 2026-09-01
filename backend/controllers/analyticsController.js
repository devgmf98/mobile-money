import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';

/* ==========================================================================
   Transaction analytics.

   One query shape, five independent filters, and totals that are grouped by
   currency rather than added together. A single grand total across SSP, USD
   and UGX would be a number with no meaning — the app holds no cross-rate for
   arbitrary pairs at report time, and adding 100 USD to 100 SSP is simply
   wrong. Each currency is reported on its own line, and the caller sees the
   count across all of them.
   ========================================================================== */

const DAY = 24 * 60 * 60 * 1000;

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

/* The presets. A custom from/to always wins over these — the preset is a
   shortcut for filling the same two fields, not a separate mode. */
function presetWindow(range) {
  const now = new Date();
  if (range === 'today') return { from: startOfDay(now), to: endOfDay(now) };
  if (range === 'week') return { from: startOfDay(new Date(now.getTime() - 6 * DAY)), to: endOfDay(now) };
  if (range === 'month') {
    const f = new Date(now); f.setMonth(f.getMonth() - 1);
    return { from: startOfDay(f), to: endOfDay(now) };
  }
  if (range === 'year') {
    const f = new Date(now); f.setFullYear(f.getFullYear() - 1);
    return { from: startOfDay(f), to: endOfDay(now) };
  }
  return null;
}

export const getTransactionAnalytics = async (req, res) => {
  try {
    const { from, to, range, type, role, destination, staffId, status } = req.query;

    const where = {};

    /* --- when --- */
    const preset = presetWindow(range);
    const fromDate = from ? startOfDay(new Date(from)) : (preset ? preset.from : null);
    const toDate = to ? endOfDay(new Date(to)) : (preset ? preset.to : null);
    if (fromDate && !isNaN(fromDate) && toDate && !isNaN(toDate)) {
      where.createdAt = { [Op.between]: [fromDate, toDate] };
    } else if (fromDate && !isNaN(fromDate)) {
      where.createdAt = { [Op.gte]: fromDate };
    } else if (toDate && !isNaN(toDate)) {
      where.createdAt = { [Op.lte]: toDate };
    }

    /* --- what --- */
    if (type && type !== 'all') where.type = type;
    if (status && status !== 'all') where.status = status;

    /* --- where the money moved. A transfer touches two destinations, and it
           belongs to both for reporting: money leaving Juba is Juba's business
           and so is money arriving there. --- */
    if (destination && destination !== 'all') {
      where[Op.or] = [{ fromStateName: destination }, { toStateName: destination }];
    }

    /* --- who. Either side of the transaction counts: an admin who received a
           destination push was as involved as the one who sent it. --- */
    if (staffId && staffId !== 'all') {
      const id = Number(staffId);
      if (!isNaN(id)) {
        const clause = [{ senderId: id }, { receiverId: id }];
        where[Op.and] = [...(where[Op.and] || []), { [Op.or]: clause }];
      }
    }

    /* Filtering by role needs the joined users, so it is applied through the
       include rather than the where above. */
    let roleIds = null;
    if (role && role !== 'all') {
      const people = await User.findAll({ where: { role }, attributes: ['id'], raw: true });
      roleIds = people.map((p) => p.id);
      if (!roleIds.length) {
        return res.json({ count: 0, totals: [], byType: [], byStatus: [], byDestination: [], top: [] });
      }
      where[Op.and] = [
        ...(where[Op.and] || []),
        { [Op.or]: [{ senderId: { [Op.in]: roleIds } }, { receiverId: { [Op.in]: roleIds } }] },
      ];
    }

    const money = [sequelize.fn('SUM', sequelize.col('amount')), 'amount'];
    const rows = [sequelize.fn('COUNT', sequelize.col('id')), 'count'];

    /* Commission earned, attributed to the person who earned it. Only the
       sender of a destination transfer earns one, and the figure already sits
       on the row, so this is the same slice grouped a different way rather
       than a second definition of commission that could drift from the
       dashboard card. */
    const commissionQuery = { ...where, commission: { [Op.gt]: 0 } };

    const [totals, byType, byStatus, byDestination, byStaffRows, byCompanyRows, count] = await Promise.all([
      Transaction.findAll({ where, attributes: ['currencyCode', money, rows], group: ['currencyCode'], raw: true }),
      Transaction.findAll({ where, attributes: ['type', 'currencyCode', money, rows], group: ['type', 'currencyCode'], raw: true }),
      Transaction.findAll({ where, attributes: ['status', rows], group: ['status'], raw: true }),
      Transaction.findAll({ where, attributes: ['fromStateName', 'currencyCode', money, rows], group: ['fromStateName', 'currencyCode'], raw: true }),
      Transaction.findAll({
        where: commissionQuery,
        attributes: [
          'senderId',
          'currencyCode',
          [sequelize.fn('SUM', sequelize.col('commission')), 'amount'],
          rows,
        ],
        group: ['senderId', 'currencyCode'],
        raw: true,
      }),
      /* The company's own cut, split by the kind of transaction that produced
         it, so a reader can see where the house earns rather than only how
         much. Commission an admin earns and commission the company earns are
         separate columns on the row — neither is a share of the other. */
      Transaction.findAll({
        where: { ...where, companyCommission: { [Op.gt]: 0 } },
        attributes: [
          'type',
          'currencyCode',
          [sequelize.fn('SUM', sequelize.col('companyCommission')), 'amount'],
          rows,
        ],
        group: ['type', 'currencyCode'],
        raw: true,
      }),
      Transaction.count({ where }),
    ]);

    /* An unlabelled row predates the currency columns. SSP is the base every
       balance is held in, so that is where it belongs — dropping it would
       quietly understate the total. */
    const code = (c) => (c || 'SSP').toUpperCase();

    const fold = (list, keyName) => {
      const acc = {};
      for (const r of list) {
        const key = keyName ? (r[keyName] == null ? '—' : String(r[keyName])) : 'all';
        const cur = code(r.currencyCode);
        acc[key] = acc[key] || { key, currencies: {}, count: 0 };
        acc[key].currencies[cur] = (acc[key].currencies[cur] || 0) + (Number(r.amount) || 0);
        acc[key].count += Number(r.count) || 0;
      }
      return Object.values(acc)
        .map((e) => ({
          key: e.key,
          count: e.count,
          totals: Object.entries(e.currencies)
            .map(([currency, amount]) => ({ currency, amount }))
            .sort((a, b) => b.amount - a.amount),
        }))
        .sort((a, b) => b.count - a.count);
    };

    const totalsByCurrency = {};
    for (const r of totals) {
      const cur = code(r.currencyCode);
      totalsByCurrency[cur] = (totalsByCurrency[cur] || 0) + (Number(r.amount) || 0);
    }

    /* Names and roles for whoever earned something. Looked up once here rather
       than joined per row, and anyone who is no longer staff is dropped: this
       block answers "what did my admins earn", not "what does this id owe". */
    const earnerIds = [...new Set(byStaffRows.map((r) => r.senderId).filter(Boolean))];
    const earners = earnerIds.length
      ? await User.findAll({
          where: { id: { [Op.in]: earnerIds }, role: { [Op.in]: ['admin', 'sub-admin'] } },
          attributes: ['id', 'name', 'email', 'role'],
          raw: true,
        })
      : [];
    const byId = new Map(earners.map((u) => [u.id, u]));

    /* Keyed on the account id, not the display name. Three admins here are all
       called "GMF ADMIN"; grouping by name merged their commission into one
       row and credited it to whichever of them happened to be first. The name
       travels alongside for display, and so does the email, which is what
       tells duplicates apart. */
    const staffAcc = {};
    for (const r of byStaffRows) {
      const who = byId.get(r.senderId);
      if (!who) continue;
      const cur = code(r.currencyCode);
      staffAcc[who.id] = staffAcc[who.id] || {
        id: who.id,
        key: who.name || who.email,
        email: who.email,
        role: who.role,
        count: 0,
        currencies: {},
      };
      staffAcc[who.id].currencies[cur] = (staffAcc[who.id].currencies[cur] || 0) + (Number(r.amount) || 0);
      staffAcc[who.id].count += Number(r.count) || 0;
    }

    const byStaff = Object.values(staffAcc)
      .map((e) => ({
        id: e.id,
        key: e.key,
        email: e.email,
        role: e.role,
        count: e.count,
        totals: Object.entries(e.currencies)
          .map(([currency, amount]) => ({ currency, amount }))
          .sort((a, b) => b.amount - a.amount),
      }))
      .sort((a, b) => {
        const av = a.totals[0]?.amount || 0;
        const bv = b.totals[0]?.amount || 0;
        return bv - av;
      });

    res.json({
      byStaff,
      byCompany: fold(byCompanyRows, 'type'),
      count,
      totals: Object.entries(totalsByCurrency)
        .map(([currency, amount]) => ({ currency, amount }))
        .sort((a, b) => b.amount - a.amount),
      byType: fold(byType, 'type'),
      byStatus: byStatus.map((r) => ({ key: r.status || '—', count: Number(r.count) || 0 })).sort((a, b) => b.count - a.count),
      byDestination: fold(byDestination, 'fromStateName'),
    });
  } catch (error) {
    console.error('Transaction analytics failed:', error);
    res.status(500).json({ message: error.message });
  }
};
