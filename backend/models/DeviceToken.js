import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

/* Where to send a push for a given account.

   A row per device rather than a column on Users: people sign in on a phone
   and a laptop, replace a phone, or share one, and a single column would mean
   the last device to sign in silently stole every notification from the rest.

   The token is unique across the table, not per user. Firebase issues one per
   app install, so the same token appearing under a second account means the
   device changed hands — the row is reassigned rather than duplicated, which
   is what stops the previous person's notifications arriving on it. */
const DeviceToken = sequelize.define('DeviceToken', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'Users', key: 'id' }
  },
  token: {
    /* Well over the 163 characters FCM currently issues, because it has grown
       before and a truncated token fails silently at send time. */
    type: DataTypes.STRING(512),
    allowNull: false,
    unique: true
  },
  platform: {
    type: DataTypes.ENUM('android', 'ios', 'web'),
    allowNull: false,
    defaultValue: 'android'
  },
  /* Something a person could recognise -- "Android 14", "Chrome on Windows".
     A token is 163 characters of opaque text, so without this there is no way
     to answer "which of my devices is this?" when a row looks wrong. */
  deviceName: {
    type: DataTypes.STRING(120),
    allowNull: true
  },
  /* Refreshed on every sign-in, so a device nobody has used for months can be
     told apart from the one in someone's hand. */
  lastSeenAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  indexes: [{ fields: ['userId'] }]
});

export default DeviceToken;
