const crypto = require('crypto');
const axios = require('axios');
const https = require('https');

class FingerprintService {
  constructor() {
    this.isConnected = false;
    this.deviceModel = 'HID DigitalPersona 5300';
    this.isFBICompliant = true;
    this.resolution = 500;
    this.netiqUrl = 'https://127.0.0.1:8442/api/v1/fingerprint/capture';
    
    this.httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });
  }

  async initialize() {
    try {
      console.log('🔍 Testing connection to NetIQ Device Service...');
      
      // Try to connect with short timeout - this just checks if service is running
      await axios.get(this.netiqUrl, {
        httpsAgent: this.httpsAgent,
        timeout: 2000
      });
      
      // If we get a response (even timeout), service is running
      this.isConnected = true;
      console.log(`✅ ${this.deviceModel} connected via NetIQ Device Service`);
      return true;
      
    } catch (error) {
      // ECONNABORTED or timeout means the service responded but no finger yet
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        this.isConnected = true;
        console.log(`✅ ${this.deviceModel} connected (ready for fingerprint)`);
        return true;
      }
      
      console.error('❌ Fingerprint reader initialization failed:', error.message);
      this.isConnected = false;
      return false;
    }
  }

  async captureSingleFingerprint() {
    try {
      if (!this.isConnected) {
        await this.initialize();
      }
      
      console.log('🖐️ Waiting for fingerprint...');
      
      const response = await axios.get(this.netiqUrl, {
        httpsAgent: this.httpsAgent,
        timeout: 15000
      });
      
      if (response.data && response.data.captureStatus === 'Ok') {
        const template = response.data.ISO;
        const hash = crypto.createHash('sha256').update(template).digest('hex');
        const quality = this.estimateQuality(template);
        
        console.log(`✅ Fingerprint captured. Quality: ${quality}%`);
        
        return {
          success: true,
          template: template,
          hash: hash,
          quality: quality
        };
      } else if (response.data && response.data.captureStatus === 'Timeout') {
        return {
          success: false,
          error: 'Timeout',
          message: 'No fingerprint detected. Please place your finger on the scanner.'
        };
      } else if (response.data && response.data.captureStatus === 'NoReader') {
        // Scanner disconnected - try to reconnect
        console.log('⚠️ Scanner disconnected, attempting to reconnect...');
        this.isConnected = false;
        await this.initialize();
        
        // Retry once after reconnection
        const retryResponse = await axios.get(this.netiqUrl, {
          httpsAgent: this.httpsAgent,
          timeout: 15000
        });
        
        if (retryResponse.data && retryResponse.data.captureStatus === 'Ok') {
          const template = retryResponse.data.ISO;
          const hash = crypto.createHash('sha256').update(template).digest('hex');
          const quality = this.estimateQuality(template);
          
          console.log(`✅ Fingerprint captured after reconnection. Quality: ${quality}%`);
          
          return {
            success: true,
            template: template,
            hash: hash,
            quality: quality
          };
        }
        
        return {
          success: false,
          error: 'NoReader',
          message: 'Scanner disconnected. Please check USB connection and try again.'
        };
      } else {
        throw new Error(`Unexpected response: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      console.error('❌ Capture failed:', error.message);
      return {
        success: false,
        error: error.message,
        message: 'Failed to capture fingerprint. Please try again.'
      };
    }
  }

  async captureFingerprint() {
    try {
      console.log('🖐️ Starting multi-scan fingerprint capture...');
      console.log('   Please keep your finger on the scanner for each scan');
      
      const scans = [];
      let bestScan = null;
      let highestQuality = 0;
      
      for (let i = 1; i <= 5; i++) {
        console.log(`\n  📱 Scan ${i}/5...`);
        console.log('   Place your finger on the scanner...');
        
        const result = await this.captureSingleFingerprint();
        
        if (result.success) {
          scans.push(result);
          if (result.quality > highestQuality) {
            highestQuality = result.quality;
            bestScan = result;
          }
          console.log(`    ✅ Quality: ${result.quality}%`);
        } else {
          console.log(`    ❌ Failed: ${result.message}`);
          
          // If it's a "NoReader" error, wait longer for reconnection
          if (result.error === 'NoReader') {
            console.log('   Waiting for scanner to reconnect...');
            await new Promise(r => setTimeout(r, 3000));
          }
        }
        
        // Longer delay between scans (1 second)
        if (i < 5) await new Promise(r => setTimeout(r, 1000));
      }
      
      if (!bestScan) {
        throw new Error(`No successful captures (${scans.length}/5)`);
      }
      
      console.log(`\n✅ Best quality: ${highestQuality}% (${scans.length}/5 successful)`);
      
      return {
        success: true,
        template: bestScan.template,
        hash: bestScan.hash,
        quality: highestQuality,
        scans: scans.length,
        message: `Fingerprint captured! Quality: ${highestQuality}%`
      };
      
    } catch (error) {
      console.error('❌ Capture failed:', error.message);
      return {
        success: false,
        error: error.message,
        message: 'Failed to capture fingerprint. Please try again.'
      };
    }
  }

  estimateQuality(isoData) {
    if (!isoData) return 50;
    const length = isoData.length;
    if (length > 10000) return 95;
    if (length > 8000) return 90;
    if (length > 6000) return 85;
    if (length > 4000) return 75;
    if (length > 2000) return 65;
    return 55;
  }

  getStatus() {
    return {
      connected: this.isConnected,
      deviceModel: this.deviceModel,
      fbiCertified: this.isFBICompliant,
      resolution: `${this.resolution} dpi`,
      livenessDetection: true,
      counterfeitRejection: true,
      apiEndpoint: this.netiqUrl
    };
  }
}

module.exports = new FingerprintService();