import User from '../models/User.js';
import Role from '../models/Role.js';
import { ErrorResponse } from '../utils/errorResponse.js';
import asyncHandler from '../middleware/async.js';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';

// Initialize GridFS
let gridfsBucket;
const conn = mongoose.connection;
conn.once('open', () => {
  gridfsBucket = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: 'documents'
  });
});

/**
 * @desc    Get all employees
 * @route   GET /api/v1/employees
 * @access  Private/Admin/HR/Manager
 */
export const getEmployees = asyncHandler(async (req, res, next) => {
  // Copy req.query
  const reqQuery = { ...req.query };

  // Fields to exclude
  const removeFields = ['select', 'sort', 'page', 'limit'];
  removeFields.forEach(param => delete reqQuery[param]);

  // Create query string
  let queryStr = JSON.stringify(reqQuery);
  
  // Create operators ($gt, $gte, etc)
  queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

  // Finding resource
  let query = User.find(JSON.parse(queryStr));

  // Select Fields
  if (req.query.select) {
    const fields = req.query.select.split(',').join(' ');
    query = query.select(fields);
  }

  // Sort
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    query = query.sort(sortBy);
  } else {
    query = query.sort('-createdAt');
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 25;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = await User.countDocuments(JSON.parse(queryStr));

  query = query.skip(startIndex).limit(limit);

  // Executing query
  const employees = await query.populate('role', 'name description');

  // Pagination result
  const pagination = {};

  if (endIndex < total) {
    pagination.next = {
      page: page + 1,
      limit
    };
  }

  if (startIndex > 0) {
    pagination.prev = {
      page: page - 1,
      limit
    };
  }

  res.status(200).json({
    success: true,
    count: employees.length,
    pagination,
    data: employees
  });
});

/**
 * @desc    Get single employee
 * @route   GET /api/v1/employees/:id
 * @access  Private/Admin/HR/Manager
 */
export const getEmployee = asyncHandler(async (req, res, next) => {
  const employee = await User.findById(req.params.id)
    .populate('role', 'name description')
    .populate('manager', 'firstName lastName email')
    .populate('documents.verifiedBy', 'firstName lastName');

  if (!employee) {
    return next(
      new ErrorResponse(`Employee not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is employee owner or admin/HR/manager with access
  if (
    employee._id.toString() !== req.user.id && 
    req.user.role.name !== 'admin' && 
    req.user.role.name !== 'hr' &&
    (req.user.role.name === 'manager' && 
     employee.manager && 
     employee.manager.toString() !== req.user.id)
  ) {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to access this employee`,
        401
      )
    );
  }

  res.status(200).json({
    success: true,
    data: employee
  });
});

/**
 * @desc    Get employee documents metadata
 * @route   GET /api/v1/employees/:id/documents
 * @access  Private/Admin/HR/Manager/Employee
 */
export const getEmployeeDocuments = asyncHandler(async (req, res, next) => {
  const employee = await User.findById(req.params.id).select('_id manager role documents');
  if (!employee) {
    return next(new ErrorResponse(`Employee not found with id of ${req.params.id}`, 404));
  }

  const isSelf = employee._id.toString() === req.user._id.toString();
  const isAdminOrHR = ['admin', 'hr'].includes(req.user.role.name);
  const isManager = req.user.role.name === 'manager' && employee.manager && employee.manager.toString() === req.user._id.toString();
  if (!isSelf && !isAdminOrHR && !isManager) {
    return next(new ErrorResponse('Not authorized to view documents', 403));
  }

  // Also fetch GridFS file info for these documents
  const ids = employee.documents.map(d => d.fileId).filter(Boolean);
  let files = [];
  if (ids.length) {
    const cursor = gridfsBucket.find({ _id: { $in: ids } });
    files = await cursor.toArray();
  }

  res.status(200).json({ success: true, count: employee.documents.length, data: employee.documents, files });
});

/**
 * @desc    Get employee warnings
 * @route   GET /api/v1/employees/:id/warnings
 * @access  Private/Admin/HR/Manager/Employee (self)
 */
export const getEmployeeWarnings = asyncHandler(async (req, res, next) => {
  const employee = await User.findById(req.params.id).select('warnings manager');
  if (!employee) {
    return next(new ErrorResponse(`Employee not found with id of ${req.params.id}`, 404));
  }

  const isSelf = req.user._id.toString() === req.params.id;
  const isAdminOrHR = ['admin', 'hr'].includes(req.user.role.name);
  const isManager = req.user.role.name === 'manager' && employee.manager && employee.manager.toString() === req.user._id.toString();
  if (!isSelf && !isAdminOrHR && !isManager) {
    return next(new ErrorResponse('Not authorized to view warnings', 403));
  }

  res.status(200).json({ success: true, count: employee.warnings.length, data: employee.warnings });
});

/**
 * @desc    Update employee status
 * @route   PUT /api/v1/employees/:id/status
 * @access  Private/Admin/HR
 */
export const updateEmployeeStatus = asyncHandler(async (req, res, next) => {
  const { status, effectiveDate, reason } = req.body;
  const allowed = ['active', 'on_leave', 'inactive', 'terminated'];
  if (!allowed.includes(status)) {
    return next(new ErrorResponse('Invalid status', 400));
  }

  const employee = await User.findByIdAndUpdate(
    req.params.id,
    {
      status,
      $push: {
        statusHistory: {
          status,
          effectiveDate: effectiveDate || new Date(),
          reason,
          changedBy: req.user._id
        }
      }
    },
    { new: true, runValidators: true }
  );

  if (!employee) {
    return next(new ErrorResponse(`Employee not found with id of ${req.params.id}`, 404));
  }

  res.status(200).json({ success: true, data: employee });
});

/**
 * @desc    Create new employee
 * @route   POST /api/v1/employees
 * @access  Private/Admin/HR
 */
export const createEmployee = asyncHandler(async (req, res, next) => {
  // Add user to req.body
  req.body.createdBy = req.user.id;
  
  // Set default status to onboarding
  req.body.status = 'onboarding';
  
  // Get employee role if not provided
  if (!req.body.role) {
    const employeeRole = await Role.findOne({ name: 'employee' });
    if (!employeeRole) {
      return next(new ErrorResponse('Default employee role not found', 500));
    }
    req.body.role = employeeRole._id;
  }

  const employee = await User.create(req.body);

  res.status(201).json({
    success: true,
    data: employee
  });
});

/**
 * @desc    Update employee
 * @route   PUT /api/v1/employees/:id
 * @access  Private/Admin/HR/Manager
 */
export const updateEmployee = asyncHandler(async (req, res, next) => {
  let employee = await User.findById(req.params.id);

  if (!employee) {
    return next(
      new ErrorResponse(`Employee not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is employee owner or admin/HR/manager with access
  if (
    employee._id.toString() !== req.user.id && 
    req.user.role.name !== 'admin' && 
    req.user.role.name !== 'hr' &&
    (req.user.role.name === 'manager' && 
     employee.manager && 
     employee.manager.toString() !== req.user.id)
  ) {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to update this employee`,
        401
      )
    );
  }

  // Prevent role changes unless admin
  if (req.body.role && req.user.role.name !== 'admin') {
    return next(
      new ErrorResponse('Not authorized to change user roles', 403)
    );
  }

  // Prevent status changes to 'terminated' unless admin/HR
  if (req.body.status === 'terminated' && 
      req.user.role.name !== 'admin' && 
      req.user.role.name !== 'hr') {
    return next(
      new ErrorResponse('Not authorized to terminate employees', 403)
    );
  }

  employee = await User.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({ success: true, data: employee });
});

/**
 * @desc    Delete employee
 * @route   DELETE /api/v1/employees/:id
 * @access  Private/Admin
 */
export const deleteEmployee = asyncHandler(async (req, res, next) => {
  const employee = await User.findById(req.params.id);

  if (!employee) {
    return next(
      new ErrorResponse(`Employee not found with id of ${req.params.id}`, 404)
    );
  }

  // Only admin can delete users
  if (req.user.role.name !== 'admin') {
    return next(
      new ErrorResponse('Not authorized to delete employees', 403)
    );
  }

  // Soft delete
  employee.isDeleted = true;
  employee.deletedAt = Date.now();
  await employee.save();

  res.status(200).json({ success: true, data: {} });
});

/**
 * @desc    Upload document for employee
 * @route   PUT /api/v1/employees/:id/documents
 * @access  Private
 */
export const uploadDocument = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new ErrorResponse(`Please upload a file`, 400));
  }

  const file = req.file;

  // Check file type
  if (!file.mimetype.startsWith('application') && !file.mimetype.startsWith('image')) {
    return next(new ErrorResponse(`Please upload a valid file`, 400));
  }

  // Check file size
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return next(
      new ErrorResponse(`File size cannot be more than ${maxSize / (1024 * 1024)}MB`, 400)
    );
  }

  // Create GridFS write stream
  const originalName = file.originalname || file.name;
  const filename = `${Date.now()}-${originalName}`;
  const writeStream = gridfsBucket.openUploadStream(filename, {
    contentType: file.mimetype,
    metadata: {
      employeeId: req.params.id,
      uploadedBy: req.user.id,
      description: req.body.description || ''
    }
  });

  // Handle upload completion
  writeStream.on('error', (error) => {
    return next(new ErrorResponse('Error uploading file', 500));
  });

  writeStream.on('finish', async (file) => {
    // Add document to user's documents array
    const document = {
      type: req.body.documentType || 'other',
      name: file.filename,
      fileId: file._id,
      status: 'pending'
    };

    await User.findByIdAndUpdate(
      req.params.id,
      { $push: { documents: document } },
      { new: true, runValidators: true }
    );
  });

  // Pipe the file data to the GridFS bucket
  const { Readable } = await import('stream');
  const readStream = Readable.from(file.buffer || file.data);
  readStream.pipe(writeStream);

  res.status(200).json({
    success: true,
    data: file.name
  });
});

/**
 * @desc    Verify employee document
 * @route   PUT /api/v1/employees/:id/documents/:docId/verify
 * @access  Private/Admin/HR
 */
export const verifyDocument = asyncHandler(async (req, res, next) => {
  const { documentId } = req.params;
  const { status, rejectionReason } = req.body;

  if (!['verified', 'rejected'].includes(status)) {
    return next(
      new ErrorResponse('Status must be either "verified" or "rejected"', 400)
    );
  }

  if (status === 'rejected' && !rejectionReason) {
    return next(
      new ErrorResponse('Please provide a reason for rejection', 400)
    );
  }

  const update = {
    'documents.$.status': status,
    'documents.$.verifiedBy': req.user.id,
    'documents.$.verifiedAt': Date.now()
  };

  if (status === 'rejected') {
    update['documents.$.rejectionReason'] = rejectionReason;
  }

  const employee = await User.findOneAndUpdate(
    { 'documents._id': documentId },
    { $set: update },
    { new: true, runValidators: true }
  );

  if (!employee) {
    return next(new ErrorResponse('Employee or document not found', 404));
  }

  // Check if all documents are verified
  const allVerified = employee.documents.every(doc => doc.status === 'verified');
  
  if (allVerified && employee.status === 'onboarding') {
    employee.status = 'active';
    await employee.save();
  }

  res.status(200).json({
    success: true,
    data: employee
  });
});

/**
 * @desc    Issue warning to employee
 * @route   POST /api/v1/employees/:id/warnings
 * @access  Private/Admin/HR/Manager
 */
export const issueWarning = asyncHandler(async (req, res, next) => {
  const { reason, severity = 'medium' } = req.body;

  if (!reason) {
    return next(new ErrorResponse('Please provide a reason for the warning', 400));
  }

  const warning = {
    issuedBy: req.user.id,
    reason,
    severity,
    dateIssued: Date.now(),
    isActive: true
  };

  const employee = await User.findByIdAndUpdate(
    req.params.id,
    { $push: { warnings: warning } },
    { new: true, runValidators: true }
  );

  if (!employee) {
    return next(
      new ErrorResponse(`Employee not found with id of ${req.params.id}`, 404)
    );
  }

  // Check if this is the 3rd active warning
  const activeWarnings = employee.warnings.filter(w => w.isActive);
  if (activeWarnings.length >= 3) {
    // Notify manager (in a real app, this would be an email or notification)
    console.log(`Employee ${employee.email} has received 3 or more warnings. Notifying manager.`);
    
    // In a real app, you would send an email or notification here
    // await sendWarningNotification(employee.manager, employee);
  }

  res.status(200).json({
    success: true,
    data: employee
  });
});

/**
 * @desc    Get employee's direct reports (for managers)
 * @route   GET /api/v1/employees/team
 * @access  Private/Manager
 */
export const getTeamMembers = asyncHandler(async (req, res, next) => {
  // Only managers can view their team
  if (req.user.role.name !== 'manager') {
    return next(
      new ErrorResponse('Not authorized to view team members', 403)
    );
  }

  const team = await User.find({ manager: req.user.id })
    .select('firstName lastName email position department status')
    .populate('role', 'name');

  res.status(200).json({
    success: true,
    count: team.length,
    data: team
  });
});

/**
 * @desc    Get document file
 * @route   GET /api/v1/employees/documents/:filename
 * @access  Private
 */
export const getDocument = asyncHandler(async (req, res, next) => {
  const cursor = gridfsBucket.find({ filename: req.params.filename });
  const files = await cursor.toArray();
  const file = files[0];
  if (!file) {
    return next(new ErrorResponse('No document found', 404));
  }

  // Check if user has access to this document
  const employee = await User.findOne({
    $or: [
      { _id: req.user._id },
      { 'documents.fileId': file._id }
    ]
  }).select('_id role');

  if (!employee) {
    return next(
      new ErrorResponse('Not authorized to access this document', 401)
    );
  }

  // Set content type and headers
  res.set('Content-Type', file.contentType);
  res.set('Content-Disposition', `inline; filename="${file.filename}"`);
  
  // Create read stream and pipe to response
  const readStream = gridfsBucket.openDownloadStream(file._id);
  readStream.pipe(res);
});

/**
 * @desc    Get employee dashboard stats (for admin/HR)
 * @route   GET /api/v1/employees/stats
 * @access  Private/Admin/HR
 */
export const getEmployeeStats = asyncHandler(async (req, res, next) => {
  const stats = await User.aggregate([
    {
      $group: {
        _id: '$department',
        count: { $sum: 1 },
        avgSalary: { $avg: '$salary.base' },
        minSalary: { $min: '$salary.base' },
        maxSalary: { $max: '$salary.base' }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);

  const statusStats = await User.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  res.status(200).json({
    success: true,
    data: {
      stats,
      status: statusStats
    }
  });
});