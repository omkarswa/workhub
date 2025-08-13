import Warning from '../models/Warning.js';
import Employee from '../models/Employee.js';
import { ErrorResponse } from '../utils/errorResponse.js';

// Safe no-op helpers to replace missing services
const logAction = async () => {};
const sendNotification = async () => {};

/**
 * @desc    Get all warnings with filtering and pagination
 * @route   GET /api/v1/warnings
 * @access  Private/Admin/HR/Manager
 */
export const getWarnings = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, severity, sortBy = '-dateIssued', ...filters } = req.query;
    
    // Build query
    const query = {};
    
    // Filter by status if provided
    if (status) {
      query.status = status;
    }
    
    // Filter by severity if provided
    if (severity) {
      query.severity = severity;
    }
    
    // Add other filters
    Object.keys(filters).forEach(key => {
      if (key !== 'page' && key !== 'limit' && key !== 'sortBy') {
        query[key] = { $regex: filters[key], $options: 'i' };
      }
    });
    
    // Execute query with pagination
    const warnings = await Warning.find(query)
      .populate('employee', 'firstName lastName employeeId')
      .populate('createdBy', 'firstName lastName')
      .sort(sortBy)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();
    
    // Get total count for pagination
    const count = await Warning.countDocuments(query);
    
    res.json({
      success: true,
      count: warnings.length,
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      data: warnings
    });
    
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get a single warning by ID
 * @route   GET /api/v1/warnings/:id
 * @access  Private/Admin/HR/Manager
 */
export const getWarning = async (req, res, next) => {
  try {
    const warning = await Warning.findById(req.params.id)
      .populate('employee', 'firstName lastName employeeId')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .populate('relatedDocuments', 'name url type');
    
    if (!warning) {
      return next(new ErrorResponse('Warning not found', 404));
    }
    
    // Check if user has permission to view this warning
    if (
      !req.user.roles?.includes('admin') && 
      !req.user.roles?.includes('hr') && 
      !(req.user.roles?.includes('manager') && warning.employee.manager.toString() === req.user.id)
    ) {
      return next(new ErrorResponse('Not authorized to view this warning', 403));
    }
    
    res.json({
      success: true,
      data: warning
    });
    
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a new warning
 * @route   POST /api/v1/warnings
 * @access  Private/Admin/HR/Manager
 */
export const createWarning = async (req, res, next) => {
  try {
    const { employee: employeeId, ...warningData } = req.body;
    
    // Check if employee exists
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return next(new ErrorResponse('Employee not found', 404));
    }
    
    // Create warning
    const warning = new Warning({
      ...warningData,
      employee: employeeId,
      createdBy: req.user.id
    });
    
    await warning.save();
    
    // Log action
    await logAction({
      user: req.user.id,
      action: 'create_warning',
      targetModel: 'Warning',
      targetId: warning._id,
      metadata: {
        employee: employeeId,
        type: warning.type,
        severity: warning.severity
      }
    });
    
    // Send notification to employee
    await sendNotification({
      recipients: [employeeId],
      title: 'New Warning Issued',
      message: `You have received a ${warning.severity} severity warning: ${warning.title}`,
      type: 'warning',
      link: `/warnings/${warning._id}`,
      createdBy: req.user.id
    });
    
    res.status(201).json({
      success: true,
      data: warning
    });
    
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update a warning
 * @route   PUT /api/v1/warnings/:id
 * @access  Private/Admin/HR/Manager
 */
export const updateWarning = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Find warning
    let warning = await Warning.findById(id);
    if (!warning) {
      throw new NotFoundError('Warning not found');
    }
    
    // Check permissions
    if (
      !req.user.roles.includes('admin') && 
      !req.user.roles.includes('hr') && 
      !(req.user.roles.includes('manager') && warning.createdBy.toString() === req.user.id)
    ) {
      throw new ForbiddenError('Not authorized to update this warning');
    }
    
    // Update warning
    Object.keys(updates).forEach(key => {
      warning[key] = updates[key];
    });
    
    warning.updatedBy = req.user.id;
    await warning.save();
    
    // Log action
    await logAction({
      user: req.user.id,
      action: 'update_warning',
      targetModel: 'Warning',
      targetId: warning._id,
      metadata: {
        updatedFields: Object.keys(updates)
      }
    });
    
    res.json({
      success: true,
      data: warning
    });
    
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a warning
 * @route   DELETE /api/v1/warnings/:id
 * @access  Private/Admin/HR
 */
export const deleteWarning = async (req, res, next) => {
  try {
    const warning = await Warning.findById(req.params.id);
    
    if (!warning) {
      throw new NotFoundError('Warning not found');
    }
    
    // Soft delete
    warning.isDeleted = true;
    warning.deletedAt = new Date();
    warning.deletedBy = req.user.id;
    
    await warning.save();
    
    // Log action
    await logAction({
      user: req.user.id,
      action: 'delete_warning',
      targetModel: 'Warning',
      targetId: warning._id,
      metadata: {
        employee: warning.employee,
        type: warning.type
      }
    });
    
    res.json({
      success: true,
      data: {}
    });
    
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Resolve a warning
 * @route   PUT /api/v1/warnings/:id/resolve
 * @access  Private/Admin/HR/Manager
 */
export const resolveWarning = async (req, res, next) => {
  try {
    const warning = await Warning.findById(req.params.id);
    
    if (!warning) {
      throw new NotFoundError('Warning not found');
    }
    
    // Check permissions
    if (
      !req.user.roles.includes('admin') && 
      !req.user.roles.includes('hr') && 
      !(req.user.roles.includes('manager') && warning.createdBy.toString() === req.user.id)
    ) {
      throw new ForbiddenError('Not authorized to resolve this warning');
    }
    
    // Resolve warning
    warning.status = 'resolved';
    warning.resolvedAt = new Date();
    warning.resolutionNotes = req.body.notes || '';
    warning.updatedBy = req.user.id;
    
    await warning.save();
    
    // Log action
    await logAction({
      user: req.user.id,
      action: 'resolve_warning',
      targetModel: 'Warning',
      targetId: warning._id,
      metadata: {
        notes: req.body.notes
      }
    });
    
    // Send notification to employee
    await sendNotification({
      recipients: [warning.employee],
      title: 'Warning Resolved',
      message: `Your warning "${warning.title}" has been resolved.`,
      type: 'warning_update',
      link: `/warnings/${warning._id}`,
      createdBy: req.user.id
    });
    
    res.json({
      success: true,
      data: warning
    });
    
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Escalate a warning
 * @route   PUT /api/v1/warnings/:id/escalate
 * @access  Private/Admin/HR/Manager
 */
export const escalateWarning = async (req, res, next) => {
  try {
    const warning = await Warning.findById(req.params.id);
    
    if (!warning) {
      throw new NotFoundError('Warning not found');
    }
    
    // Check if already escalated
    if (warning.escalated) {
      throw new BadRequestError('Warning has already been escalated');
    }
    
    // Escalate warning
    warning.escalated = true;
    warning.escalationDate = new Date();
    warning.escalationNotes = req.body.notes || '';
    warning.updatedBy = req.user.id;
    
    await warning.save();
    
    // Log action
    await logAction({
      user: req.user.id,
      action: 'escalate_warning',
      targetModel: 'Warning',
      targetId: warning._id,
      metadata: {
        notes: req.body.notes
      }
    });
    
    // Send notification to HR/Admin
    await sendNotification({
      recipients: await User.find({ 
        roles: { $in: ['admin', 'hr'] },
        _id: { $ne: req.user.id }
      }).distinct('_id'),
      title: 'Warning Escalated',
      message: `Warning "${warning.title}" has been escalated by ${req.user.firstName} ${req.user.lastName}.`,
      type: 'warning_escalation',
      link: `/warnings/${warning._id}`,
      createdBy: req.user.id
    });
    
    res.json({
      success: true,
      data: warning
    });
    
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Withdraw a warning
 * @route   PUT /api/v1/warnings/:id/withdraw
 * @access  Private/Admin/HR
 */
export const withdrawWarning = async (req, res, next) => {
  try {
    const warning = await Warning.findById(req.params.id);
    
    if (!warning) {
      throw new NotFoundError('Warning not found');
    }
    
    // Withdraw warning
    warning.status = 'withdrawn';
    warning.withdrawnAt = new Date();
    warning.withdrawnBy = req.user.id;
    warning.withdrawalReason = req.body.reason || '';
    warning.updatedBy = req.user.id;
    
    await warning.save();
    
    // Log action
    await logAction({
      user: req.user.id,
      action: 'withdraw_warning',
      targetModel: 'Warning',
      targetId: warning._id,
      metadata: {
        reason: req.body.reason
      }
    });
    
    // Send notification to employee
    await sendNotification({
      recipients: [warning.employee],
      title: 'Warning Withdrawn',
      message: `Your warning "${warning.title}" has been withdrawn. Reason: ${req.body.reason}`,
      type: 'warning_update',
      link: `/warnings/${warning._id}`,
      createdBy: req.user.id
    });
    
    res.json({
      success: true,
      data: warning
    });
    
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all warnings for a specific employee
 * @route   GET /api/v1/warnings/employee/:employeeId
 * @access  Private/Admin/HR/Manager
 */
export const getEmployeeWarnings = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { status, sortBy = '-dateIssued' } = req.query;
    
    // Check if employee exists
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      throw new NotFoundError('Employee not found');
    }
    
    // Build query
    const query = { employee: employeeId };
    
    // Filter by status if provided
    if (status) {
      query.status = status;
    }
    
    // Get warnings
    const warnings = await Warning.find(query)
      .sort(sortBy)
      .populate('createdBy', 'firstName lastName')
      .lean();
    
    res.json({
      success: true,
      count: warnings.length,
      data: warnings
    });
    
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all active warnings
 * @route   GET /api/v1/warnings/active
 * @access  Private/Admin/HR/Manager
 */
export const getActiveWarnings = async (req, res, next) => {
  try {
    const activeWarnings = await Warning.find({
      status: 'active',
      validUntil: { $gt: new Date() }
    })
    .populate('employee', 'firstName lastName employeeId')
    .populate('createdBy', 'firstName lastName')
    .sort({ severity: -1, dateIssued: -1 })
    .lean();
    
    res.json({
      success: true,
      count: activeWarnings.length,
      data: activeWarnings
    });
    
  } catch (error) {
    next(error);
  }
};

// Named exports are declared inline above with `export const ...`