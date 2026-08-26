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
    allowNull: false,
    unique: true
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
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
    allowNull: true,
    unique: true
  },
  adminId: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  state: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'StateSettings',
      key: 'id'
    }
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
  timestamps: true
});

// Define associations
User.associate = (models) => {
  User.hasMany(models.Transaction, { foreignKey: 'senderId', as: 'sentTransactions' });
  User.hasMany(models.Transaction, { foreignKey: 'receiverId', as: 'receivedTransactions' });
  User.hasMany(models.Notification, { foreignKey: 'recipientId', as: 'notifications' });
  User.hasMany(models.WithdrawalRequest, { foreignKey: 'agentId', as: 'agentRequests' });
  User.hasMany(models.WithdrawalRequest, { foreignKey: 'userId', as: 'userRequests' });
  User.belongsTo(models.StateSetting, { foreignKey: 'state', as: 'stateSetting' });
};

export default User;
