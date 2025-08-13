import mongoose from 'mongoose';
const { Schema } = mongoose;

const warningSchema = new Schema({
  // Employee reference
  employee: {
    type: Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'Employee reference is required']
  },
  
  // Warning details
  type: {
    type: String,
    required: [true, 'Warning type is required'],
    trim: true
  },
  
  title: {
    type: String,
    required: [true, 'Warning title is required'],
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  
  // Severity and status
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    required: true
  },
  
  status: {
    type: String,
    enum: ['active', 'resolved', 'escalated', 'withdrawn'],
    default: 'active',
    required: true
  },
  
  // Dates
  dateIssued: {
    type: Date,
    default: Date.now,
    required: true
  },
  
  validUntil: {
    type: Date,
    required: [true, 'Valid until date is required'],
    validate: {
      validator: function(value) {
        // Valid until date should be in the future
        return value > this.dateIssued;
      },
      message: 'Valid until date must be in the future'
    }
  },
  
  // Resolution details (if applicable)
  resolvedAt: Date,
  resolutionNotes: String,
  
  // Escalation details (if applicable)
  escalated: {
    type: Boolean,
    default: false
  },
  
  escalationNotes: String,
  escalationDate: Date,
  
  // References to related documents
  relatedDocuments: [{
    type: Schema.Types.ObjectId,
    ref: 'Document'
  }],
  
  // System fields
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

// Indexes for better query performance
warningSchema.index({ employee: 1, status: 1 });
warningSchema.index({ dateIssued: -1 });
warningSchema.index({ severity: 1 });
warningSchema.index({ status: 1 });

// Virtual for warning duration in days
warningSchema.virtual('durationDays').get(function() {
  if (!this.validUntil) return null;
  const diffTime = Math.abs(this.validUntil - this.dateIssued);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for days remaining
warningSchema.virtual('daysRemaining').get(function() {
  if (this.status !== 'active') return 0;
  const now = new Date();
  if (now > this.validUntil) return 0;
  const diffTime = Math.abs(this.validUntil - now);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save hook to handle status updates
warningSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'resolved' && !this.resolvedAt) {
    this.resolvedAt = new Date();
  }
  
  if (this.isModified('escalated') && this.escalated && !this.escalationDate) {
    this.escalationDate = new Date();
  }
  
  next();
});

// Soft delete middleware
warningSchema.pre('find', function() {
  this.where({ isDeleted: { $ne: true } });
});

// Static method to get active warnings for an employee
warningSchema.statics.getActiveWarnings = async function(employeeId) {
  return this.find({ 
    employee: employeeId, 
    status: 'active',
    validUntil: { $gt: new Date() }
  }).sort({ severity: -1, dateIssued: -1 });
};

// Method to resolve a warning
warningSchema.methods.resolve = async function(userId, notes = '') {
  this.status = 'resolved';
  this.resolvedAt = new Date();
  this.resolutionNotes = notes;
  this.updatedBy = userId;
  return this.save();
};

// Method to escalate a warning
warningSchema.methods.escalate = async function(userId, notes = '') {
  this.escalated = true;
  this.escalationDate = new Date();
  this.escalationNotes = notes;
  this.updatedBy = userId;
  return this.save();
};

// Method to withdraw a warning (admin/HR only)
warningSchema.methods.withdraw = async function(userId, reason = '') {
  this.status = 'withdrawn';
  this.resolvedAt = new Date();
  this.resolutionNotes = `Warning withdrawn. Reason: ${reason}`;
  this.updatedBy = userId;
  return this.save();
};

const Warning = mongoose.model('Warning', warningSchema);
export default Warning;