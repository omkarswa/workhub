import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import { ErrorResponse } from '../utils/errorResponse.js';

const { Types: { ObjectId } } = mongoose;

// Initialize GridFS bucket
let gfs;
const conn = mongoose.connection;
conn.once('open', () => {
  gfs = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: 'documents',
  });
});

// @desc    Upload a document
// @route   POST /api/v1/documents/upload
// @access  Private
const uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new ErrorResponse('Please upload a file', 400));
    }

    const { originalname, mimetype, size, id: fileId } = req.file;
    const { documentType, description, isPublic } = req.body;

    // Create document metadata
    const document = {
      fileId: new ObjectId(fileId),
      filename: originalname,
      mimetype,
      size,
      documentType: documentType || 'other',
      description: description || '',
      isPublic: isPublic === 'true',
      uploadedBy: req.user.id,
      department: req.user.department,
    };

    // Save document metadata to database
    const Document = mongoose.model('Document');
    const savedDoc = await Document.create(document);

    res.status(201).json({
      success: true,
      data: savedDoc,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all documents
// @route   GET /api/v1/documents
// @access  Private
const getDocuments = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, documentType, search, sort = '-createdAt' } = req.query;
    const query = { isDeleted: false };
    
    // Apply filters
    if (documentType) {
      query.documentType = documentType;
    }
    
    // Search by filename or description
    if (search) {
      query.$or = [
        { filename: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Only show public documents or those uploaded by the user
    if (req.user.role !== 'admin' && req.user.role !== 'hr') {
      query.$or = [
        { isPublic: true },
        { uploadedBy: req.user.id },
        { 'sharedWith.user': req.user.id }
      ];
      
      // If user is a manager, also show documents shared with their department
      if (req.user.role === 'manager') {
        query.$or.push({ department: req.user.department });
      }
    }

    const Document = mongoose.model('Document');
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort,
      populate: [
        { path: 'uploadedBy', select: 'firstName lastName email' },
        { path: 'sharedWith.user', select: 'firstName lastName email' }
      ]
    };

    const docs = await Document.paginate(query, options);
    
    res.status(200).json({
      success: true,
      count: docs.totalDocs,
      data: docs.docs,
      page: docs.page,
      pages: docs.totalPages,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single document
// @route   GET /api/v1/documents/:id
// @access  Private
const getDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const Document = mongoose.model('Document');
    const document = await Document.findOne({
      _id: id,
      isDeleted: false
    })
    .populate('uploadedBy', 'firstName lastName email')
    .populate('sharedWith.user', 'firstName lastName email');

    if (!document) {
      return next(new ErrorResponse(`Document not found with id of ${id}`, 404));
    }

    // Check permissions
    if (!isAuthorizedToView(document, req.user)) {
      return next(new ErrorResponse('Not authorized to access this document', 403));
    }

    res.status(200).json({
      success: true,
      data: document,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Download a document
// @route   GET /api/v1/documents/download/:id
// @access  Private
const downloadDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const Document = mongoose.model('Document');
    const document = await Document.findOne({
      _id: id,
      isDeleted: false
    });

    if (!document) {
      return next(new ErrorResponse(`Document not found with id of ${id}`, 404));
    }

    // Check permissions
    if (!isAuthorizedToView(document, req.user)) {
      return next(new ErrorResponse('Not authorized to access this document', 403));
    }

    // Set headers for file download
    res.set('Content-Type', document.mimetype);
    res.set('Content-Disposition', `attachment; filename="${document.filename}"`);
    
    // Stream the file from GridFS
    const downloadStream = gfs.openDownloadStream(document.fileId);
    
    downloadStream.on('error', (error) => {
      console.error('Error streaming file:', error);
      next(new ErrorResponse('Error downloading file', 500));
    });
    
    downloadStream.pipe(res);
  } catch (error) {
    next(error);
  }
};

// @desc    Update document metadata
// @route   PUT /api/v1/documents/:id
// @access  Private
const updateDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { filename, description, documentType, isPublic } = req.body;
    
    const Document = mongoose.model('Document');
    let document = await Document.findById(id);

    if (!document) {
      return next(new ErrorResponse(`Document not found with id of ${id}`, 404));
    }

    // Check ownership or admin/HR access
    if (document.uploadedBy.toString() !== req.user.id && 
        req.user.role !== 'admin' && 
        req.user.role !== 'hr') {
      return next(new ErrorResponse('Not authorized to update this document', 403));
    }

    // Update fields
    if (filename) document.filename = filename;
    if (description) document.description = description;
    if (documentType) document.documentType = documentType;
    if (isPublic !== undefined) document.isPublic = isPublic === 'true';
    
    document.updatedAt = Date.now();
    
    await document.save();

    res.status(200).json({
      success: true,
      data: document,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Share document with users
// @route   PUT /api/v1/documents/:id/share
// @access  Private
const shareDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userIds, permission = 'view' } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return next(new ErrorResponse('Please provide user IDs to share with', 400));
    }

    const Document = mongoose.model('Document');
    const document = await Document.findById(id);

    if (!document) {
      return next(new ErrorResponse(`Document not found with id of ${id}`, 404));
    }

    // Check ownership or admin/HR access
    if (document.uploadedBy.toString() !== req.user.id && 
        req.user.role !== 'admin' && 
        req.user.role !== 'hr') {
      return next(new ErrorResponse('Not authorized to share this document', 403));
    }

    // Add users to sharedWith array if not already present
    const existingUserIds = document.sharedWith.map(share => share.user.toString());
    const newShares = [];

    for (const userId of userIds) {
      if (!existingUserIds.includes(userId)) {
        newShares.push({
          user: userId,
          permission,
          sharedAt: Date.now(),
          sharedBy: req.user.id
        });
      }
    }

    if (newShares.length > 0) {
      document.sharedWith.push(...newShares);
      await document.save();
    }

    res.status(200).json({
      success: true,
      data: document,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a document
// @route   DELETE /api/v1/documents/:id
// @access  Private
const deleteDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const Document = mongoose.model('Document');
    const document = await Document.findById(id);

    if (!document) {
      return next(new ErrorResponse(`Document not found with id of ${id}`, 404));
    }

    // Only allow deletion by owner, admin, or HR
    if (document.uploadedBy.toString() !== req.user.id && 
        req.user.role !== 'admin' && 
        req.user.role !== 'hr') {
      return next(new ErrorResponse('Not authorized to delete this document', 403));
    }

    // Soft delete
    document.isDeleted = true;
    document.deletedAt = Date.now();
    document.deletedBy = req.user.id;
    
    await document.save();

    // Optionally, you can also delete the file from GridFS
    // await gfs.delete(document.fileId);

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get document statistics
// @route   GET /api/v1/documents/stats
// @access  Private (Admin/HR)
const getDocumentStats = async (req, res, next) => {
  try {
    const Document = mongoose.model('Document');
    
    const stats = await Document.aggregate([
      {
        $match: { isDeleted: false }
      },
      {
        $group: {
          _id: '$documentType',
          count: { $sum: 1 },
          totalSize: { $sum: '$size' },
          avgSize: { $avg: '$size' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.status(200).json({
      success: true,
      count: stats.length,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to check if user is authorized to view a document
const isAuthorizedToView = (document, user) => {
  // Admin and HR can view all documents
  if (user.role === 'admin' || user.role === 'hr') {
    return true;
  }
  
  // Document owner can view
  if (document.uploadedBy.toString() === user.id) {
    return true;
  }
  
  // Check if document is public
  if (document.isPublic) {
    return true;
  }
  
  // Check if document is shared with user
  const isSharedWithUser = document.sharedWith.some(
    share => share.user.toString() === user.id
  );
  
  if (isSharedWithUser) {
    return true;
  }
  
  // Manager can view documents from their department
  if (user.role === 'manager' && document.department === user.department) {
    return true;
  }
  
  return false;
};

export {
  uploadDocument,
  getDocuments,
  getDocument,
  downloadDocument,
  updateDocument,
  shareDocument,
  deleteDocument,
  getDocumentStats
};