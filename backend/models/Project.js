import mongoose from 'mongoose';
import { ErrorResponse } from '../utils/errorResponse.js';

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a project name'],
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Please add a description'],
    maxlength: [2000, 'Description cannot be more than 2000 characters']
  },
  status: {
    type: String,
    enum: ['planning', 'in_progress', 'on_hold', 'completed', 'cancelled'],
    default: 'planning'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  startDate: {
    type: Date,
    required: [true, 'Please add a start date']
  },
  endDate: {
    type: Date,
    validate: {
      validator: function(value) {
        // End date must be after start date
        return !this.startDate || value > this.startDate;
      },
      message: 'End date must be after start date'
    }
  },
  budget: {
    type: Number,
    min: [0, 'Budget cannot be negative']
  },
  client: {
    type: String,
    trim: true
  },
  // Project manager/lead
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Please assign a project manager']
  },
  // Team members assigned to the project
  team: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      required: true,
      enum: ['developer', 'designer', 'tester', 'analyst', 'other']
    },
    allocation: {
      type: Number,
      min: 0,
      max: 100,
      default: 100,
      validate: {
        validator: function(v) {
          return v > 0 && v <= 100;
        },
        message: 'Allocation must be between 1 and 100'
      }
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  // Project tasks/milestones
  tasks: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: String,
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'review', 'completed', 'blocked'],
      default: 'not_started'
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    dueDate: Date,
    assignedTo: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    completedAt: Date,
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Project documents and files (references to GridFS)
  documents: [{
    name: String,
    fileId: mongoose.Schema.Types.ObjectId,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    description: String
  }],
  // Project discussions/comments
  discussions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    message: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    replies: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      message: {
        type: String,
        required: true
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }]
  }],
  // Project settings and metadata
  settings: {
    isPublic: {
      type: Boolean,
      default: false
    },
    allowTeamChat: {
      type: Boolean,
      default: true
    },
    notifyOnUpdate: {
      type: Boolean,
      default: true
    }
  },
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

// Add text index for search
projectSchema.index({
  name: 'text',
  description: 'text',
  client: 'text'
});

// Virtual for project duration in days
projectSchema.virtual('durationDays').get(function() {
  if (!this.startDate || !this.endDate) return null;
  const diffTime = Math.abs(this.endDate - this.startDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for project progress based on tasks
projectSchema.virtual('progress').get(function() {
  if (!this.tasks || this.tasks.length === 0) return 0;
  
  const completedTasks = this.tasks.filter(task => task.status === 'completed').length;
  return Math.round((completedTasks / this.tasks.length) * 100);
});

// Method to check if a user is part of the project team
projectSchema.methods.isTeamMember = function(userId) {
  return this.team.some(member => 
    member.user.toString() === userId.toString() && member.isActive
  );
};

// Method to get active team members
projectSchema.methods.getActiveTeamMembers = function() {
  return this.team.filter(member => member.isActive);
};

// Method to add a team member
projectSchema.methods.addTeamMember = async function(userId, role, allocation) {
  // Check if user is already a team member
  const existingMember = this.team.find(member => 
    member.user.toString() === userId.toString()
  );

  if (existingMember) {
    if (existingMember.isActive) {
      throw new ErrorResponse('User is already a team member', 400);
    }
    // Reactivate existing member
    existingMember.isActive = true;
    existingMember.startDate = new Date();
    existingMember.role = role;
    existingMember.allocation = allocation;
  } else {
    // Add new team member
    this.team.push({
      user: userId,
      role,
      allocation,
      startDate: new Date(),
      isActive: true
    });
  }

  await this.save();
  return this;
};

// Method to remove a team member
projectSchema.methods.removeTeamMember = async function(userId) {
  const memberIndex = this.team.findIndex(
    member => member.user.toString() === userId.toString() && member.isActive
  );

  if (memberIndex === -1) {
    throw new ErrorResponse('User is not an active team member', 400);
  }

  // Soft remove by setting isActive to false
  this.team[memberIndex].isActive = false;
  this.team[memberIndex].endDate = new Date();
  
  await this.save();
  return this;
};

// Middleware to update timestamps
projectSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Soft delete middleware
projectSchema.pre('find', function() {
  this.where({ isDeleted: { $ne: true } });
});

// Export the model
const Project = mongoose.model('Project', projectSchema);
export default Project;