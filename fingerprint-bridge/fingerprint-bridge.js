const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const hidBridge = require('./hid-bridge');

dotenv.config();

const app = express();
const PORT = process.env.BRIDGE_PORT || 3002;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', async (req, res) => {
  const status = hidBridge.getStatus();
  res.json({
    status: 'OK',
    service: 'HID DigitalPersona 5300 Bridge',
    connected: status.connected,
    apiEndpoint: status.apiEndpoint,
    error: status.error,
    timestamp: new Date().toISOString()
  });
});

// Capture fingerprint endpoint
app.post('/capture', async (req, res) => {
  console.log('📱 Fingerprint capture requested');
  
  try {
    const result = await hidBridge.captureFingerprint();
    
    if (result.success) {
      console.log(`✅ Fingerprint captured. Quality: ${result.quality}%`);
      res.json({
        success: true,
        template: result.template,
        quality: result.quality,
        message: result.message
      });
    } else {
      console.error('❌ Capture failed:', result.error);
      res.status(500).json({
        success: false,
        error: result.error,
        message: result.message
      });
    }
  } catch (error) {
    console.error('❌ Bridge error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Bridge service error'
    });
  }
});

// Reconnect endpoint
app.post('/reconnect', async (req, res) => {
  console.log('🔄 Attempting to reconnect...');
  await hidBridge.close();
  const connected = await hidBridge.connect();
  res.json({
    success: connected,
    connected: connected,
    message: connected ? 'Reconnected successfully' : 'Failed to reconnect'
  });
});

// Status endpoint
app.get('/status', async (req, res) => {
  res.json(hidBridge.getStatus());
});

// Start server
app.listen(PORT, async () => {
  // Try to connect on startup
  const connected = await hidBridge.connect();
  
  console.log(`
╔══════════════════════════════════════════════════════════╗
║     🖐️ HID DigitalPersona 5300 Fingerprint Bridge       ║
╠══════════════════════════════════════════════════════════╣
║  Port: ${PORT}                                            ║
║  Status: Running                                         ║
║  Scanner: ${connected ? '✓ Connected' : '✗ Not connected'}  ║
║  API: https://127.0.0.1:8442/api/v1/fingerprint/capture  ║
║  Endpoints:                                              ║
║    POST /capture - Capture fingerprint                   ║
║    GET  /health   - Service health                       ║
║    GET  /status   - Scanner status                       ║
║    POST /reconnect - Reconnect scanner                   ║
╚══════════════════════════════════════════════════════════╝
  `);
  
  if (!connected) {
    console.log(`
💡 TROUBLESHOOTING:
   1. Make sure NetIQ Device Service is installed
   2. Test the scanner at: https://127.0.0.1:8442/api/v1/fingerprint/capture
   3. If that works, the bridge should connect
   4. If it doesn't, run: npm run reconnect
`);
  }
});