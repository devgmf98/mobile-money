import { Op } from 'sequelize';
import StateSetting from '../models/StateSetting.js';

/* An admin's destination is stored as the StateSetting id, not its name: names
   are editable, and storing one would mean renaming a destination silently
   detached every admin assigned to it. Callers, though, think in names — so
   anything that accepts a destination takes either form and resolves it here.

   Returns { id, name } on success, or { error } with a message naming the
   destinations that do exist, which is more use than "not found". */
export async function resolveDestination(value) {
  if (value === null || value === undefined || value === '') return { id: null, name: null };

  /* A number, or a string that is entirely digits, is an id. A name made only
     of digits would be ambiguous, but StateSetting names are place names. */
  const raw = String(value).trim();
  const asId = /^\d+$/.test(raw) ? Number(raw) : null;

  const found = asId !== null
    ? await StateSetting.findByPk(asId)
    /* Case- and space-insensitive, so "juba" and "JUBA " both land. */
    : await StateSetting.findOne({ where: { name: { [Op.eq]: raw } } })
      || await StateSetting.findOne({
        where: sequelizeLower(raw),
      });

  if (found) return { id: found.id, name: found.name };

  const all = await StateSetting.findAll({ attributes: ['id', 'name'], order: [['name', 'ASC']] });
  return {
    error: `Unknown destination "${raw}". Available: ` +
      (all.length ? all.map(s => s.name).join(', ') : 'none configured yet'),
  };
}

/* MySQL's default collation is already case-insensitive, but the comparison is
   spelled out so the behaviour does not depend on how the column was created. */
function sequelizeLower(raw) {
  const { fn, col, where } = StateSetting.sequelize.Sequelize;
  return where(fn('LOWER', col('name')), raw.toLowerCase());
}
