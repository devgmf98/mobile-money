-- Create GCash Database
CREATE DATABASE IF NOT EXISTS if0_40843476_chapchapdb;
USE if0_40843476_chapchapdb;

-- Users table
CREATE TABLE IF NOT EXISTS Users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  balance DECIMAL(10,2) DEFAULT 0,
  autoAdminCashout BOOLEAN DEFAULT FALSE,
  role ENUM('user', 'agent', 'admin') DEFAULT 'user',
  isVerified BOOLEAN DEFAULT FALSE,
  isSuspended BOOLEAN DEFAULT FALSE,
  verificationCode VARCHAR(255),
  verificationExpiry DATETIME,
  profileImage LONGTEXT,
  idNumber VARCHAR(255),
  agentId VARCHAR(255) UNIQUE,
  adminId VARCHAR(255) UNIQUE,
  state INT,
  currentLocation JSON,
  adminLocationConsent BOOLEAN DEFAULT FALSE,
  theme ENUM('light', 'dark') DEFAULT 'light',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Transactions table
CREATE TABLE IF NOT EXISTS Transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transactionId VARCHAR(255) NOT NULL UNIQUE,
  senderId INT NOT NULL,
  receiverId INT,
  amount DECIMAL(10,2) NOT NULL,
  type ENUM('transfer', 'topup', 'withdrawal', 'user_withdraw', 'agent_deposit', 'agent_cash_out_money', 'admin_push', 'admin_state_push', 'money_exchange') NOT NULL,
  status ENUM('pending', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
  description TEXT,
  commission DECIMAL(10,2) DEFAULT 0,
  commissionPercent DECIMAL(5,2) DEFAULT 0,
  agentCommission DECIMAL(10,2) DEFAULT 0,
  agentCommissionPercent DECIMAL(5,2) DEFAULT 0,
  companyCommission DECIMAL(10,2) DEFAULT 0,
  companyCommissionPercent DECIMAL(5,2) DEFAULT 0,
  receiverCredit DECIMAL(10,2),
  currencyCode VARCHAR(10),
  currencySymbol VARCHAR(10),
  exchangeRate DECIMAL(20,10) DEFAULT 1,
  toCurrencyCode VARCHAR(255),
  convertedAmount DECIMAL(20,6),
  exchangeMode ENUM('buying','selling'),
  currencyTier VARCHAR(50),
  senderBalance DECIMAL(10,2),
  receiverBalance DECIMAL(10,2),
  senderLocation JSON,
  receiverLocation JSON,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (senderId) REFERENCES Users(id),
  FOREIGN KEY (receiverId) REFERENCES Users(id)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS Notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recipientId INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('transaction', 'system', 'alert', 'offer', 'withdrawal_request') DEFAULT 'system',
  isRead BOOLEAN DEFAULT FALSE,
  relatedTransactionId INT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (recipientId) REFERENCES Users(id),
  FOREIGN KEY (relatedTransactionId) REFERENCES Transactions(id)
);

-- Verifications table
CREATE TABLE IF NOT EXISTS Verifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(255) NOT NULL,
  code VARCHAR(255) NOT NULL,
  purpose ENUM('registration', 'password_reset', 'transaction') NOT NULL,
  isVerified BOOLEAN DEFAULT FALSE,
  attempts INT DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- WithdrawalRequests table
CREATE TABLE IF NOT EXISTS WithdrawalRequests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  agentId INT NOT NULL,
  userId INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  agentCommission DECIMAL(10,2) DEFAULT 0,
  agentCommissionPercent DECIMAL(5,2) DEFAULT 0,
  companyCommission DECIMAL(10,2) DEFAULT 0,
  companyCommissionPercent DECIMAL(5,2) DEFAULT 0,
  commission DECIMAL(10,2) DEFAULT 0,
  commissionPercent DECIMAL(5,2) DEFAULT 0,
  status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
  reason TEXT,
  approvedAt DATETIME,
  rejectedAt DATETIME,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (agentId) REFERENCES Users(id),
  FOREIGN KEY (userId) REFERENCES Users(id)
);

-- Currencies table
CREATE TABLE IF NOT EXISTS Currencies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(10) NOT NULL UNIQUE,
  symbol VARCHAR(10) DEFAULT '',
  countries JSON,
  exchangeRate DECIMAL(10,4),
  sellingPrice DECIMAL(10,2),
  buyingPrice DECIMAL(10,2),
  priceType ENUM('fixed', 'percentage') DEFAULT 'fixed',
  tier VARCHAR(50),
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ExchangeRates table
CREATE TABLE IF NOT EXISTS ExchangeRates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fromCode VARCHAR(10) NOT NULL,
  toCode VARCHAR(10) NOT NULL,
  buyingPrice DECIMAL(15,10),
  sellingPrice DECIMAL(15,10),
  priceType ENUM('fixed', 'percentage') DEFAULT 'fixed',
  meta JSON,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_pair (fromCode, toCode)
);

-- SendMoneyCommissionTiers table
CREATE TABLE IF NOT EXISTS SendMoneyCommissionTiers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  minAmount DECIMAL(10,2) NOT NULL,
  maxAmount DECIMAL(10,2) NOT NULL,
  companyPercent DECIMAL(5,2) DEFAULT 0,
  userPercent DECIMAL(5,2) DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- WithdrawalCommissionTiers table
CREATE TABLE IF NOT EXISTS WithdrawalCommissionTiers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  minAmount DECIMAL(10,2) NOT NULL,
  maxAmount DECIMAL(10,2) NOT NULL,
  agentPercent DECIMAL(5,2) DEFAULT 0,
  companyPercent DECIMAL(5,2) DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- StateSettings table
CREATE TABLE IF NOT EXISTS StateSettings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  commissionPercent DECIMAL(5,2) DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Add indexes
CREATE INDEX idx_email ON Users(email);
CREATE INDEX idx_phone ON Users(phone);
CREATE INDEX idx_agentId ON Users(agentId);
CREATE INDEX idx_adminId ON Users(adminId);
CREATE INDEX idx_transactionId ON Transactions(transactionId);
CREATE INDEX idx_senderId ON Transactions(senderId);
CREATE INDEX idx_receiverId ON Transactions(receiverId);
CREATE INDEX idx_status ON Transactions(status);
CREATE INDEX idx_type ON Transactions(type);
CREATE INDEX idx_recipientId ON Notifications(recipientId);
CREATE INDEX idx_isRead ON Notifications(isRead);
CREATE INDEX idx_notification_type ON Notifications(type);
CREATE INDEX idx_relatedTransactionId ON Notifications(relatedTransactionId);
CREATE INDEX idx_verification_phone ON Verifications(phone);
CREATE INDEX idx_verification_purpose ON Verifications(purpose);
CREATE INDEX idx_verification_isVerified ON Verifications(isVerified);
CREATE INDEX idx_withdrawal_agentId ON WithdrawalRequests(agentId);
CREATE INDEX idx_withdrawal_userId ON WithdrawalRequests(userId);
CREATE INDEX idx_withdrawal_status ON WithdrawalRequests(status);
CREATE INDEX idx_currency_code ON Currencies(code);
CREATE INDEX idx_currency_tier ON Currencies(tier);
CREATE INDEX idx_exchange_from ON ExchangeRates(fromCode);
CREATE INDEX idx_exchange_to ON ExchangeRates(toCode);
CREATE INDEX idx_state_name ON StateSettings(name);