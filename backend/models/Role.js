import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    unique: true,
    enum: ['admin', 'manager', 'hr', 'employee']
  },
  description: { type: String, required: true },
  permissions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Permission',
    required: true
  }],
  isDefault: { type: Boolean, default: false }
}, { timestamps: true });

// Pre-save hook to ensure only one default role per role name
roleSchema.pre('save', async function(next) {
  if (this.isModified('isDefault') && this.isDefault) {
    await this.constructor.updateMany(
      { name: this.name, _id: { $ne: this._id } },
      { $set: { isDefault: false } }
    );
  }
  next();
});

// Static method to get default role by name
roleSchema.statics.getDefaultRole = async function(roleName) {
  return this.findOne({ name: roleName, isDefault: true });
};

// Method to check if role has specific permission
roleSchema.methods.hasPermission = async function(permissionName) {
  const role = await this.populate('permissions');
  return role.permissions.some(permission => permission.name === permissionName);
};

const Role = mongoose.model('Role', roleSchema);
export default Role;
