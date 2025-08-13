import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Role from '../models/Role.js';

export const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, roleName, department, position, joiningDate } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'User already exists' });

    // Resolve role: accept role ObjectId or role name; default to 'employee'
    let roleId = role;
    try {
      if (!roleId) {
        const byName = roleName || 'employee';
        const roleDoc = await Role.findOne({ name: byName });
        if (!roleDoc) return res.status(400).json({ message: `Role not found: ${byName}` });
        roleId = roleDoc._id;
      } else if (typeof roleId === 'string' && !/^[a-f\d]{24}$/i.test(roleId)) {
        // If role passed is a name instead of ObjectId
        const roleDoc = await Role.findOne({ name: roleId });
        if (!roleDoc) return res.status(400).json({ message: `Role not found: ${roleId}` });
        roleId = roleDoc._id;
      }
    } catch (e) {
      return res.status(500).json({ message: 'Failed to resolve role' });
    }

    // User model pre-save hook will hash password
    const user = await User.create({ firstName, lastName, email, password, role: roleId, department, position, joiningDate });

    return res.status(201).json({ message: 'User registered', user: { id: user._id, email: user.email } });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Optionally update lastLogin
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    return res.json({ token, role: user.role });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export default { register, login };
