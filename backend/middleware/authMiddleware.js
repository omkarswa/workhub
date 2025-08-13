import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { ErrorResponse } from '../utils/errorResponse.js';

// Protect routes - verify JWT
const protect = async (req, res, next) => {
  let token;
  
  // Get token from header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  // Get token from cookie
  else if (req.cookies.token) {
    token = req.cookies.token;
  }

  // Make sure token exists
  if (!token) {
    return next(new ErrorResponse('Not authorized to access this route', 401));
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from the token
    req.user = await User.findById(decoded.id).select('-password');
    
    if (!req.user) {
      return next(new ErrorResponse('User not found with this token', 404));
    }
    
    // Check if user account is active
    if (req.user.status === 'suspended') {
      return next(new ErrorResponse('User account is suspended', 401));
    }
    
    if (req.user.status === 'terminated') {
      return next(new ErrorResponse('User account is terminated', 401));
    }
    
    // Update last login time
    req.user.lastLogin = Date.now();
    await req.user.save({ validateBeforeSave: false });
    
    next();
  } catch (err) {
    return next(new ErrorResponse('Not authorized to access this route', 401));
  }
};

// Grant access to specific roles
const authorize = (...roles) => {
  return async (req, res, next) => {
    try {
      // Get user with populated role
      const user = await User.findById(req.user._id).populate('role');
      
      if (!user) {
        return next(new ErrorResponse('User not found', 404));
      }
      
      // Check if user's role is authorized
      if (!roles.includes(user.role.name)) {
        return next(
          new ErrorResponse(
            `User role ${user.role.name} is not authorized to access this route`,
            403
          )
        );
      }
      
      next();
    } catch (error) {
      return next(new ErrorResponse('Authorization failed', 500));
    }
  };
};

// Check if user has specific permission
const hasPermission = (permission) => {
  return async (req, res, next) => {
    try {
      // Get user with populated role and permissions
      const user = await User.findById(req.user._id)
        .populate({
          path: 'role',
          populate: {
            path: 'permissions',
            model: 'Permission'
          }
        });
      
      if (!user) {
        return next(new ErrorResponse('User not found', 404));
      }
      
      // Admins have all permissions
      if (user.role.name === 'admin') {
        return next();
      }
      
      // Check if role has the required permission
      const hasPermission = user.role.permissions.some(
        p => p.name === permission
      );
      
      if (!hasPermission) {
        return next(
          new ErrorResponse(
            `Not authorized to ${permission.replace('_', ' ')}`,
            403
          )
        );
      }
      
      next();
    } catch (error) {
      return next(new ErrorResponse('Permission check failed', 500));
    }
  };
};

// Check if user is the resource owner or has admin role
const isOwnerOrAdmin = (model, paramName = 'id') => {
  return async (req, res, next) => {
    try {
      const resource = await model.findById(req.params[paramName]);
      
      if (!resource) {
        return next(new ErrorResponse('Resource not found', 404));
      }
      
      // Check if user is admin
      const user = await User.findById(req.user._id).populate('role');
      if (user.role.name === 'admin') {
        return next();
      }
      
      // Check if user is the owner
      if (resource.user && resource.user.toString() !== req.user.id) {
        return next(
          new ErrorResponse('Not authorized to access this resource', 403)
        );
      }
      
      next();
    } catch (error) {
      return next(new ErrorResponse('Authorization check failed', 500));
    }
  };
};

export { protect, authorize, hasPermission, isOwnerOrAdmin };