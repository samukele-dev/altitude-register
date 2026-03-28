const express = require('express');
const router = express.Router();
const {
  login,
  getCurrentUser,
  changePassword
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { validateLogin } = require('../middleware/validation');

// Test route to verify router is working
router.get('/test', (req, res) => {
  res.json({ message: 'Auth router is working!' });
});

router.post('/login', validateLogin, login);
router.get('/me', protect, getCurrentUser);
router.put('/change-password', protect, changePassword);

console.log('✅ Auth routes loaded:');
console.log('   - POST /api/auth/login');
console.log('   - GET /api/auth/me');
console.log('   - PUT /api/auth/change-password');

module.exports = router;