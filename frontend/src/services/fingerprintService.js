import axios from 'axios';

class FingerprintService {
  constructor() {
    this.isConnected = false;
    this.deviceModel = 'HID DigitalPersona 5300';
    this.backendUrl = 'http://localhost:5000/api/fingerprint';
    this.scans = [];
    this.onProgress = null;
  }

  setProgressCallback(callback) {
    this.onProgress = callback;
  }

  async initialize() {
    try {
      const response = await axios.get(`${this.backendUrl}/status`, { timeout: 3000 });
      if (response.data && response.data.connected) {
        this.isConnected = true;
        console.log('✅ Fingerprint scanner connected');
        return true;
      }
      throw new Error('Backend fingerprint service not available');
    } catch (error) {
      console.error('❌ Fingerprint scanner not available:', error.message);
      this.isConnected = false;
      return false;
    }
  }

  async captureSingleFingerprint(scanNumber) {
    try {
      // Send progress at start of scan
      if (this.onProgress) {
        this.onProgress({ 
          current: scanNumber - 1, 
          total: 3, 
          quality: 0, 
          status: 'scanning',
          message: `Place finger firmly on scanner...`
        });
      }
      
      const response = await axios.post(`${this.backendUrl}/capture-single`, {}, {
        timeout: 15000
      });
      
      if (response.data.success) {
        return {
          success: true,
          template: response.data.template,
          hash: response.data.hash,
          quality: response.data.quality
        };
      }
      throw new Error(response.data.message);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async captureFingerprint() {
    try {
      console.log('🖐️ Starting multi-scan fingerprint capture for enrollment...');
      
      if (!this.isConnected) {
        await this.initialize();
      }
      
      if (!this.isConnected) {
        throw new Error('Fingerprint scanner not available');
      }
      
      this.scans = [];
      let bestScan = null;
      let highestQuality = 0;
      
      for (let i = 1; i <= 3; i++) {
        console.log(`📱 Scan ${i}/3...`);
        
        const result = await this.captureSingleFingerprint(i);
        
        if (result.success) {
          this.scans.push(result);
          if (result.quality > highestQuality) {
            highestQuality = result.quality;
            bestScan = result;
          }
          console.log(`   ✅ Quality: ${result.quality}%`);
          
          // Send progress update after successful scan
          if (this.onProgress) {
            this.onProgress({ 
              current: i, 
              total: 3, 
              quality: result.quality, 
              status: 'success',
              message: `Scan ${i} complete! Quality: ${result.quality}%`
            });
          }
        } else {
          console.log(`   ❌ Failed: ${result.error}`);
          
          if (this.onProgress) {
            this.onProgress({ 
              current: i - 1, 
              total: 3, 
              quality: 0, 
              status: 'error',
              message: `Scan ${i} failed. Please try again.`
            });
          }
        }
        
        if (i < 5) await new Promise(r => setTimeout(r, 1000));
      }
      
      if (!bestScan) {
        throw new Error(`No successful captures (${this.scans.length}/5)`);
      }
      
      console.log(`✅ Best quality: ${highestQuality}% (${this.scans.length}/5 successful)`);
      
      return {
        success: true,
        template: bestScan.template,
        hash: bestScan.hash,
        quality: highestQuality,
        scans: this.scans.length,
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

  // Check if finger is present on scanner
  async checkFingerPresent() {
    try {
      // Quick check without full capture
      const response = await axios.get(`${this.backendUrl}/check-finger`, {
        timeout: 1000
      });
      return { fingerDetected: response.data.detected };
    } catch (error) {
      return { fingerDetected: false };
    }
  }

  async quickCaptureForClockIn() {
    try {
      if (!this.isConnected) {
        await this.initialize();
      }
      
      const response = await axios.post(`${this.backendUrl}/capture-single`, {}, {
        timeout: 15000
      });
      
      if (response.data.success) {
        return response.data;
      }
      throw new Error(response.data.message);
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to capture fingerprint. Please try again.'
      };
    }
  }

  getStatus() {
    return {
      connected: this.isConnected,
      deviceModel: this.deviceModel,
      fbiCertified: true,
      resolution: '500 dpi'
    };
  }
}

const fingerprintService = new FingerprintService();
export default fingerprintService;