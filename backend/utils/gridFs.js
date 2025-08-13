const mongoose = require('mongoose');
const { GridFSBucket, ObjectId } = require('mongodb');
const { Readable } = require('stream');
const path = require('path');
const mime = require('mime-types');
const { NotFoundError, BadRequestError } = require('./errorHandler');

// Initialize GridFS bucket
let gfs;
let gridFSBucket;

// Initialize GridFS
const initGridFS = () => {
  // Create a new connection if not already created
  const conn = mongoose.connection;
  
  // Initialize the GridFS bucket
  gridFSBucket = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: 'documents'
  });
  
  // Set gfs for backward compatibility
  gfs = gridFSBucket;
  
  return { gfs, gridFSBucket };
};

/**
 * Upload a file to GridFS
 * @param {Object} file - The file object from multer
 * @param {Object} metadata - Additional metadata to store with the file
 * @returns {Promise<Object>} - The file info with _id, filename, etc.
 */
const uploadFile = (file, metadata = {}) => {
  return new Promise((resolve, reject) => {
    if (!file || !file.buffer) {
      return reject(new BadRequestError('No file data provided'));
    }
    
    const filename = file.originalname;
    const contentType = mime.lookup(filename) || 'application/octet-stream';
    
    // Create a readable stream from the buffer
    const readableStream = new Readable();
    readableStream.push(file.buffer);
    readableStream.push(null); // Signals the end of the stream
    
    // Create an upload stream
    const uploadStream = gridFSBucket.openUploadStream(filename, {
      contentType,
      metadata: {
        ...metadata,
        originalName: filename,
        uploadDate: new Date(),
        size: file.size,
        mimetype: file.mimetype || contentType
      }
    });
    
    // Handle upload completion
    uploadStream.on('finish', (fileInfo) => {
      resolve({
        id: fileInfo._id,
        filename: fileInfo.filename,
        contentType: fileInfo.contentType,
        size: fileInfo.length,
        uploadDate: fileInfo.uploadDate,
        metadata: fileInfo.metadata || {}
      });
    });
    
    // Handle errors
    uploadStream.on('error', (error) => {
      reject(new Error(`Failed to upload file: ${error.message}`));
    });
    
    // Pipe the file data into the upload stream
    readableStream.pipe(uploadStream);
  });
};

/**
 * Download a file from GridFS by file ID
 * @param {String} fileId - The ID of the file to download
 * @returns {Promise<Object>} - The file info and download stream
 */
const downloadFile = (fileId) => {
  return new Promise((resolve, reject) => {
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return reject(new BadRequestError('Invalid file ID'));
    }
    
    const fileIdObj = new ObjectId(fileId);
    
    // Find the file metadata
    const filesCollection = mongoose.connection.db.collection('documents.files');
    filesCollection.findOne({ _id: fileIdObj }, (err, file) => {
      if (err || !file) {
        return reject(new NotFoundError('File not found'));
      }
      
      // Create a download stream
      const downloadStream = gridFSBucket.openDownloadStream(fileIdObj);
      
      resolve({
        filename: file.filename,
        contentType: file.contentType || 'application/octet-stream',
        size: file.length,
        uploadDate: file.uploadDate,
        metadata: file.metadata || {},
        stream: downloadStream
      });
    });
  });
};

/**
 * Delete a file from GridFS by file ID
 * @param {String} fileId - The ID of the file to delete
 * @returns {Promise<Boolean>} - True if deletion was successful
 */
const deleteFile = (fileId) => {
  return new Promise((resolve, reject) => {
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return reject(new BadRequestError('Invalid file ID'));
    }
    
    const fileIdObj = new ObjectId(fileId);
    
    gridFSBucket.delete(fileIdObj, (err) => {
      if (err) {
        if (err.message.includes('FileNotFound')) {
          return reject(new NotFoundError('File not found'));
        }
        return reject(new Error(`Failed to delete file: ${err.message}`));
      }
      resolve(true);
    });
  });
};

/**
 * Get file metadata by ID
 * @param {String} fileId - The ID of the file
 * @returns {Promise<Object>} - The file metadata
 */
const getFileMetadata = (fileId) => {
  return new Promise((resolve, reject) => {
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return reject(new BadRequestError('Invalid file ID'));
    }
    
    const fileIdObj = new ObjectId(fileId);
    
    const filesCollection = mongoose.connection.db.collection('documents.files');
    filesCollection.findOne({ _id: fileIdObj }, (err, file) => {
      if (err || !file) {
        return reject(new NotFoundError('File not found'));
      }
      
      resolve({
        id: file._id,
        filename: file.filename,
        contentType: file.contentType,
        size: file.length,
        uploadDate: file.uploadDate,
        metadata: file.metadata || {}
      });
    });
  });
};

/**
 * Find files by metadata
 * @param {Object} query - The query object to filter files
 * @returns {Promise<Array>} - Array of file metadata objects
 */
const findFilesByMetadata = (query = {}) => {
  return new Promise((resolve, reject) => {
    const filesCollection = mongoose.connection.db.collection('documents.files');
    
    // Build the query
    const mongoQuery = {};
    
    // Handle filename search
    if (query.filename) {
      mongoQuery.filename = { $regex: query.filename, $options: 'i' };
    }
    
    // Handle content type filter
    if (query.contentType) {
      mongoQuery.contentType = query.contentType;
    }
    
    // Handle metadata filters
    if (query.metadata) {
      Object.keys(query.metadata).forEach(key => {
        mongoQuery[`metadata.${key}`] = query.metadata[key];
      });
    }
    
    // Execute the query
    filesCollection.find(mongoQuery).toArray((err, files) => {
      if (err) {
        return reject(new Error(`Failed to find files: ${err.message}`));
      }
      
      const result = files.map(file => ({
        id: file._id,
        filename: file.filename,
        contentType: file.contentType,
        size: file.length,
        uploadDate: file.uploadDate,
        metadata: file.metadata || {}
      }));
      
      resolve(result);
    });
  });
};

module.exports = {
  initGridFS,
  uploadFile,
  downloadFile,
  deleteFile,
  getFileMetadata,
  findFilesByMetadata,
  gfs: () => gfs, // For backward compatibility
  bucket: () => gridFSBucket
};