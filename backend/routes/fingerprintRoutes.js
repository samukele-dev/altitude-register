const express = require('express');
const router = express.Router();
const fingerprintService = require('../services/fingerprintService');

// Get fingerprint scanner status
router.get('/status', async (req, res) => {
  try {
    const status = fingerprintService.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Capture single fingerprint scan (for multi-scan process)
router.post('/capture-single', async (req, res) => {
  try {
    const result = await fingerprintService.captureSingleFingerprint();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Capture multiple scans (legacy)
router.post('/capture', async (req, res) => {
  try {
    const result = await fingerprintService.captureFingerprint();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;