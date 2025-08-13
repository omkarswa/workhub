import express from 'express';

const router = express.Router();

// Import controller (CommonJS interop)
import authController from '../controllers/authController.js';

// Test route
router.get('/', (req, res) => {
  res.send('Auth route working ✅');
});

// Auth routes
// Register a new user
router.post('/register', authController.register);

// Login and receive JWT
router.post('/login', authController.login);

export default router;
