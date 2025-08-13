import mongoose from 'mongoose';
import { ErrorResponse } from '../utils/errorResponse.js';

// Set mongoose options
mongoose.set('strictQuery', true);

// Handle MongoDB connection events
mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB connected');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('ℹ️ MongoDB disconnected');
});

// Close the Mongoose connection when the Node process ends
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed through app termination');
  process.exit(0);
});

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      maxPoolSize: 10, // Maintain up to 10 socket connections
      retryWrites: true,
      w: 'majority'
    });

    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    
    // If this is a validation error, provide more details
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      throw new ErrorResponse(`Validation Error: ${messages.join(', ')}`, 400);
    }
    
    // Handle specific MongoDB errors
    if (error.name === 'MongoServerError' && error.code === 11000) {
      throw new ErrorResponse('Duplicate field value entered', 400);
    }
    
    // Handle connection timeouts
    if (error.name === 'MongooseServerSelectionError') {
      throw new ErrorResponse('Could not connect to the database. Please check your connection and try again.', 503);
    }
    
    throw new ErrorResponse('Database connection failed', 500);
  }
};

export { connectDB, mongoose };
