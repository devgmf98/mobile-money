import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  transactionId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  senderId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  receiverId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('transfer', 'topup', 'withdrawal', 'user_withdraw', 'agent_deposit', 'agent_cash_out_money', 'admin_push', 'admin_state_push', 'money_exchange'),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed', 'cancelled'),
    defaultValue: 'pending'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  commission: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  commissionPercent: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0
  },
  agentCommission: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  agentCommissionPercent: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0
  },
  companyCommission: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  companyCommissionPercent: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0
  },
  receiverCredit: {
    // widened so an exchange result like 0.0125 is not rounded to 0.01
    type: DataTypes.DECIMAL(20, 6),
    allowNull: true
  },
  currencyCode: {
    type: DataTypes.STRING,
    allowNull: true
  },
  currencySymbol: {
    type: DataTypes.STRING,
    allowNull: true
  },
  exchangeRate: {
    // 10,4 rounded small rates away (0.000125 became 0.0001)
    type: DataTypes.DECIMAL(20, 10),
    defaultValue: 1
  },
  // ---- money exchange ----
  toCurrencyCode: {
    type: DataTypes.STRING,
    allowNull: true
  },
  convertedAmount: {
    type: DataTypes.DECIMAL(20, 6),
    allowNull: true
  },
  exchangeMode: {
    type: DataTypes.ENUM('buying', 'selling'),
    allowNull: true
  },
  currencyTier: {
    type: DataTypes.STRING,
    allowNull: true
  },
  /* Where an admin_state_push came FROM and went TO. The ids point at
     StateSettings, and the names are copied alongside them on purpose: a
     destination that is later renamed or deleted would otherwise erase the
     meaning of every transaction that referenced it, and these are financial
     records that have to keep reading correctly years later. */
  fromStateId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  fromStateName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  toStateId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  toStateName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  senderBalance: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  receiverBalance: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  senderLocation: {
    type: DataTypes.JSON,
    allowNull: true
  },
  receiverLocation: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  timestamps: true,
  indexes: [
    { unique: true, fields: ['transactionId'] },
    { fields: ['senderId'] },
    { fields: ['receiverId'] },
    { fields: ['status'] },
    { fields: ['type'] }
  ]
});

// Define associations
Transaction.associate = (models) => {
  Transaction.belongsTo(models.User, { foreignKey: 'senderId', as: 'sender' });
  Transaction.belongsTo(models.User, { foreignKey: 'receiverId', as: 'receiver' });
  Transaction.hasMany(models.Notification, { foreignKey: 'relatedTransactionId', as: 'notifications' });
};

export default Transaction;
