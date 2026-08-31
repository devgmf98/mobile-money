import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  balance: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  autoAdminCashout: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  role: {
    type: DataTypes.ENUM('user', 'agent', 'admin'),
    defaultValue: 'user'
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isSuspended: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  verificationCode: {
    type: DataTypes.STRING,
    allowNull: true
  },
  verificationExpiry: {
    type: DataTypes.DATE,
    allowNull: true
  },
  profileImage: {
    type: DataTypes.TEXT('long'),
    allowNull: true
  },
  idNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  agentId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  adminId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  /* The destination's name, not its id — 'JUBA' rather than 1, so the value
     means something wherever it is read. StateSettings.name is unique, so the
     foreign key points at it directly and validity is still enforced;
     ON UPDATE CASCADE rewrites every admin here when a destination is
     renamed, which is the one thing storing a name would otherwise cost. */
  state: {
    type: DataTypes.STRING,
    allowNull: true
  },
  currentLocation: {
    type: DataTypes.JSON,
    allowNull: true
  },
  adminLocationConsent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  theme: {
    type: DataTypes.ENUM('light', 'dark'),
    defaultValue: 'light'
  }
}, {
  timestamps: true,
  /* Declared here with explicit names rather than as `unique: true` on the
     column. An unnamed unique constraint is created by MySQL as `email`,
     `email_2`, `email_3`… and sync({ alter: true }) could not tell that it
     already existed, so every boot added another one — 64 of them reached
     MySQL's per-table key limit and the server stopped starting. A fixed name
     is recognisable, so it is created once and matched from then on. */
  indexes: [
    { unique: true, name: 'users_email_unique', fields: ['email'] },
    { unique: true, name: 'users_phone_unique', fields: ['phone'] },
    { unique: true, name: 'users_agent_id_unique', fields: ['agentId'] },
    { unique: true, name: 'users_admin_id_unique', fields: ['adminId'] }
  ]
});

// Define associations
User.associate = (models) => {
  User.hasMany(models.Transaction, { foreignKey: 'senderId', as: 'sentTransactions' });
  User.hasMany(models.Transaction, { foreignKey: 'receiverId', as: 'receivedTransactions' });
  User.hasMany(models.Notification, { foreignKey: 'recipientId', as: 'notifications' });
  User.hasMany(models.WithdrawalRequest, { foreignKey: 'agentId', as: 'agentRequests' });
  User.hasMany(models.WithdrawalRequest, { foreignKey: 'userId', as: 'userRequests' });
  /* constraints: false leaves the foreign key to the database. Sequelize
     cannot recognise a constraint it did not name, so sync({ alter: true })
     added another on every boot — the same way it did with the unique
     indexes, and heading for the same 64-key wall. The real key, with its
     ON UPDATE CASCADE, is created once by scripts/migrateStateToName.js. */
  User.belongsTo(models.StateSetting, {
    foreignKey: 'state', targetKey: 'name', as: 'stateSetting', constraints: false
  });
};

export default User;
