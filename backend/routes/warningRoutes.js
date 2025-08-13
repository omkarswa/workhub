import express from 'express';
import { check } from 'express-validator';

const router = express.Router();

// Import controllers
import {
  getWarnings,
  getWarning,
  createWarning,
  updateWarning,
  deleteWarning,
  resolveWarning,
  escalateWarning,
  withdrawWarning,
  getEmployeeWarnings,
  getActiveWarnings
} from '../controllers/warningController.js';

// Import middleware
import { protect, authorize } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';

// Validation schemas
const createWarningSchema = [
  check('employee', 'Employee ID is required').isMongoId(),
  check('type', 'Warning type is required').not().isEmpty(),
  check('title', 'Title is required').not().isEmpty(),
  check('description', 'Description is required').not().isEmpty(),
  check('severity', 'Valid severity level is required').isIn(['low', 'medium', 'high', 'critical']),
  check('validUntil', 'Valid until date is required').isISO8601().toDate()
];

const updateWarningSchema = [
  check('type', 'Warning type is required').optional().not().isEmpty(),
  check('title', 'Title is required').optional().not().isEmpty(),
  check('description', 'Description is required').optional().not().isEmpty(),
  check('severity', 'Valid severity level is required').optional().isIn(['low', 'medium', 'high', 'critical']),
  check('status', 'Valid status is required').optional().isIn(['active', 'resolved', 'escalated', 'withdrawn']),
  check('validUntil', 'Valid date is required').optional().isISO8601().toDate()
];

const actionSchema = [
  check('notes', 'Notes are required').optional().isString(),
  check('reason', 'Reason is required for withdrawal').if(
    (value, { req }) => req.path.includes('withdraw')
  ).not().isEmpty()
];

// Apply authentication middleware to all routes
router.use(protect);

// Routes for /api/v1/warnings
router
  .route('/')
  .get(authorize('admin', 'hr', 'manager'), getWarnings)
  .post(authorize('admin', 'hr', 'manager'), validateRequest(createWarningSchema), createWarning);

// Routes for /api/v1/warnings/active
router
  .route('/active')
  .get(authorize('admin', 'hr', 'manager'), getActiveWarnings);

// Routes for /api/v1/warnings/employee/:employeeId
router
  .route('/employee/:employeeId')
  .get(authorize('admin', 'hr', 'manager'), getEmployeeWarnings);

// Routes for /api/v1/warnings/:id
router
  .route('/:id')
  .get(authorize('admin', 'hr', 'manager'), getWarning)
  .put(authorize('admin', 'hr', 'manager'), validateRequest(updateWarningSchema), updateWarning)
  .delete(authorize('admin', 'hr'), deleteWarning);

// Routes for /api/v1/warnings/:id/resolve
router
  .route('/:id/resolve')
  .put(authorize('admin', 'hr', 'manager'), validateRequest(actionSchema), resolveWarning);

// Routes for /api/v1/warnings/:id/escalate
router
  .route('/:id/escalate')
  .put(authorize('admin', 'hr', 'manager'), validateRequest(actionSchema), escalateWarning);

// Routes for /api/v1/warnings/:id/withdraw
router
  .route('/:id/withdraw')
  .put(authorize('admin', 'hr'), validateRequest(actionSchema), withdrawWarning);

export default router;