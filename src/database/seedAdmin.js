const mongoose = require('mongoose');
const dotenv = require('dotenv');
const AdminUser = require('../models/AdminUser');
const logger = require('../utils/logger');

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URI);
    console.log('✅ MongoDB Connected for seeding');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
};

const seedAdminUser = async () => {
  try {
    await connectDB();

    // Check if admin already exists
    const existingAdmin = await AdminUser.findOne({ email: 'admin@soloai.com' });
    
    if (existingAdmin) {
      console.log('❌ Admin user already exists');
      console.log('📧 Email:', existingAdmin.email);
      console.log('👤 Name:', existingAdmin.name);
      console.log('🔑 Role:', existingAdmin.role);
      process.exit(0);
    }

    // Create superadmin
    const admin = await AdminUser.create({
      name: 'Super Admin',
      email: 'admin@soloai.com',
      password: 'Admin@123456', // CHANGE THIS IN PRODUCTION
      role: 'superadmin',
      permissions: ['users', 'media', 'videos', 'posts', 'analytics', 'settings', 'socialaccounts'],
      isActive: true
    });

    console.log('\n🎉 Super Admin created successfully!\n');
    console.log('═══════════════════════════════════════');
    console.log('📧 Email:    admin@soloai.com');
    console.log('🔑 Password: Admin@123456');
    console.log('👤 Role:     superadmin');
    console.log('═══════════════════════════════════════');
    console.log('\n⚠️  IMPORTANT: Please change the password after first login!\n');
    console.log('You can now login at: /api/v1/admin/login\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding admin:', error.message);
    process.exit(1);
  }
};

seedAdminUser();
