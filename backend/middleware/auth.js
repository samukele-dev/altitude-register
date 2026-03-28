const jwt = require('jsonwebtoken');
const { db } = require('../config/firebase');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const userDoc = await db.collection('users').doc(decoded.id).get();
      
      if (!userDoc.exists) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }
      
      req.user = {
        id: userDoc.id,
        ...userDoc.data()
      };
      next();
    } catch (error) {
      console.error('Auth error:', error);
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token failed'
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token'
    });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Not authorized as admin'
    });
  }
};

const teamLeaderOnly = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'team_leader')) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Not authorized as team leader'
    });
  }
};

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

module.exports = { protect, adminOnly, teamLeaderOnly, generateToken };