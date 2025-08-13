import express from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Import controllers
import {
  uploadDocument,
  getDocuments,
  getDocument,
  downloadDocument,
  updateDocument,
  shareDocument,
  deleteDocument,
  getDocumentStats
} from '../controllers/documentController.js';

// Import middleware
import { protect, authorize } from '../middleware/authMiddleware.js';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // In a real app, you might want to store files in a specific directory
    // For GridFS, we don't actually need to save to disk, but multer requires a destination
    cb(null, '/tmp/uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

// File filter for allowed file types
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/gif'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only document and image files are allowed.'), false);
  }
};

// Initialize upload middleware
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 1 // Single file upload
  },
  fileFilter
});

// Apply authentication middleware to all routes
router.use(protect);

// Routes for /api/v1/documents
router
  .route('/')
  .get(authorize('admin', 'hr', 'manager', 'employee'), getDocuments)
  .post(
    authorize('admin', 'hr', 'manager', 'employee'),
    upload.single('file'),
    (err, req, res, next) => {
      // Handle multer errors
      if (err) {
        return res.status(400).json({
          success: false,
          error: err.message
        });
      }
      next();
    },
    uploadDocument
  );

// Routes for /api/v1/documents/stats
router
  .route('/stats')
  .get(authorize('admin', 'hr'), getDocumentStats);

// Routes for /api/v1/documents/download/:id
router
  .route('/download/:id')
  .get(authorize('admin', 'hr', 'manager', 'employee'), downloadDocument);

// Routes for /api/v1/documents/:id
router
  .route('/:id')
  .get(authorize('admin', 'hr', 'manager', 'employee'), getDocument)
  .put(authorize('admin', 'hr', 'manager', 'employee'), updateDocument)
  .delete(authorize('admin', 'hr', 'manager'), deleteDocument);

// Routes for /api/v1/documents/:id/share
router
  .route('/:id/share')
  .put(authorize('admin', 'hr', 'manager'), shareDocument);

export default router;