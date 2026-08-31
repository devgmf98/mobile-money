import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const StateSetting = sequelize.define('StateSetting', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  commissionPercent: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0
  }
}, {
  timestamps: true,
  /* Named so sync({ alter: true }) can recognise it. Unnamed unique indexes
     come back as `name`, `name_2`, `name_3`… on every boot until the table hits
     MySQL's 64-key limit and the server stops starting. */
  indexes: [
    { unique: true, name: 'state_settings_name_unique', fields: ['name'] }
  ]
});

export default StateSetting;
