const express = require('express');
const router = express.Router();
const {
  clockInOut,
  getTodayStatus,
  getLiveStatus,
  getEmployeeAttendance
} = require('../controllers/clockInController');
const { protect } = require('../middleware/auth');
const { validateClockIn } = require('../middleware/validation');

// Public route for clock in/out (no auth required, uses fingerprint)
router.post('/clock', validateClockIn, clockInOut);

// Protected routes
router.get('/today', protect, getTodayStatus);
router.get('/live', protect, getLiveStatus);
router.get('/attendance', protect, getEmployeeAttendance);

module.exports = router;