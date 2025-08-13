const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const { connectDB } = require('../config/db');
const User = require('../models/User');
const Role = require('../models/Role');
const { ErrorResponse } = require('../utils/errorResponse');

// Load environment variables
dotenv.config({ path: './config/config.env' });

// Create admin user
const createAdminUser = async () => {
  try {
    console.log('🚀 Starting admin user creation...');
    
    // Connect to the database
    await connectDB();
    
    // Check if admin role exists
    const adminRole = await Role.findOne({ name: 'admin' });
    
    if (!adminRole) {
      throw new ErrorResponse('Admin role not found. Please run the initRolesAndPermissions script first.', 404);
    }
    
    // Check if admin user already exists
    const existingAdmin = await User.findOne({ email: process.env.ADMIN_EMAIL });
    
    if (existingAdmin) {
      console.log('ℹ️ Admin user already exists. Updating to ensure admin role...');
      
      // Update existing user to ensure they have admin role
      existingAdmin.role = adminRole._id;
      existingAdmin.status = 'active';
      existingAdmin.isAdmin = true;
      
      // Update password if provided
      if (process.env.ADMIN_PASSWORD) {
        const salt = await bcrypt.genSalt(10);
        existingAdmin.password = await bcrypt.hash(process.env.ADMIN_PASSWORD, salt);
      }
      
      await existingAdmin.save();
      console.log('✅ Admin user updated successfully');
      console.log(`👤 Email: ${existingAdmin.email}`);
      
      process.exit(0);
    }
    
    // Create new admin user
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
      throw new ErrorResponse('ADMIN_EMAIL and ADMIN_PASSWORD must be provided in .env', 400);
    }
    
    const adminUser = new User({
      firstName: 'Admin',
      lastName: 'User',
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      role: adminRole._id,
      department: 'Management',
      position: 'System Administrator',
      status: 'active',
      isAdmin: true,
      joiningDate: new Date()
    });
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    adminUser.password = await bcrypt.hash(adminUser.password, salt);
    
    await adminUser.save();
    
    console.log('✅ Admin user created successfully');
    console.log(`👤 Email: ${adminUser.email}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    if (error.errors) {
      console.error('Validation errors:', error.errors);
    }
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

// Run the script
createAdminUser();
