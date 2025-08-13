import express from 'express';
const router = express.Router();
import {
  getAppraisals,
  getAppraisal,
  createAppraisal,
  updateAppraisal,
  deleteAppraisal,
  submitSelfAssessment,
  submitReview,
  getAppraisalStats,
  getMyAppraisals
} from '../controllers/appraisalController.js';

import { protect, authorize } from '../middleware/authMiddleware.js';

// All routes are protected and require authentication
router.use(protect);

// Routes for /api/v1/appraisals
router
  .route('/')
  .get(authorize('admin', 'hr', 'manager', 'employee'), getAppraisals)
  .post(authorize('admin', 'hr', 'manager'), createAppraisal);

// Routes for /api/v1/appraisals/stats
router
  .route('/stats')
  .get(authorize('admin', 'hr', 'manager'), getAppraisalStats);

// Routes for /api/v1/appraisals/me
router
  .route('/me')
  .get(authorize('admin', 'hr', 'manager', 'employee'), getMyAppraisals);

// Routes for /api/v1/appraisals/:id
router
  .route('/:id')
  .get(authorize('admin', 'hr', 'manager', 'employee'), getAppraisal)
  .put(authorize('admin', 'hr', 'manager'), updateAppraisal)
  .delete(authorize('admin', 'hr'), deleteAppraisal);

// Routes for /api/v1/appraisals/:id/self-assessment
router
  .route('/:id/self-assessment')
  .put(authorize('admin', 'hr', 'manager', 'employee'), submitSelfAssessment);

// Routes for /api/v1/appraisals/:id/review
router
  .route('/:id/review')
  .put(authorize('admin', 'hr', 'manager'), submitReview);

// Routes for /api/v1/users/:userId/appraisals
router
  .route('/users/:userId/appraisals')
  .get(authorize('admin', 'hr', 'manager'), getAppraisals);

export default router;