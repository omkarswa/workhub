import Project from '../models/Project.js';
import User from '../models/User.js';
import { ErrorResponse } from '../utils/errorResponse.js';
import asyncHandler from '../middleware/async.js';
import path from 'path';
import fs from 'fs';
import { connectDB } from '../config/db.js';

/**
 * @desc    Get all projects
 * @route   GET /api/v1/projects
 * @access  Private
 */
export const getProjects = asyncHandler(async (req, res, next) => {
  // Check if user is admin/HR - they can see all projects
  const isAdminOrHR = req.user.role.name === 'admin' || req.user.role.name === 'hr';
  
  let query;
  
  // If not admin/HR, only show projects where user is manager or team member
  if (!isAdminOrHR) {
    query = Project.find({
      $or: [
        { manager: req.user._id },
        { 'team.user': req.user._id, 'team.isActive': true }
      ]
    });
  } else {
    query = Project.find();
  }

  // Select fields to populate
  const populateOptions = [
    { path: 'manager', select: 'firstName lastName email' },
    { path: 'team.user', select: 'firstName lastName email position' },
    { path: 'createdBy', select: 'firstName lastName email' },
    { path: 'updatedBy', select: 'firstName lastName email' }
  ];

  // Execute query with pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = await Project.countDocuments(query.getQuery());

  query = query
    .skip(startIndex)
    .limit(limit)
    .populate(populateOptions)
    .sort('-createdAt');

  const projects = await query;

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
    count: projects.length,
    pagination,
    data: projects
  });
});

/**
 * @desc    Get single project
 * @route   GET /api/v1/projects/:id
 * @access  Private
 */
export const getProject = asyncHandler(async (req, res, next) => {
  const project = await Project.findById(req.params.id)
    .populate('manager', 'firstName lastName email')
    .populate('team.user', 'firstName lastName email position')
    .populate('createdBy', 'firstName lastName email')
    .populate('updatedBy', 'firstName lastName email')
    .populate('tasks.assignedTo', 'firstName lastName')
    .populate('tasks.completedBy', 'firstName lastName')
    .populate('discussions.user', 'firstName lastName')
    .populate('discussions.replies.user', 'firstName lastName');

  if (!project) {
    return next(
      new ErrorResponse(`Project not found with id of ${req.params.id}`, 404)
    );
  }

  // Check if user has access to this project
  const hasAccess = project.manager._id.toString() === req.user._id.toString() ||
                   project.team.some(member => 
                     member.user._id.toString() === req.user._id.toString() && 
                     member.isActive
                   ) ||
                   req.user.role.name === 'admin' ||
                   req.user.role.name === 'hr';

  if (!hasAccess) {
    return next(
      new ErrorResponse('Not authorized to access this project', 403)
    );
  }

  res.status(200).json({
    success: true,
    data: project
  });
});

/**
 * @desc    Create new project
 * @route   POST /api/v1/projects
 * @access  Private/Admin/Manager
 */
export const createProject = asyncHandler(async (req, res, next) => {
  // Add user to req.body
  req.body.createdBy = req.user._id;
  req.body.updatedBy = req.user._id;
  
  // Check if manager exists and is active
  const manager = await User.findOne({
    _id: req.body.manager,
    status: 'active',
    isDeleted: { $ne: true }
  });

  if (!manager) {
    return next(
      new ErrorResponse(`Manager with ID ${req.body.manager} not found or inactive`, 404)
    );
  }

  // Create project
  const project = await Project.create(req.body);

  // Add manager to the team if not already added
  await project.addTeamMember(manager._id, 'manager', 100);

  res.status(201).json({
    success: true,
    data: project
  });
});

/**
 * @desc    Update project
 * @route   PUT /api/v1/projects/:id
 * @access  Private/Admin/Manager
 */
export const updateProject = asyncHandler(async (req, res, next) => {
  let project = await Project.findById(req.params.id);

  if (!project) {
    return next(
      new ErrorResponse(`Project not found with id of ${req.params.id}`, 404)
    );
  }

  // Check if user is authorized to update this project
  const isAdmin = req.user.role.name === 'admin';
  const isProjectManager = project.manager.toString() === req.user._id.toString();
  
  if (!isAdmin && !isProjectManager) {
    return next(
      new ErrorResponse('Not authorized to update this project', 403)
    );
  }

  // Update updatedBy field
  req.body.updatedBy = req.user._id;

  // Prevent changing manager through this endpoint (use assignManager instead)
  if (req.body.manager && req.body.manager !== project.manager.toString()) {
    return next(
      new ErrorResponse('Please use the assignManager endpoint to change project manager', 400)
    );
  }

  project = await Project.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  })
  .populate('manager', 'firstName lastName email')
  .populate('team.user', 'firstName lastName email position')
  .populate('createdBy', 'firstName lastName email')
  .populate('updatedBy', 'firstName lastName email');

  res.status(200).json({
    success: true,
    data: project
  });
});

/**
 * @desc    Delete project
 * @route   DELETE /api/v1/projects/:id
 * @access  Private/Admin
 */
export const deleteProject = asyncHandler(async (req, res, next) => {
  const project = await Project.findById(req.params.id);

  if (!project) {
    return next(
      new ErrorResponse(`Project not found with id of ${req.params.id}`, 404)
    );
  }

  // Only admin can delete projects
  if (req.user.role.name !== 'admin') {
    return next(
      new ErrorResponse('Not authorized to delete projects', 403)
    );
  }

  // Soft delete
  project.isDeleted = true;
  project.deletedAt = Date.now();
  await project.save();

  res.status(200).json({
    success: true,
    data: {}
  });
});

/**
 * @desc    Assign/Change project manager
 * @route   PUT /api/v1/projects/:id/manager
 * @access  Private/Admin/Manager
 */
export const assignManager = asyncHandler(async (req, res, next) => {
  const { managerId } = req.body;
  
  if (!managerId) {
    return next(new ErrorResponse('Please provide a manager ID', 400));
  }

  const project = await Project.findById(req.params.id);
  
  if (!project) {
    return next(
      new ErrorResponse(`Project not found with id of ${req.params.id}`, 404)
    );
  }

  // Check if user is authorized to change manager
  const isAdmin = req.user.role.name === 'admin';
  const isCurrentManager = project.manager.toString() === req.user._id.toString();
  
  if (!isAdmin && !isCurrentManager) {
    return next(
      new ErrorResponse('Not authorized to change project manager', 403)
    );
  }

  // Check if new manager exists and is active
  const newManager = await User.findOne({
    _id: managerId,
    status: 'active',
    isDeleted: { $ne: true }
  });

  if (!newManager) {
    return next(
      new ErrorResponse(`User with ID ${managerId} not found or inactive`, 404)
    );
  }

  // Update manager
  const oldManagerId = project.manager;
  project.manager = newManager._id;
  project.updatedBy = req.user._id;
  
  // Remove old manager from team if not already a member
  const isOldManagerInTeam = project.team.some(
    member => member.user.toString() === oldManagerId.toString() && member.isActive
  );
  
  if (isOldManagerInTeam) {
    await project.removeTeamMember(oldManagerId);
  }
  
  // Add new manager to team if not already a member
  const isNewManagerInTeam = project.team.some(
    member => member.user.toString() === newManager._id.toString() && member.isActive
  );
  
  if (!isNewManagerInTeam) {
    await project.addTeamMember(newManager._id, 'manager', 100);
  }
  
  await project.save();

  const updatedProject = await Project.findById(project._id)
    .populate('manager', 'firstName lastName email')
    .populate('team.user', 'firstName lastName email position')
    .populate('updatedBy', 'firstName lastName email');

  res.status(200).json({
    success: true,
    data: updatedProject
  });
});

/**
 * @desc    Add team member to project
 * @route   POST /api/v1/projects/:id/team
 * @access  Private/Admin/Manager
 */
export const addTeamMember = asyncHandler(async (req, res, next) => {
  const { userId, role = 'developer', allocation = 100 } = req.body;
  
  if (!userId) {
    return next(new ErrorResponse('Please provide a user ID', 400));
  }

  const project = await Project.findById(req.params.id);
  
  if (!project) {
    return next(
      new ErrorResponse(`Project not found with id of ${req.params.id}`, 404)
    );
  }

  // Check if user is authorized to add team members
  const isAdmin = req.user.role.name === 'admin';
  const isProjectManager = project.manager.toString() === req.user._id.toString();
  
  if (!isAdmin && !isProjectManager) {
    return next(
      new ErrorResponse('Not authorized to add team members', 403)
    );
  }

  // Check if user exists and is active
  const user = await User.findOne({
    _id: userId,
    status: 'active',
    isDeleted: { $ne: true }
  });

  if (!user) {
    return next(
      new ErrorResponse(`User with ID ${userId} not found or inactive`, 404)
    );
  }

  // Check if user is already a team member
  const existingMember = project.team.find(
    member => member.user.toString() === userId && member.isActive
  );
  
  if (existingMember) {
    return next(
      new ErrorResponse('User is already a team member', 400)
    );
  }

  // Check if allocation is valid (1-100)
  if (allocation < 1 || allocation > 100) {
    return next(
      new ErrorResponse('Allocation must be between 1 and 100', 400)
    );
  }

  // Add team member
  await project.addTeamMember(userId, role, allocation);
  
  // Update updatedBy
  project.updatedBy = req.user._id;
  await project.save();

  const updatedProject = await Project.findById(project._id)
    .populate('team.user', 'firstName lastName email position')
    .populate('updatedBy', 'firstName lastName email');

  res.status(200).json({
    success: true,
    data: updatedProject
  });
});

/**
 * @desc    Update team member
 * @route   PUT /api/v1/projects/:id/team
 * @access  Private/Admin/Manager
 */
export const updateTeamMember = asyncHandler(async (req, res, next) => {
  const { userId, role = 'developer', allocation = 100 } = req.body;
  
  if (!userId) {
    return next(new ErrorResponse('Please provide a user ID', 400));
  }

  const project = await Project.findById(req.params.id);
  
  if (!project) {
    return next(
      new ErrorResponse(`Project not found with id of ${req.params.id}`, 404)
    );
  }

  // Check if user is authorized to update team members
  const isAdmin = req.user.role.name === 'admin';
  const isProjectManager = project.manager.toString() === req.user._id.toString();
  
  if (!isAdmin && !isProjectManager) {
    return next(
      new ErrorResponse('Not authorized to update team members', 403)
    );
  }

  // Check if user exists and is active
  const user = await User.findOne({
    _id: userId,
    status: 'active',
    isDeleted: { $ne: true }
  });

  if (!user) {
    return next(
      new ErrorResponse(`User with ID ${userId} not found or inactive`, 404)
    );
  }

  // Check if user is already a team member
  const existingMember = project.team.find(
    member => member.user.toString() === userId && member.isActive
  );
  
  if (!existingMember) {
    return next(
      new ErrorResponse('User is not a team member of this project', 400)
    );
  }

  // Check if allocation is valid (1-100)
  if (allocation < 1 || allocation > 100) {
    return next(
      new ErrorResponse('Allocation must be between 1 and 100', 400)
    );
  }

  // Update team member
  existingMember.role = role;
  existingMember.allocation = allocation;
  
  // Update updatedBy
  project.updatedBy = req.user._id;
  await project.save();

  const updatedProject = await Project.findById(project._id)
    .populate('team.user', 'firstName lastName email position')
    .populate('updatedBy', 'firstName lastName email');

  res.status(200).json({
    success: true,
    data: updatedProject
  });
});

/**
 * @desc    Remove team member from project
 * @route   DELETE /api/v1/projects/:id/team/:userId
 * @access  Private/Admin/Manager
 */
export const removeTeamMember = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  
  const project = await Project.findById(req.params.id);
  
  if (!project) {
    return next(
      new ErrorResponse(`Project not found with id of ${req.params.id}`, 404)
    );
  }

  // Check if user is authorized to remove team members
  const isAdmin = req.user.role.name === 'admin';
  const isProjectManager = project.manager.toString() === req.user._id.toString();
  
  if (!isAdmin && !isProjectManager) {
    return next(
      new ErrorResponse('Not authorized to remove team members', 403)
    );
  }

  // Check if user to be removed is the project manager
  if (project.manager.toString() === userId) {
    return next(
      new ErrorResponse('Cannot remove project manager. Please assign a new manager first.', 400)
    );
  }

  // Check if user is a team member
  const isTeamMember = project.team.some(
    member => member.user.toString() === userId && member.isActive
  );
  
  if (!isTeamMember) {
    return next(
      new ErrorResponse('User is not a team member of this project', 400)
    );
  }

  // Remove team member
  await project.removeTeamMember(userId);
  
  // Update updatedBy
  project.updatedBy = req.user._id;
  await project.save();

  const updatedProject = await Project.findById(project._id)
    .populate('team.user', 'firstName lastName email position')
    .populate('updatedBy', 'firstName lastName email');

  res.status(200).json({
    success: true,
    data: updatedProject
  });
});

/**
 * @desc    Get project team members
 * @route   GET /api/v1/projects/:id/team
 * @access  Private
 */
export const getProjectTeam = asyncHandler(async (req, res, next) => {
  const project = await Project.findById(req.params.id)
    .select('team')
    .populate('team.user', 'firstName lastName email position department')
    .populate('manager', 'firstName lastName email');
  
  if (!project) {
    return next(
      new ErrorResponse(`Project not found with id of ${req.params.id}`, 404)
    );
  }

  // Check if user has access to this project
  const hasAccess = project.manager._id.toString() === req.user._id.toString() ||
                   project.team.some(member => 
                     member.user._id.toString() === req.user._id.toString() && 
                     member.isActive
                   ) ||
                   req.user.role.name === 'admin' ||
                   req.user.role.name === 'hr';

  if (!hasAccess) {
    return next(
      new ErrorResponse('Not authorized to view this project team', 403)
    );
  }

  // Format response to include manager and team members
  const teamMembers = project.team
    .filter(member => member.isActive)
    .map(member => ({
      ...member.toObject(),
      isManager: member.user._id.toString() === project.manager._id.toString()
    }));

  res.status(200).json({
    success: true,
    count: teamMembers.length,
    data: teamMembers
  });
});

/**
 * @desc    Get projects by user
 * @route   GET /api/v1/projects/user/me
 * @access  Private
 */
export const getUserProjects = asyncHandler(async (req, res, next) => {
  const projects = await Project.find({
    $or: [
      { manager: req.user._id },
      { 'team.user': req.user._id, 'team.isActive': true }
    ]
  })
  .select('name description status priority startDate endDate manager')
  .populate('manager', 'firstName lastName email')
  .sort('-updatedAt');

  res.status(200).json({
    success: true,
    count: projects.length,
    data: projects
  });
});

/**
 * @desc    Upload project document
 * @route   POST /api/v1/projects/user/me
 * @access  Private
 */
export const uploadProjectDocument = asyncHandler(async (req, res, next) => {
  const projects = await Project.find({
    $or: [
      { manager: req.user._id },
      { 'team.user': req.user._id, 'team.isActive': true }
    ]
  })
  .select('name description status priority startDate endDate manager')
  .populate('manager', 'firstName lastName email')
  .sort('-updatedAt');

  res.status(200).json({
    success: true,
    count: projects.length,
    data: projects
  });
});

/**
 * @desc    Get project statistics
 * @route   GET /api/v1/projects/stats
 * @access  Private/Admin/HR/Manager
 */
export const getProjectStats = asyncHandler(async (req, res, next) => {
  // Only admin/HR can see all projects stats
  // Managers can only see stats for their projects
  let match = {};
  
  if (req.user.role.name === 'manager') {
    match = {
      $or: [
        { manager: req.user._id },
        { 'team.user': req.user._id, 'team.isActive': true }
      ]
    };
  }

  const stats = await Project.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalBudget: { $sum: '$budget' },
        avgBudget: { $avg: '$budget' },
        minBudget: { $min: '$budget' },
        maxBudget: { $max: '$budget' }
      }
    },
    { $sort: { count: -1 } }
  ]);

  // Get projects by priority
  const priorityStats = await Project.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$priority',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);

  // Get projects by department (if available)
  // This would require a department field in the Project model
  // or a way to associate projects with departments

  res.status(200).json({
    success: true,
    data: {
      byStatus: stats,
      byPriority: priorityStats
    }
  });
});