const crypto = require('crypto');
const axios = require('axios');
const https = require('https');

class FingerprintService {
  constructor() {
    this.isConnected = false;
    this.deviceModel = 'HID DigitalPersona 5300';
    this.netiqUrl = 'https://127.0.0.1:8442/api/v1/fingerprint/capture';
    this.httpsAgent = new https.Agent({ rejectUnauthorized: false });
  }

  async initialize() {
    try {
      await axios.get(this.netiqUrl, {
        httpsAgent: this.httpsAgent,
        timeout: 2000
      });
      this.isConnected = true;
      console.log(`✅ ${this.deviceModel} connected`);
      return true;
    } catch (error) {
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        this.isConnected = true;
        return true;
      }
      this.isConnected = false;
      return false;
    }
  }

  // Capture a single fingerprint for clock-in
  async captureSingleFingerprint() {
    try {
      if (!this.isConnected) await this.initialize();
      
      const response = await axios.get(this.netiqUrl, {
        httpsAgent: this.httpsAgent,
        timeout: 15000
      });
      
      if (response.data && response.data.captureStatus === 'Ok') {
        const template = response.data.ISO;
        const hash = crypto.createHash('sha256').update(template).digest('hex');
        const quality = this.estimateQuality(template);
        
        return {
          success: true,
          template: template,
          hash: hash,
          quality: quality
        };
      }
      return { success: false, message: 'No fingerprint detected' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // NO CUSTOM MATCHING NEEDED - The Device Service handles verification
  // Just store and retrieve templates

estimateQuality(isoData) {
  if (!isoData) return 0;
  
  const length = isoData.length;
  
  // ISO 19794-2 templates typically range from 500-8000+ characters
  // Better fingerprints have more minutiae points -> longer templates
  
  if (length >= 4000) return 95;      // Excellent
  if (length >= 3000) return 90;      // Very good
  if (length >= 2500) return 85;      // Good
  if (length >= 2000) return 80;      // Above average
  if (length >= 1500) return 75;      // Average
  if (length >= 1200) return 70;      // Acceptable
  if (length >= 1000) return 65;      // Minimal acceptable
  if (length >= 800)  return 60;      // Low quality
  if (length >= 600)  return 55;      // Poor
  return 50;                           // Very poor - re-enrollment
}

  getStatus() {
    return {
      connected: this.isConnected,
      deviceModel: this.deviceModel,
      apiEndpoint: this.netiqUrl
    };
  }
}

module.exports = new FingerprintService();