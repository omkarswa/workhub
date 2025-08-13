import express from 'express';
const router = express.Router();
import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  assignManager,
  addTeamMember,
  removeTeamMember,
  getProjectTeam,
  getUserProjects,
  getProjectStats
} from '../controllers/projectController.js';

import { protect, authorize } from '../middleware/authMiddleware.js';

// All routes are protected and require authentication
router.use(protect);

// Routes for /api/v1/projects
router
  .route('/')
  .get(authorize('admin', 'hr', 'manager', 'employee'), getProjects)
  .post(authorize('admin', 'manager'), createProject);

// Routes for /api/v1/projects/stats
router
  .route('/stats')
  .get(authorize('admin', 'hr', 'manager'), getProjectStats);

// Routes for /api/v1/projects/user/me
router
  .route('/user/me')
  .get(authorize('admin', 'hr', 'manager', 'employee'), getUserProjects);

// Routes for /api/v1/projects/:id
router
  .route('/:id')
  .get(authorize('admin', 'hr', 'manager', 'employee'), getProject)
  .put(authorize('admin', 'manager'), updateProject)
  .delete(authorize('admin'), deleteProject);

// Routes for /api/v1/projects/:id/manager
router
  .route('/:id/manager')
  .put(authorize('admin', 'manager'), assignManager);

// Routes for /api/v1/projects/:id/team
router
  .route('/:id/team')
  .get(authorize('admin', 'hr', 'manager', 'employee'), getProjectTeam)
  .post(authorize('admin', 'manager'), addTeamMember);

// Routes for /api/v1/projects/:id/team/:userId
router
  .route('/:id/team/:userId')
  .delete(authorize('admin', 'manager'), removeTeamMember);

export default router;
