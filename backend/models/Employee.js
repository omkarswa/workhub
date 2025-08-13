import mongoose from 'mongoose';
const { Schema } = mongoose;

// Subdocument for emergency contacts
const emergencyContactSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name for emergency contact'],
    trim: true
  },
  relationship: {
    type: String,
    required: [true, 'Please specify relationship with employee'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Please provide a phone number'],
    match: [/^[0-9]{10}$/, 'Please provide a valid 10-digit phone number']
  },
  email: {
    type: String,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
  },
  address: {
    type: String,
    trim: true
  }
}, { _id: false });

// Subdocument for education
const educationSchema = new Schema({
  degree: {
    type: String,
    required: [true, 'Please provide a degree'],
    trim: true
  },
  institution: {
    type: String,
    required: [true, 'Please provide an institution name'],
    trim: true
  },
  fieldOfStudy: {
    type: String,
    trim: true
  },
  startDate: {
    type: Date,
    required: [true, 'Please provide a start date']
  },
  endDate: Date,
  isCurrent: {
    type: Boolean,
    default: false
  },
  description: {
    type: String,
    trim: true
  }
}, { _id: false });

// Subdocument for work experience
const workExperienceSchema = new Schema({
  company: {
    type: String,
    required: [true, 'Please provide a company name'],
    trim: true
  },
  position: {
    type: String,
    required: [true, 'Please provide a position title'],
    trim: true
  },
  startDate: {
    type: Date,
    required: [true, 'Please provide a start date']
  },
  endDate: Date,
  isCurrent: {
    type: Boolean,
    default: false
  },
  responsibilities: [String],
  achievements: [String]
}, { _id: false });

const employeeSchema = new Schema({
  // Personal Information
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required'],
    unique: true
  },
  
  // Personal Details
  dateOfBirth: {
    type: Date,
    required: [true, 'Please provide date of birth']
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer_not_to_say'],
    required: [true, 'Please specify gender']
  },
  maritalStatus: {
    type: String,
    enum: ['single', 'married', 'divorced', 'widowed', 'separated'],
    default: 'single'
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', null],
    default: null
  },
  
  // Contact Information
  phoneNumber: {
    type: String,
    required: [true, 'Please provide a phone number'],
    match: [/^[0-9]{10}$/, 'Please provide a valid 10-digit phone number']
  },
  emergencyContacts: [emergencyContactSchema],
  
  // Address Information
  currentAddress: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    country: { type: String, trim: true }
  },
  permanentAddress: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    country: { type: String, trim: true }
  },
  sameAsCurrentAddress: {
    type: Boolean,
    default: false
  },
  
  // Professional Information
  employeeId: {
    type: String,
    required: [true, 'Employee ID is required'],
    unique: true,
    trim: true
  },
  department: {
    type: String,
    required: [true, 'Please specify department'],
    trim: true
  },
  designation: {
    type: String,
    required: [true, 'Please specify designation'],
    trim: true
  },
  employmentType: {
    type: String,
    enum: ['full-time', 'part-time', 'contract', 'internship', 'temporary'],
    default: 'full-time'
  },
  joiningDate: {
    type: Date,
    required: [true, 'Please provide joining date']
  },
  terminationDate: Date,
  manager: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Bank & Tax Information
  bankDetails: {
    accountNumber: { type: String, trim: true },
    accountHolderName: { type: String, trim: true },
    bankName: { type: String, trim: true },
    branch: { type: String, trim: true },
    ifscCode: { type: String, trim: true },
    panNumber: { type: String, trim: true },
    aadhaarNumber: { type: String, trim: true }
  },
  
  // Documents
  documents: [{
    type: Schema.Types.ObjectId,
    ref: 'Document'
  }],
  
  // Education & Experience
  education: [educationSchema],
  workExperience: [workExperienceSchema],
  skills: [{
    name: { type: String, trim: true },
    level: { type: Number, min: 1, max: 5 },
    isPrimary: { type: Boolean, default: false }
  }],
  
  // Status & Flags
  status: {
    type: String,
    enum: ['active', 'on_leave', 'inactive', 'terminated'],
    default: 'active'
  },
  isProbation: {
    type: Boolean,
    default: true
  },
  probationEndDate: Date,
  lastWorkingDay: Date,
  
  // System Fields
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  deletedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
employeeSchema.index({ department: 1, status: 1 });
employeeSchema.index({ 'user.email': 1 });
employeeSchema.index({ 'user.firstName': 'text', 'user.lastName': 'text' });

// Virtual for full name
employeeSchema.virtual('fullName').get(function() {
  return `${this.user?.firstName} ${this.user?.lastName}`.trim();
});

// Virtual for employee tenure in years
employeeSchema.virtual('tenure').get(function() {
  if (!this.joiningDate) return 0;
  const today = new Date();
  const joinDate = new Date(this.joiningDate);
  return (today.getFullYear() - joinDate.getFullYear()) + 
         (today.getMonth() - joinDate.getMonth()) / 12;
});

// Pre-save hook to handle permanent address
employeeSchema.pre('save', function(next) {
  if (this.sameAsCurrentAddress && this.currentAddress) {
    this.permanentAddress = { ...this.currentAddress };
  }
  next();
});

// Soft delete middleware
employeeSchema.pre('find', function() {
  this.where({ isDeleted: { $ne: true } });
});

// Static method to get employee by employee ID
employeeSchema.statics.findByEmployeeId = async function(employeeId) {
  return this.findOne({ employeeId }).populate('user', 'firstName lastName email');
};

// Method to check if employee is on leave
employeeSchema.methods.isOnLeave = function() {
  return this.status === 'on_leave';
};

// Method to terminate employee
employeeSchema.methods.terminate = async function(terminationData, userId) {
  this.status = 'terminated';
  this.terminationDate = terminationData.terminationDate || new Date();
  this.lastWorkingDay = terminationData.lastWorkingDay;
  this.updatedBy = userId;
  
  // Add to employment history
  this.employmentHistory = this.employmentHistory || [];
  this.employmentHistory.push({
    status: 'terminated',
    date: new Date(),
    reason: terminationData.reason,
    notes: terminationData.notes,
    changedBy: userId
  });
  
  return this.save();
};

// Method to update employee status
employeeSchema.methods.updateStatus = async function(newStatus, userId, notes = '') {
  const previousStatus = this.status;
  this.status = newStatus;
  this.updatedBy = userId;
  
  // Update probation status if needed
  if (newStatus === 'active' && this.isProbation && this.probationEndDate <= new Date()) {
    this.isProbation = false;
  }
  
  // Add to employment history
  this.employmentHistory = this.employmentHistory || [];
  this.employmentHistory.push({
    fromStatus: previousStatus,
    toStatus: newStatus,
    date: new Date(),
    notes,
    changedBy: userId
  });
  
  return this.save();
};

const Employee = mongoose.model('Employee', employeeSchema);
export default Employee;