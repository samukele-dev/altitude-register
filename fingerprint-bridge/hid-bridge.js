/**
 * HID DigitalPersona 5300 Bridge
 * Connects to the scanner via NetIQ Device Service API
 */

const axios = require('axios');
const https = require('https');

// NetIQ Device Service endpoints
const NETIQ_URL = 'https://127.0.0.1:8442/api/v1/fingerprint/capture';

let isConnectedFlag = false;  // Renamed to avoid conflict
let connectionError = null;

// Create HTTPS agent that ignores self-signed certificate errors
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

/**
 * Test connection to NetIQ Device Service
 */
async function testConnection() {
  try {
    console.log('🔍 Testing connection to NetIQ Device Service...');
    console.log('   URL:', NETIQ_URL);
    console.log('   Agent rejectUnauthorized: false');
    
    const response = await axios.get(NETIQ_URL, {
      httpsAgent,
      timeout: 100000,  // Increased timeout
      validateStatus: function (status) {
        return true; // Accept any status to see what's happening
      }
    });
    
    console.log('   Response status:', response.status);
    console.log('   Response data keys:', Object.keys(response.data || {}));
    
    if (response.data && (response.data.captureStatus === 'Ok' || response.data.captureStatus === 'Timeout')) {
      isConnectedFlag = true;
      connectionError = null;
      console.log('✅ NetIQ Device Service is reachable');
      return true;
    }
    
    throw new Error(`Invalid response: ${JSON.stringify(response.data)}`);
  } catch (error) {
    console.error('   Error details:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      data: error.response?.data
    });
    isConnectedFlag = false;
    connectionError = error.message;
    return false;
  }
}

/**
 * Capture fingerprint from the scanner
 */
async function captureFingerprint() {
  try {
    // Ensure we're connected
    if (!isConnectedFlag) {
      const connected = await testConnection();
      if (!connected) {
        return {
          success: false,
          error: 'NetIQ Device Service not available',
          message: 'Please make sure the fingerprint scanner is properly installed.'
        };
      }
    }
    
    console.log('🖐️ Waiting for fingerprint on HID DigitalPersona 5300...');
    console.log('   Place your finger on the scanner');
    
    // Call the NetIQ Device Service API
    const response = await axios.get(NETIQ_URL, {
      httpsAgent,
      timeout: 100000 // 10 second timeout
    });
    
    if (response.data && response.data.captureStatus === 'Ok') {
      const template = response.data.ISO;
      const quality = estimateQuality(template);
      
      console.log(`✅ Fingerprint captured successfully. Quality: ${quality}%`);
      
      return {
        success: true,
        template: template,
        quality: quality,
        message: 'Fingerprint captured successfully'
      };
    } else if (response.data && response.data.captureStatus === 'Timeout') {
      return {
        success: false,
        error: 'Timeout',
        message: 'No fingerprint detected. Please place your finger on the scanner.'
      };
    } else {
      throw new Error(`Unexpected response: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    console.error('❌ Capture error:', error.message);
    
    // Check if it's a timeout
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return {
        success: false,
        error: 'Timeout',
        message: 'No fingerprint detected. Please place your finger on the scanner.'
      };
    }
    
    return {
      success: false,
      error: error.message,
      message: 'Failed to capture fingerprint. Please try again.'
    };
  }
}

/**
 * Estimate fingerprint quality from ISO data
 */
function estimateQuality(isoData) {
  if (!isoData) return 50;
  
  // Rough quality estimation based on ISO data length
  const length = isoData.length;
  if (length > 100000) return 95;
  if (length > 8000) return 90;
  if (length > 6000) return 85;
  if (length > 4000) return 75;
  if (length > 2000) return 65;
  return 55;
}

/**
 * Check if device is connected (function name, not variable)
 */
function isConnected() {
  return isConnectedFlag;
}

/**
 * Get connection status
 */
function getStatus() {
  return {
    connected: isConnectedFlag,
    error: connectionError,
    apiEndpoint: NETIQ_URL
  };
}

/**
 * Close the connection
 */
async function close() {
  // Nothing to close for HTTP API
  isConnectedFlag = false;
}

module.exports = {
  connect: testConnection,
  captureFingerprint,
  isConnected,
  getStatus,
  close
};