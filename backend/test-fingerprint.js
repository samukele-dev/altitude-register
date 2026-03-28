const fingerprintService = require('./services/fingerprintService');

async function test() {
  console.log('🔍 Testing fingerprint capture...\n');
  
  const initialized = await fingerprintService.initialize();
  if (!initialized) {
    console.log('❌ Could not initialize fingerprint reader');
    return;
  }
  
  console.log('📱 Please place your finger on the scanner...');
  const result = await fingerprintService.captureFingerprint();
  
  if (result.success) {
    console.log('\n✅ Success!');
    console.log(`   Quality: ${result.quality}%`);
    console.log(`   Template length: ${result.template.length}`);
    console.log(`   Hash: ${result.hash.substring(0, 32)}...`);
  } else {
    console.log('\n❌ Failed:', result.message);
  }
}

test();