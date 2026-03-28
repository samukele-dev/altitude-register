import axios from 'axios';

class FingerprintService {
  constructor() {
    this.isConnected = false;
    this.deviceModel = 'HID DigitalPersona 5300';
    this.backendUrl = 'http://localhost:5000/api/fingerprint';
    this.scans = [];
  }

  async initialize() {
    try {
      console.log('🔍 Initializing fingerprint service...');
      const response = await axios.get(`${this.backendUrl}/status`, { timeout: 3000 });
      console.log('📡 Status response:', response.data);
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

  async captureSingleScan() {
    try {
      console.log('📱 Capturing single fingerprint scan...');
      const response = await axios.post(`${this.backendUrl}/capture-single`, {}, {
        timeout: 100000
      });
      
      console.log('📡 Capture response:', response.data);
      
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
      console.error('❌ Single scan failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async captureFingerprint() {
    try {
      console.log('🖐️ Starting fingerprint capture process...');
      
      if (!this.isConnected) {
        console.log('Not connected, initializing...');
        await this.initialize();
      }
      
      if (!this.isConnected) {
        throw new Error('Fingerprint scanner not available');
      }
      
      this.scans = [];
      let bestScan = null;
      let highestQuality = 0;
      
      // Capture 5 scans
      for (let i = 1; i <= 5; i++) {
        console.log(`📱 Scan ${i}/5...`);
        
        const result = await this.captureSingleScan();
        
        if (result.success) {
          this.scans.push(result);
          console.log(`   ✅ Quality: ${result.quality}%`);
          if (result.quality > highestQuality) {
            highestQuality = result.quality;
            bestScan = result;
          }
        } else {
          console.log(`   ❌ Failed: ${result.error}`);
        }
        
        // Small delay between scans
        if (i < 5) await new Promise(r => setTimeout(r, 800));
      }
      
      if (!bestScan) {
        throw new Error('No successful fingerprint captures');
      }
      
      console.log(`✅ Capture complete! Best quality: ${highestQuality}%`);
      
      return {
        success: true,
        template: bestScan.template,
        hash: bestScan.hash,
        quality: highestQuality,
        scans: this.scans.length,
        allScans: this.scans,
        message: `Fingerprint captured! Best quality: ${highestQuality}%`
      };
      
    } catch (error) {
      console.error('❌ Fingerprint capture failed:', error.message);
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