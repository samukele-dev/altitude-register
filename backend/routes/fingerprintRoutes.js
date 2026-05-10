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

router.get('/check-finger', async (req, res) => {
  try {
    // Quick check if finger is on scanner
    // This uses the NetIQ service's status endpoint
    const result = await fingerprintService.checkFingerPresent();
    res.json({ detected: result });
  } catch (error) {
    res.json({ detected: false });
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