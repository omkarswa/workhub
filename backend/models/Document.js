import mongoose from 'mongoose';
const { Schema } = mongoose;

// Subdocument for sharedWith array
const sharedWithSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  permission: {
    type: String,
    enum: ['view', 'comment', 'edit'],
    default: 'view'
  },
  sharedAt: {
    type: Date,
    default: Date.now
  },
  sharedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { _id: false });

const documentSchema = new Schema({
  // Reference to the file in GridFS
  fileId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  
  // Original filename
  filename: {
    type: String,
    required: [true, 'Please provide a filename'],
    trim: true
  },
  
  // File metadata
  mimetype: {
    type: String,
    required: true
  },
  
  size: {
    type: Number,
    required: true
  },
  
  // Document classification
  documentType: {
    type: String,
    enum: [
      'contract', 'resume', 'id_proof', 'address_proof', 'certificate',
      'offer_letter', 'nda', 'policy', 'report', 'presentation', 'other'
    ],
    default: 'other'
  },
  
  // Description and metadata
  description: {
    type: String,
    maxlength: [1000, 'Description cannot be more than 1000 characters'],
    trim: true
  },
  
  // Access control
  isPublic: {
    type: Boolean,
    default: false
  },
  
  // References
  uploadedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  department: {
    type: String,
    required: true
  },
  
  // Sharing
  sharedWith: [sharedWithSchema],
  
  // Audit fields
  isDeleted: {
    type: Boolean,
    default: false
  },
  
  deletedAt: Date,
  
  deletedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Versioning
  version: {
    type: Number,
    default: 1
  },
  
  // Tags for better searchability
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
documentSchema.index({ filename: 'text', description: 'text', tags: 'text' });
documentSchema.index({ uploadedBy: 1, isDeleted: 1 });
documentSchema.index({ documentType: 1, isDeleted: 1 });
documentSchema.index({ 'sharedWith.user': 1, isDeleted: 1 });

// Virtual for file URL
documentSchema.virtual('url').get(function() {
  return `/api/v1/documents/download/${this._id}`;
});

// Virtual for thumbnail URL (if you implement thumbnails in the future)
documentSchema.virtual('thumbnailUrl').get(function() {
  if (this.mimetype.startsWith('image/')) {
    return `/api/v1/documents/thumbnail/${this._id}`;
  }
  return null;
});

// Static method to get document types
documentSchema.statics.getDocumentTypes = function() {
  return [
    'contract', 'resume', 'id_proof', 'address_proof', 'certificate',
    'offer_letter', 'nda', 'policy', 'report', 'presentation', 'other'
  ];
};

// Method to check if a user has permission on this document
documentSchema.methods.hasPermission = function(userId, requiredPermission = 'view') {
  // Document owner has all permissions
  if (this.uploadedBy.toString() === userId.toString()) {
    return true;
  }
  
  // Check shared permissions
  const share = this.sharedWith.find(s => s.user.toString() === userId.toString());
  if (!share) return false;
  
  // Check permission hierarchy
  const permissions = ['view', 'comment', 'edit'];
  const userPermissionLevel = permissions.indexOf(share.permission);
  const requiredPermissionLevel = permissions.indexOf(requiredPermission);
  
  return userPermissionLevel >= requiredPermissionLevel;
};

// Pre-save hook to update version
documentSchema.pre('save', function(next) {
  if (this.isModified()) {
    this.version += 1;
  }
  next();
});

// Soft delete hook
documentSchema.pre('find', function() {
  this.where({ isDeleted: { $ne: true } });
});

// Export the model
const Document = mongoose.model('Document', documentSchema);
export default Document;