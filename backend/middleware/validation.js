const { body, validationResult } = require('express-validator');

const validateEnrollment = [
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('employeeId').notEmpty().withMessage('Employee ID is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('idNumber').notEmpty().withMessage('ID number is required'),
  body('campaign').notEmpty().withMessage('Campaign is required'),
  body('team').notEmpty().withMessage('Team is required'),
  body('fingerprintTemplate').notEmpty().withMessage('Fingerprint is required'),
  body('fingerprintHash').notEmpty().withMessage('Fingerprint hash is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    next();
  }
];

const validateClockIn = [
  body('fingerprintHash').notEmpty().withMessage('Fingerprint data required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    next();
  }
];

const validateLogin = [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    next();
  }
];

module.exports = { validateEnrollment, validateClockIn, validateLogin };