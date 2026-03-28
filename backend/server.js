const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// Import services
const { db } = require('./config/firebase');
const fingerprintService = require('./services/fingerprintService');
const schedulerService = require('./services/schedulerService');
const fingerprintRoutes = require('./routes/fingerprintRoutes');


// Import routes
const enrollmentRoutes = require('./routes/enrollmentRoutes');
const clockRoutes = require('./routes/clockRoutes');
const reportRoutes = require('./routes/reportRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Debug: Check if fingerprintService is loaded correctly
console.log('🔍 Checking fingerprintService:');
console.log('  Type:', typeof fingerprintService);
console.log('  Methods:', Object.keys(fingerprintService));
console.log('  initialize:', typeof fingerprintService.initialize);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200
}));

// Compression
app.use(compression());

// Logging
app.use(morgan('dev'));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/fingerprint', fingerprintRoutes);


// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/enrollment', enrollmentRoutes);
app.use('/api/clock', clockRoutes);
app.use('/api/reports', reportRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await db.collection('test').doc('health').set({ timestamp: new Date().toISOString() });
    await db.collection('test').doc('health').delete();
    
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        fingerprintReader: fingerprintService.getStatus(),
        scheduler: 'running'
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      error: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Start server
const startServer = async () => {
  try {
    // Initialize fingerprint reader
    if (fingerprintService && typeof fingerprintService.initialize === 'function') {
      await fingerprintService.initialize();
    } else {
      console.error('❌ fingerprintService is not properly loaded');
    }
    
    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════════╗
║     🚀 Altitude Register System - Backend Server        ║
╠══════════════════════════════════════════════════════════╣
║  Port: ${PORT}                                            ║
║  Environment: ${process.env.NODE_ENV}                      ║
║  Firebase: Connected                                     ║
║  Fingerprint Reader: ${fingerprintService?.isConnected ? '✓' : '✗'} HID DigitalPersona 5300  ║
║  Status: Running                                         ║
╚══════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();