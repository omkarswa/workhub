const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    unique: true,
    enum: [
      'manage_all',
      'manage_employees',
      'manage_projects',
      'verify_documents',
      'issue_warnings',
      'terminate_employees',
      'appraise_employees'
    ]
  },
  description: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Permission', permissionSchema);
