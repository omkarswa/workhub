const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Permission = require('../models/Permission');
const Role = require('../models/Role');
const { connectDB } = require('../config/db');

// Load env vars
dotenv.config({ path: './config/config.env' });

// Define permissions
const permissions = [
  // Admin permissions
  { name: 'manage_all', description: 'Full access to all features' },
  
  // Employee management
  { name: 'manage_employees', description: 'Manage employee records' },
  { name: 'view_employees', description: 'View employee information' },
  
  // Project management
  { name: 'manage_projects', description: 'Create, edit, and delete projects' },
  { name: 'view_projects', description: 'View project information' },
  
  // Document management
  { name: 'verify_documents', description: 'Verify employee documents' },
  { name: 'upload_documents', description: 'Upload documents' },
  { name: 'view_documents', description: 'View documents' },
  
  // Warnings and termination
  { name: 'issue_warnings', description: 'Issue warnings to employees' },
  { name: 'terminate_employees', description: 'Terminate employee accounts' },
  
  // Appraisal
  { name: 'appraise_employees', description: 'Perform employee appraisals' },
  { name: 'view_appraisals', description: 'View employee appraisals' },
  
  // Reports
  { name: 'view_reports', description: 'View system reports' },
  { name: 'export_reports', description: 'Export reports' },
];

// Define roles with their permissions
const roles = [
  {
    name: 'admin',
    description: 'System administrator with full access',
    permissions: [
      'manage_all',
      'manage_employees',
      'view_employees',
      'manage_projects',
      'view_projects',
      'verify_documents',
      'upload_documents',
      'view_documents',
      'issue_warnings',
      'terminate_employees',
      'appraise_employees',
      'view_appraisals',
      'view_reports',
      'export_reports'
    ],
    isDefault: true
  },
  {
    name: 'manager',
    description: 'Department manager with team management access',
    permissions: [
      'view_employees',
      'manage_projects',
      'view_projects',
      'view_documents',
      'issue_warnings',
      'appraise_employees',
      'view_appraisals',
      'view_reports'
    ],
    isDefault: true
  },
  {
    name: 'hr',
    description: 'Human resources personnel',
    permissions: [
      'view_employees',
      'verify_documents',
      'view_documents',
      'issue_warnings',
      'view_appraisals',
      'view_reports'
    ],
    isDefault: true
  },
  {
    name: 'employee',
    description: 'Regular employee with basic access',
    permissions: [
      'view_projects',
      'upload_documents',
      'view_documents',
      'view_appraisals'
    ],
    isDefault: true
  }
];

// Connect to DB
connectDB();

const initDB = async () => {
  try {
    // Clear existing data (for development only)
    await Permission.deleteMany({});
    await Role.deleteMany({});
    
    console.log('Database cleared');
    
    // Create permissions
    const createdPermissions = await Permission.insertMany(permissions);
    console.log('Permissions created');
    
    // Map permission names to their IDs
    const permissionMap = createdPermissions.reduce((map, permission) => {
      map[permission.name] = permission._id;
      return map;
    }, {});
    
    // Create roles with permission references
    const rolePromises = roles.map(async (role) => {
      const permissionIds = role.permissions.map(name => permissionMap[name]);
      
      await Role.findOneAndUpdate(
        { name: role.name },
        {
          name: role.name,
          description: role.description,
          permissions: permissionIds,
          isDefault: role.isDefault
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    });
    
    await Promise.all(rolePromises);
    console.log('Roles created with permissions');
    
    console.log('Database initialized successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error initializing database:', err);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

// Run the initialization
initDB();
