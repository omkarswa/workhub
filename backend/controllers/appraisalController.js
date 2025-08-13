import Appraisal from '../models/Appraisal.js';
import User from '../models/User.js';
import { ErrorResponse } from '../utils/errorResponse.js';
import asyncHandler from '../middleware/async.js';

/**
 * @desc    Get all appraisals
 * @route   GET /api/v1/appraisals
 * @route   GET /api/v1/users/:userId/appraisals
 * @access  Private
 */
export const getAppraisals = asyncHandler(async (req, res, next) => {
  // Check if user is admin/HR - they can see all appraisals
  const isAdminOrHR = req.user.role.name === 'admin' || req.user.role.name === 'hr';
  
  // Check if route is for a specific user's appraisals
  if (req.params.userId) {
    // If not admin/HR, users can only see their own appraisals
    if (!isAdminOrHR && req.params.userId !== req.user._id.toString()) {
      return next(
        new ErrorResponse('Not authorized to view appraisals for this user', 403)
      );
    }
    
    // Check if user exists
    const user = await User.findById(req.params.userId);
    if (!user) {
      return next(
        new ErrorResponse(`User not found with id of ${req.params.userId}`, 404)
      );
    }
    
    // Get appraisals for specific user
    const appraisals = await Appraisal.find({ employee: req.params.userId })
      .populate('employee', 'firstName lastName email position')
      .populate('reviewer', 'firstName lastName email position')
      .populate('goals.goal', 'title description')
      .sort('-appraisalDate');
    
    return res.status(200).json({
      success: true,
      count: appraisals.length,
      data: appraisals
    });
  }
  
  // If not admin/HR, only show appraisals where user is employee or reviewer
  let query;
  if (!isAdminOrHR) {
    query = Appraisal.find({
      $or: [
        { employee: req.user._id },
        { reviewer: req.user._id }
      ]
    });
  } else {
    query = Appraisal.find();
  }

  // Execute query with pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = await Appraisal.countDocuments(query.getQuery());

  query = query
    .skip(startIndex)
    .limit(limit)
    .populate('employee', 'firstName lastName email position')
    .populate('reviewer', 'firstName lastName email position')
    .sort('-appraisalDate');

  const appraisals = await query;

  // Pagination result
  const pagination = {};
  if (endIndex < total) {
    pagination.next = { page: page + 1, limit };
  }
  if (startIndex > 0) {
    pagination.prev = { page: page - 1, limit };
  }

  res.status(200).json({
    success: true,
    count: appraisals.length,
    pagination,
    data: appraisals
  });
});

/**
 * @desc    Get single appraisal
 * @route   GET /api/v1/appraisals/:id
 * @access  Private
 */
export const getAppraisal = asyncHandler(async (req, res, next) => {
  const appraisal = await Appraisal.findById(req.params.id)
    .populate('employee', 'firstName lastName email position department')
    .populate('reviewer', 'firstName lastName email position')
    .populate('goals.goal', 'title description');

  if (!appraisal) {
    return next(
      new ErrorResponse(`Appraisal not found with id of ${req.params.id}`, 404)
    );
  }

  // Check if user has access to this appraisal
  const hasAccess = appraisal.employee._id.toString() === req.user._id.toString() ||
                   appraisal.reviewer._id.toString() === req.user._id.toString() ||
                   req.user.role.name === 'admin' ||
                   req.user.role.name === 'hr';

  if (!hasAccess) {
    return next(
      new ErrorResponse('Not authorized to access this appraisal', 403)
    );
  }

  res.status(200).json({
    success: true,
    data: appraisal
  });
});

/**
 * @desc    Create new appraisal
 * @route   POST /api/v1/appraisals
 * @access  Private/Admin/HR/Manager
 */
export const createAppraisal = asyncHandler(async (req, res, next) => {
  // Add user to req.body
  req.body.createdBy = req.user._id;
  
  const { employee, reviewer, appraisalDate, dueDate } = req.body;
  
  // Check if employee exists and is active
  const employeeUser = await User.findOne({
    _id: employee,
    status: 'active',
    isDeleted: { $ne: true }
  });

  if (!employeeUser) {
    return next(
      new ErrorResponse(`Employee with ID ${employee} not found or inactive`, 404)
    );
  }
  
  // Check if reviewer exists and is active
  const reviewerUser = await User.findOne({
    _id: reviewer,
    status: 'active',
    isDeleted: { $ne: true },
    'role.name': { $in: ['admin', 'hr', 'manager'] }
  });

  if (!reviewerUser) {
    return next(
      new ErrorResponse(`Reviewer with ID ${reviewer} not found, inactive, or not authorized to review`, 404)
    );
  }
  
  // Check if appraisal already exists for this employee with the same date
  const existingAppraisal = await Appraisal.findOne({
    employee,
    appraisalDate: new Date(appraisalDate).setHours(0, 0, 0, 0),
    status: { $ne: 'cancelled' }
  });
  
  if (existingAppraisal) {
    return next(
      new ErrorResponse(`An active appraisal already exists for this employee on the selected date`, 400)
    );
  }
  
  // Create appraisal
  const appraisal = await Appraisal.create({
    ...req.body,
    status: 'draft',
    createdBy: req.user._id
  });

  // Populate the response
  const populatedAppraisal = await Appraisal.findById(appraisal._id)
    .populate('employee', 'firstName lastName email position')
    .populate('reviewer', 'firstName lastName email position');

  res.status(201).json({
    success: true,
    data: populatedAppraisal
  });
});

/**
 * @desc    Update appraisal
 * @route   PUT /api/v1/appraisals/:id
 * @access  Private
 */
export const updateAppraisal = asyncHandler(async (req, res, next) => {
  let appraisal = await Appraisal.findById(req.params.id);

  if (!appraisal) {
    return next(
      new ErrorResponse(`Appraisal not found with id of ${req.params.id}`, 404)
    );
  }
  
  // Check if user is authorized to update this appraisal
  const isAdminOrHR = req.user.role.name === 'admin' || req.user.role.name === 'hr';
  const isReviewer = appraisal.reviewer.toString() === req.user._id.toString();
  const isEmployee = appraisal.employee.toString() === req.user._id.toString();
  
  // Only admin/HR can update all fields
  // Reviewer can only update their review and status
  // Employee can only update self-assessment and goals
  if (!isAdminOrHR) {
    if (isReviewer) {
      // Reviewer can only update review and status
      const { review, status } = req.body;
      req.body = { review, status };
    } else if (isEmployee) {
      // Employee can only update selfAssessment and goals
      const { selfAssessment, goals } = req.body;
      req.body = { selfAssessment, goals };
    } else {
      return next(
        new ErrorResponse('Not authorized to update this appraisal', 403)
      );
    }
  }
  
  // Prevent changing status to completed if required fields are missing
  if (req.body.status === 'completed') {
    if (!appraisal.selfAssessment || appraisal.selfAssessment.trim() === '') {
      return next(
        new ErrorResponse('Self-assessment is required to complete the appraisal', 400)
      );
    }
    
    if (!appraisal.review || appraisal.review.trim() === '') {
      return next(
        new ErrorResponse('Reviewer feedback is required to complete the appraisal', 400)
      );
    }
    
    if (appraisal.goals.length === 0) {
      return next(
        new ErrorResponse('At least one goal is required to complete the appraisal', 400)
      );
    }
    
    // Set completed date
    req.body.completedAt = Date.now();
  }
  
  // Update appraisal
  appraisal = await Appraisal.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  })
  .populate('employee', 'firstName lastName email position')
  .populate('reviewer', 'firstName lastName email position')
  .populate('goals.goal', 'title description');

  res.status(200).json({
    success: true,
    data: appraisal
  });
});

/**
 * @desc    Delete appraisal
 * @route   DELETE /api/v1/appraisals/:id
 * @access  Private/Admin/HR
 */
export const deleteAppraisal = asyncHandler(async (req, res, next) => {
  const appraisal = await Appraisal.findById(req.params.id);

  if (!appraisal) {
    return next(
      new ErrorResponse(`Appraisal not found with id of ${req.params.id}`, 404)
    );
  }

  // Only admin/HR can delete appraisals
  if (req.user.role.name !== 'admin' && req.user.role.name !== 'hr') {
    return next(
      new ErrorResponse('Not authorized to delete appraisals', 403)
    );
  }
  
  // Soft delete
  appraisal.isDeleted = true;
  appraisal.deletedAt = Date.now();
  await appraisal.save();

  res.status(200).json({
    success: true,
    data: {}
  });
});

/**
 * @desc    Submit self-assessment
 * @route   PUT /api/v1/appraisals/:id/self-assessment
 * @access  Private
 */
export const submitSelfAssessment = asyncHandler(async (req, res, next) => {
  const { selfAssessment, goals } = req.body;
  
  if (!selfAssessment || selfAssessment.trim() === '') {
    return next(new ErrorResponse('Please provide a self-assessment', 400));
  }
  
  const appraisal = await Appraisal.findById(req.params.id);
  
  if (!appraisal) {
    return next(
      new ErrorResponse(`Appraisal not found with id of ${req.params.id}`, 404)
    );
  }
  
  // Only the employee can submit self-assessment
  if (appraisal.employee.toString() !== req.user._id.toString()) {
    return next(
      new ErrorResponse('Not authorized to submit self-assessment for this appraisal', 403)
    );
  }
  
  // Can only submit if status is draft or in_progress
  if (!['draft', 'in_progress'].includes(appraisal.status)) {
    return next(
      new ErrorResponse(`Cannot submit self-assessment when status is ${appraisal.status}`, 400)
    );
  }
  
  // Update self-assessment and goals
  appraisal.selfAssessment = selfAssessment;
  appraisal.goals = goals || [];
  appraisal.status = 'in_progress';
  appraisal.selfAssessmentDate = Date.now();
  
  await appraisal.save();
  
  // Populate the response
  const populatedAppraisal = await Appraisal.findById(appraisal._id)
    .populate('employee', 'firstName lastName email position')
    .populate('reviewer', 'firstName lastName email position')
    .populate('goals.goal', 'title description');
  
  // TODO: Send notification to reviewer
  
  res.status(200).json({
    success: true,
    data: populatedAppraisal
  });
});

/**
 * @desc    Submit review
 * @route   PUT /api/v1/appraisals/:id/review
 * @access  Private
 */
export const submitReview = asyncHandler(async (req, res, next) => {
  const { review, rating, status, goals } = req.body;
  
  if (!review || review.trim() === '') {
    return next(new ErrorResponse('Please provide a review', 400));
  }
  
  if (!rating || rating < 1 || rating > 5) {
    return next(new ErrorResponse('Please provide a valid rating between 1 and 5', 400));
  }
  
  const appraisal = await Appraisal.findById(req.params.id);
  
  if (!appraisal) {
    return next(
      new ErrorResponse(`Appraisal not found with id of ${req.params.id}`, 404)
    );
  }
  
  // Only the reviewer can submit review
  if (appraisal.reviewer.toString() !== req.user._id.toString()) {
    return next(
      new ErrorResponse('Not authorized to submit review for this appraisal', 403)
    );
  }
  
  // Can only submit review if status is in_progress or needs_review
  if (!['in_progress', 'needs_review'].includes(appraisal.status)) {
    return next(
      new ErrorResponse(`Cannot submit review when status is ${appraisal.status}`, 400)
    );
  }
  
  // Update review, rating, status, and goals
  appraisal.review = review;
  appraisal.rating = rating;
  appraisal.status = status || 'completed';
  appraisal.reviewDate = Date.now();
  
  if (goals && Array.isArray(goals)) {
    appraisal.goals = goals;
  }
  
  // If completing the appraisal, set completed date
  if (appraisal.status === 'completed') {
    appraisal.completedAt = Date.now();
  }
  
  await appraisal.save();
  
  // Populate the response
  const populatedAppraisal = await Appraisal.findById(appraisal._id)
    .populate('employee', 'firstName lastName email position')
    .populate('reviewer', 'firstName lastName email position')
    .populate('goals.goal', 'title description');
  
  // TODO: Send notification to employee
  
  res.status(200).json({
    success: true,
    data: populatedAppraisal
  });
});

/**
 * @desc    Get appraisal statistics
 * @route   GET /api/v1/appraisals/stats
 * @access  Private/Admin/HR/Manager
 */
export const getAppraisalStats = asyncHandler(async (req, res, next) => {
  // Only admin/HR can see all stats
  // Managers can only see stats for their team members
  let match = {};
  
  if (req.user.role.name === 'manager') {
    // Get all direct reports for this manager
    const teamMembers = await User.find({
      manager: req.user._id,
      status: 'active',
      isDeleted: { $ne: true }
    }).select('_id');
    
    const teamMemberIds = teamMembers.map(member => member._id);
    
    match = {
      employee: { $in: teamMemberIds }
    };
  }
  
  // Get count of appraisals by status
  const statusStats = await Appraisal.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgRating: { $avg: '$rating' },
        minRating: { $min: '$rating' },
        maxRating: { $max: '$rating' }
      }
    },
    { $sort: { count: -1 } }
  ]);
  
  // Get average rating by department (if available)
  const departmentStats = await Appraisal.aggregate([
    {
      $lookup: {
        from: 'users',
        localField: 'employee',
        foreignField: '_id',
        as: 'employeeData'
      }
    },
    { $unwind: '$employeeData' },
    {
      $group: {
        _id: '$employeeData.department',
        count: { $sum: 1 },
        avgRating: { $avg: '$rating' },
        minRating: { $min: '$rating' },
        maxRating: { $max: '$rating' }
      }
    },
    { $sort: { avgRating: -1 } }
  ]);
  
  // Get overdue appraisals
  const overdueAppraisals = await Appraisal.find({
    ...match,
    dueDate: { $lt: new Date() },
    status: { $nin: ['completed', 'cancelled'] }
  })
  .populate('employee', 'firstName lastName email position')
  .populate('reviewer', 'firstName lastName email')
  .sort('dueDate');
  
  // Get upcoming appraisals (due in the next 30 days)
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  
  const upcomingAppraisals = await Appraisal.find({
    ...match,
    dueDate: { 
      $gte: new Date(),
      $lte: thirtyDaysFromNow
    },
    status: { $nin: ['completed', 'cancelled'] }
  })
  .populate('employee', 'firstName lastName email position')
  .populate('reviewer', 'firstName lastName email')
  .sort('dueDate');
  
  res.status(200).json({
    success: true,
    data: {
      byStatus: statusStats,
      byDepartment: departmentStats,
      overdue: overdueAppraisals,
      upcoming: upcomingAppraisals
    }
  });
});

/**
 * @desc    Get my appraisals
 * @route   GET /api/v1/appraisals/me
 * @access  Private
 */
export const getMyAppraisals = asyncHandler(async (req, res, next) => {
  // Get appraisals where user is employee or reviewer
  const appraisals = await Appraisal.find({
    $or: [
      { employee: req.user._id },
      { reviewer: req.user._id }
    ]
  })
  .populate('employee', 'firstName lastName email position')
  .populate('reviewer', 'firstName lastName email position')
  .sort('-appraisalDate');
  
  res.status(200).json({
    success: true,
    count: appraisals.length,
    data: appraisals
  });
});