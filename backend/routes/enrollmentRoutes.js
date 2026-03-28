const express = require('express');
const router = express.Router();
const {
  enrollEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee
} = require('../controllers/enrollmentController');
const { protect, adminOnly } = require('../middleware/auth');
const { validateEnrollment } = require('../middleware/validation');

router.post('/enroll', protect, adminOnly, validateEnrollment, enrollEmployee);
router.get('/employees', protect, getEmployees);
router.get('/employees/:id', protect, getEmployeeById);
router.put('/employees/:id', protect, adminOnly, updateEmployee);
router.delete('/employees/:id', protect, adminOnly, deleteEmployee);

module.exports = router;