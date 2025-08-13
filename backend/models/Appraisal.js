import mongoose from 'mongoose';
import { ErrorResponse } from '../utils/errorResponse.js';

const goalSchema = new mongoose.Schema({
  goal: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Goal',
    required: true
  },
  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'completed', 'exceeded'],
    default: 'not_started'
  },
  comments: String,
  reviewerComments: String,
  weightage: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },
  employeeComments: String
}, { _id: false });

const appraisalSchema = new mongoose.Schema({
  // Employee being appraised
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Please provide an employee']
  },
  
  // Manager/HR conducting the appraisal
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Please provide a reviewer']
  },
  
  // Appraisal details
  appraisalDate: {
    type: Date,
    required: [true, 'Please provide an appraisal date'],
    default: Date.now
  },
  
  dueDate: {
    type: Date,
    required: [true, 'Please provide a due date']
  },
  
  // Appraisal cycle (e.g., 'Q1 2023', 'Annual 2023')
  cycle: {
    type: String,
    required: [true, 'Please provide an appraisal cycle'],
    trim: true
  },
  
  // Overall status of the appraisal
  status: {
    type: String,
    enum: ['draft', 'in_progress', 'needs_review', 'completed', 'cancelled'],
    default: 'draft'
  },
  
  // Self-assessment by the employee
  selfAssessment: {
    type: String,
    trim: true
  },
  
  // Review and rating by the manager/HR
  review: {
    type: String,
    trim: true
  },
  
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  
  // Overall comments and final rating
  overallComments: {
    type: String,
    trim: true
  },
  
  // Goals and objectives for this appraisal period
  goals: [goalSchema],
  
  // Key performance indicators (KPIs)
  kpis: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    target: {
      type: Number,
      required: true
    },
    actual: Number,
    weightage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    comments: String
  }],
  
  // Competencies and skills assessment
  competencies: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true
    },
    comments: String
  }],
  
  // Development needs and training
  developmentNeeds: [{
    area: {
      type: String,
      required: true,
      trim: true
    },
    actionPlan: String,
    targetDate: Date,
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'completed'],
      default: 'not_started'
    }
  }],
  
  // Career aspirations and growth opportunities
  careerAspirations: {
    type: String,
    trim: true
  },
  
  // Timeline tracking
  selfAssessmentDate: Date,
  reviewDate: Date,
  completedAt: Date,
  
  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
appraisalSchema.index({ employee: 1, appraisalDate: 1 });
appraisalSchema.index({ reviewer: 1, status: 1 });
appraisalSchema.index({ dueDate: 1 });

// Virtual for appraisal duration in days
appraisalSchema.virtual('durationDays').get(function() {
  if (!this.appraisalDate || !this.completedAt) return null;
  const diffTime = Math.abs(this.completedAt - this.appraisalDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for days remaining until due date
appraisalSchema.virtual('daysRemaining').get(function() {
  if (!this.dueDate) return null;
  const today = new Date();
  const due = new Date(this.dueDate);
  const diffTime = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  return diffTime > 0 ? diffTime : 0;
});

// Virtual for overdue status
appraisalSchema.virtual('isOverdue').get(function() {
  if (this.status === 'completed' || this.status === 'cancelled') return false;
  if (!this.dueDate) return false;
  const today = new Date();
  const due = new Date(this.dueDate);
  return today > due;
});

// Middleware to update timestamps
appraisalSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Soft delete middleware
appraisalSchema.pre('find', function() {
  this.where({ isDeleted: { $ne: true } });
});

// Method to check if a user can view this appraisal
appraisalSchema.methods.canView = function(userId, userRole) {
  if (userRole === 'admin' || userRole === 'hr') return true;
  return this.employee.toString() === userId.toString() || 
         this.reviewer.toString() === userId.toString();
};

// Method to check if a user can edit this appraisal
appraisalSchema.methods.canEdit = function(userId, userRole) {
  if (userRole === 'admin' || userRole === 'hr') return true;
  if (this.status === 'completed' || this.status === 'cancelled') return false;
  
  // Employee can only edit their self-assessment when status is draft or in_progress
  if (this.employee.toString() === userId.toString()) {
    return ['draft', 'in_progress'].includes(this.status);
  }
  
  // Reviewer can edit when they are the assigned reviewer
  return this.reviewer.toString() === userId.toString();
};

// Method to calculate overall rating based on goals and KPIs
appraisalSchema.methods.calculateOverallRating = function() {
  // If manual rating is set, use that
  if (this.rating) return this.rating;
  
  // Calculate weighted average of goal ratings
  let totalWeight = 0;
  let weightedSum = 0;
  
  // Calculate from goals
  if (this.goals && this.goals.length > 0) {
    this.goals.forEach(goal => {
      if (goal.rating && goal.weightage) {
        weightedSum += goal.rating * (goal.weightage / 100);
        totalWeight += goal.weightage;
      }
    });
  }
  
  // Calculate from KPIs if no goals or partial weight
  if (totalWeight < 100 && this.kpis && this.kpis.length > 0) {
    const remainingWeight = 100 - totalWeight;
    const kpiWeight = remainingWeight / this.kpis.length;
    
    this.kpis.forEach(kpi => {
      if (kpi.actual && kpi.target) {
        const kpiRating = (kpi.actual / kpi.target) * 5; // Scale to 1-5
        weightedSum += Math.min(kpiRating, 5) * (kpiWeight / 100);
      }
    });
  }
  
  // If we have some ratings, return the weighted average
  if (weightedSum > 0) {
    return parseFloat(weightedSum.toFixed(2));
  }
  
  return null; // No ratings available
};

// Static method to get appraisals due for review
appraisalSchema.statics.getDueForReview = async function(daysBefore = 7) {
  const today = new Date();
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + daysBefore);
  
  return this.find({
    dueDate: { $lte: dueDate },
    status: { $nin: ['completed', 'cancelled'] },
    'notifications.reviewReminderSent': { $ne: true }
  }).populate('employee reviewer', 'firstName lastName email');
};

// Static method to get overdue appraisals
appraisalSchema.statics.getOverdue = async function() {
  return this.find({
    dueDate: { $lt: new Date() },
    status: { $nin: ['completed', 'cancelled'] },
    'notifications.overdueNotificationSent': { $ne: true }
  }).populate('employee reviewer', 'firstName lastName email');
};

// Export the model
const Appraisal = mongoose.model('Appraisal', appraisalSchema);
export default Appraisal;