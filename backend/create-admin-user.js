import sequelize from './config/database.js';
import User from './models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

async function createAdminUser() {
  try {
    console.log('Creating admin user for Postman testing...');

    // Check if admin user already exists
    const existingAdmin = await User.findOne({
      where: {
        email: 'admin@example.com'
      }
    });

    if (existingAdmin) {
      console.log('Admin user already exists!');
      console.log('Email: admin@example.com');
      console.log('Password: admin123');
      console.log('Phone: +211900000000');
      return;
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash('admin123', saltRounds);

    // Create admin user
    const adminUser = await User.create({
      name: 'Admin',
      email: 'admin@example.com',
      phone: '+211900000000',
      password: hashedPassword,
      balance: 0,
      role: 'admin',
      isVerified: true,
      theme: 'light'
    });

    console.log('✅ Admin user created successfully!');
    console.log('Email: admin@example.com');
    console.log('Password: admin123');
    console.log('Phone: +211900000000');
    console.log('Balance: 0');

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: adminUser.id,
        role: adminUser.role
      },
      process.env.JWT_SECRET || 'your_jwt_secret_key',
      { expiresIn: '7d' }
    );

    console.log('\n🔑 Admin JWT Token for Postman:');
    console.log(token);
    console.log('\n📋 Copy this token for Authorization header:');
    console.log('Authorization: Bearer ' + token);

  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await sequelize.close();
  }
}

createAdminUser();