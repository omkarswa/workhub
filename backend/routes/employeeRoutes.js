import express from 'express';
import { check } from 'express-validator';

const router = express.Router();

// Import controllers
import {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  uploadDocument,
  verifyDocument,
  getEmployeeDocuments,
  issueWarning,
  getEmployeeWarnings,
  updateEmployeeStatus,
  getEmployeeStats,
  getTeamMembers
} from '../controllers/employeeController.js';

// Import middleware
import { protect, authorize } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';

// Validation schemas
const createEmployeeSchema = [
  check('user', 'User ID is required').not().isEmpty(),
  check('employeeId', 'Employee ID is required').not().isEmpty(),
  check('department', 'Department is required').not().isEmpty(),
  check('designation', 'Designation is required').not().isEmpty(),
  check('joiningDate', 'Joining date is required').isISO8601().toDate(),
  check('dateOfBirth', 'Date of birth is required').isISO8601().toDate(),
  check('gender', 'Gender is required').isIn(['male', 'female', 'other', 'prefer_not_to_say']),
  check('phoneNumber', 'Valid phone number is required').matches(/^[0-9]{10}$/)
];

const updateEmployeeSchema = [
  check('phoneNumber', 'Valid phone number is required').optional().matches(/^[0-9]{10}$/),
  check('maritalStatus', 'Invalid marital status').optional().isIn(['single', 'married', 'divorced', 'widowed', 'separated']),
  check('bloodGroup', 'Invalid blood group').optional().isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  check('employmentType', 'Invalid employment type').optional().isIn(['full-time', 'part-time', 'contract', 'internship', 'temporary']),
  check('status', 'Invalid status').optional().isIn(['active', 'on_leave', 'inactive', 'terminated'])
];

const documentUploadSchema = [
  check('documentType', 'Document type is required').not().isEmpty(),
  check('description', 'Description is required').not().isEmpty()
];

const warningSchema = [
  check('type', 'Warning type is required').not().isEmpty(),
  check('severity', 'Severity level is required').isIn(['low', 'medium', 'high', 'critical']),
  check('description', 'Description is required').not().isEmpty(),
  check('dateIssued', 'Date issued is required').isISO8601().toDate(),
  check('validUntil', 'Valid until date is required').isISO8601().toDate()
];

const statusUpdateSchema = [
  check('status', 'Status is required').isIn(['active', 'on_leave', 'inactive', 'terminated']),
  check('effectiveDate', 'Effective date is required').isISO8601().toDate(),
  check('reason', 'Reason is required').not().isEmpty()
];

// Apply authentication middleware to all routes
router.use(protect);

// Routes for /api/v1/employees
router
  .route('/')
  .get(authorize('admin', 'hr', 'manager'), getEmployees)
  .post(authorize('admin', 'hr'), validateRequest(createEmployeeSchema), createEmployee);

// Routes for /api/v1/employees/stats
router
  .route('/stats')
  .get(authorize('admin', 'hr'), getEmployeeStats);

// Routes for /api/v1/employees/me
router
  .route('/me')
  .get(authorize('admin', 'hr', 'manager', 'employee'), getEmployee);

// Routes for /api/v1/employees/team
router
  .route('/team')
  .get(authorize('admin', 'hr', 'manager'), getTeamMembers);

// Routes for /api/v1/employees/:id
router
  .route('/:id')
  .get(authorize('admin', 'hr', 'manager', 'employee'), getEmployee)
  .put(authorize('admin', 'hr'), validateRequest(updateEmployeeSchema), updateEmployee)
  .delete(authorize('admin', 'hr'), deleteEmployee);

// Routes for /api/v1/employees/:id/status
router
  .route('/:id/status')
  .put(authorize('admin', 'hr'), validateRequest(statusUpdateSchema), updateEmployeeStatus);

// Routes for /api/v1/employees/:id/documents
router
  .route('/:id/documents')
  .get(authorize('admin', 'hr', 'manager', 'employee'), getEmployeeDocuments)
  .post(
    authorize('admin', 'hr', 'manager', 'employee'),
    upload.single('document'),
    validateRequest(documentUploadSchema),
    uploadDocument
  );

// Routes for /api/v1/employees/documents/:documentId/verify
router
  .route('/documents/:documentId/verify')
  .put(authorize('admin', 'hr'), verifyDocument);

// Routes for /api/v1/employees/:id/warnings
router
  .route('/:id/warnings')
  .get(authorize('admin', 'hr', 'manager'), getEmployeeWarnings)
  .post(authorize('admin', 'hr', 'manager'), validateRequest(warningSchema), issueWarning);

export default router;