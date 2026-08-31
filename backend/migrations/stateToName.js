/* Converts Users.state from the StateSettings id to the destination's name.
 *
 * This runs on every startup, before sync(), because sync() cannot perform it
 * and cannot survive it being undone: the model declares `state` as a string,
 * so against an un-migrated database Sequelize tries
 *
 *   ALTER TABLE users MODIFY state VARCHAR(255)
 *
 * and MySQL refuses with ER_FK_COLUMN_CANNOT_CHANGE, because the column is
 * still tied to a foreign key. The error kills the process before it listens,
 * which reaches a deployment as a 502 rather than as anything about columns.
 * Doing the conversion first means a deploy fixes itself.
 *
 * Idempotent: it reports what it did, and does nothing on a database that is
 * already converted.
 */
const FK = 'users_state_destination_fk';

async function actualTableName(sequelize, db, baseName) {
  const [rows] = await sequelize.query(
    `SELECT TABLE_NAME AS tableName FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND LOWER(TABLE_NAME) = LOWER(?)
      ORDER BY TABLE_NAME LIMIT 1`,
    { replacements: [db, baseName] }
  );
  return rows[0]?.tableName || null;
}

async function foreignKeysOnState(sequelize, db, usersTableName) {
  const [rows] = await sequelize.query(
    `SELECT DISTINCT CONSTRAINT_NAME n FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? AND LOWER(TABLE_NAME) = LOWER(?)
        AND LOWER(COLUMN_NAME) = 'state' AND REFERENCED_TABLE_NAME IS NOT NULL`,
    { replacements: [db, usersTableName] }
  );
  return rows.map(r => r.n);
}

export async function migrateStateToName(sequelize) {
  const db = sequelize.getDatabaseName();
  const usersTableName = await actualTableName(sequelize, db, 'users');
  const statesTableName = await actualTableName(sequelize, db, 'statesettings');

  if (!usersTableName) {
    return { skipped: 'users table does not exist yet' };
  }

  const [[col]] = await sequelize.query(
    `SELECT COLUMN_TYPE t FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = 'state'`,
    { replacements: [db, usersTableName] }
  );
  /* No table yet — a brand new database. sync() will build it from the model,
     which already declares the column as a string. */
  if (!col) {
    const changed = [];
    await sequelize.query(
      'ALTER TABLE `' + usersTableName + '` ADD COLUMN IF NOT EXISTS `state` VARCHAR(255) ' +
      'CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL'
    );
    changed.push('added missing state column');

    if (statesTableName) {
      const existing = await foreignKeysOnState(sequelize, db, usersTableName);
      if (!existing.includes(FK)) {
        await sequelize.query(
          'ALTER TABLE `' + usersTableName + '` ADD CONSTRAINT `' + FK + '` ' +
          'FOREIGN KEY (`state`) REFERENCES `' + statesTableName + '` (`name`) ' +
          'ON DELETE SET NULL ON UPDATE CASCADE'
        );
        changed.push('added ' + FK + ' -> statesettings.name');
      }
    }

    return { changed };
  }

  const existing = await foreignKeysOnState(sequelize, db, usersTableName);
  const isInt = col.t.startsWith('int');

  /* Already text with exactly the one key: nothing to do, which is the case on
     every boot after the first. */
  if (!isInt && existing.length === 1 && existing[0] === FK) {
    return { skipped: 'already converted' };
  }

  const done = [];

  /* Every foreign key has to go before the type can change. There are usually
     several: sync({ alter: true }) adds another whenever it cannot recognise
     the one already there. */
  if (existing.length) {
    for (const name of existing) {
      await sequelize.query('ALTER TABLE `' + usersTableName + '` DROP FOREIGN KEY `' + name + '`');
    }
    done.push(`dropped ${existing.length} foreign key(s)`);
  }

  if (isInt) {
    await sequelize.query(
      'ALTER TABLE `' + usersTableName + '` MODIFY `state` VARCHAR(255) ' +
      'CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL'
    );
    await sequelize.query(
      'UPDATE `' + usersTableName + '` u JOIN `' + statesTableName + '` s ON s.id = u.`state` SET u.`state` = s.name'
    );
    done.push('rewrote ids as destination names');

    /* An id with no matching destination cannot be expressed as a name and
       would fail the new key. An empty field beats a wrong one. */
    const [orphans] = await sequelize.query(
      'UPDATE `' + usersTableName + '` u LEFT JOIN `' + statesTableName + '` s ON s.name = u.`state` ' +
      'SET u.`state` = NULL WHERE u.`state` IS NOT NULL AND s.name IS NULL'
    );
    if (orphans.affectedRows) done.push(`cleared ${orphans.affectedRows} unmatched row(s)`);
  }

  await sequelize.query(
    'ALTER TABLE `' + usersTableName + '` ADD CONSTRAINT `' + FK + '` ' +
    'FOREIGN KEY (`state`) REFERENCES `' + statesTableName + '` (`name`) ' +
    'ON DELETE SET NULL ON UPDATE CASCADE'
  );
  done.push('added ' + FK + ' -> statesettings.name');

  return { changed: done };
}
