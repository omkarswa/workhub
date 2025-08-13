import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  // Authentication
  email: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true
  },
  password: { 
    type: String, 
    required: true,
    minlength: 8,
    select: false
  },
  
  // Personal Information
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  dateOfBirth: Date,
  phone: String,
  
  // Employment Details
  employeeId: { 
    type: String, 
    unique: true,
    sparse: true
  },
  department: {
    type: String,
    enum: ['Engineering', 'HR', 'Management', 'Operations', 'Finance', 'Other'],
    required: true
  },
  position: { type: String, required: true },
  joiningDate: { 
    type: Date, 
    required: true,
    default: Date.now
  },
  salary: {
    base: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    paymentFrequency: { type: String, default: 'monthly', enum: ['weekly', 'bi-weekly', 'monthly'] }
  },
  
  // Role and Permissions
  role: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Role',
    required: true
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'onboarding', 'suspended', 'terminated'],
    default: 'onboarding'
  },
  
  // Manager reference
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Documents
  documents: [{
    type: { 
      type: String,
      enum: ['id_proof', 'address_proof', 'qualification', 'experience', 'other']
    },
    name: String,
    fileId: mongoose.Schema.Types.ObjectId, // Reference to GridFS file
    status: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending'
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    verifiedAt: Date,
    rejectionReason: String
  }],
  
  // Warnings and Performance
  warnings: [{
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: String,
    severity: { type: String, enum: ['low', 'medium', 'high'] },
    dateIssued: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    resolvedAt: Date
  }],
  
  // Appraisals
  lastAppraisal: Date,
  nextAppraisal: Date,
  
  // System
  lastLogin: Date,
  loginAttempts: { type: Number, default: 0 },
  accountLocked: { type: Boolean, default: false },
  accountLockedUntil: Date,
  
  // Soft delete
  isDeleted: { type: Boolean, default: false },
  deletedAt: Date
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`.trim();
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to check if user has a specific permission
userSchema.methods.hasPermission = async function(permissionName) {
  const user = await this.populate({
    path: 'role',
    populate: {
      path: 'permissions',
      model: 'Permission'
    }
  });
  
  if (!user.role) return false;
  
  // Admins have all permissions
  if (user.role.name === 'admin') return true;
  
  // Check if role has the permission
  return user.role.permissions.some(p => p.name === permissionName);
};

// Method to check if user has a specific role
userSchema.methods.hasRole = function(roleName) {
  return this.role && this.role.name === roleName;
};

// Add text index for search
userSchema.index({ 
  firstName: 'text', 
  lastName: 'text', 
  email: 'text',
  employeeId: 'text',
  department: 'text',
  position: 'text'
});

// Soft delete method
userSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

// Query helper for active users
userSchema.query.active = function() {
  return this.where({ isDeleted: false });
};

const User = mongoose.model('User', userSchema);
export default User;
