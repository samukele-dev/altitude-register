const axios = require('axios');

const BRIDGE_URL = 'http://localhost:8090';

async function test() {
  console.log('🔐 Testing Fingerprint Bridge\n');
  console.log('Make sure the bridge is running in another terminal!');
  console.log('Bridge should show: "✅ Server started on http://localhost:8090/"\n');
  
  try {
    // 1. Test health
    console.log('1. Testing health endpoint...');
    const health = await axios.get(`${BRIDGE_URL}/health`);
    console.log('   ✅', health.data);
    
    // 2. Test registration
    console.log('\n2. Testing registration...');
    const fakeTemplate = "Rk1SACAyMAAAAAD2AAABkAH0AMUAxQEAAABWJECjAMiFYEDPAQJvUkDJAIBwUYEgAIdpUUDEAG3qTkDEAWFcTkCrARn+SkDOATplSEDZAKPrR4CuAQyLRkCrASh+RUDDAUV9RYD8ARDkQ4EpASBfQ4E/AOhkQoCpATXwQUC3AS+WQIC4ASqJPkC9ARnrO0DEATNpO0CjAWE1OkCTASSgOICTAUq1OECtAWVFN4CeAVi9NgCbASOUNQC+AVrhMQCbATmdMACTAUS3MACpAVH9LwCkAS0HLgCjAU8DLgCYAIR5LQC/AVBhLQCeASigLAC1AR6DKQAA";
    
    const register = await axios.post(`${BRIDGE_URL}/register`, {
      template: fakeTemplate,
      id: 888
    });
    console.log('   ✅', register.data);
    
    // 3. Test identification
    console.log('\n3. Testing identification...');
    const identify = await axios.post(`${BRIDGE_URL}/identify`, {
      template: fakeTemplate
    });
    console.log('   ✅', identify.data);
    
    // 4. Get count
    console.log('\n4. Getting template count...');
    const count = await axios.get(`${BRIDGE_URL}/count`);
    console.log('   ✅', count.data);
    
    console.log('\n🎉 All tests passed! Bridge is ready.');
    console.log('\n📋 Bridge endpoints:');
    console.log('   GET  /health  - Check status');
    console.log('   POST /register - Register fingerprint (requires template + id)');
    console.log('   POST /identify - Identify fingerprint (requires template)');
    console.log('   GET  /count   - Get number of templates');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Bridge is not running! Start it with:');
      console.log('   cd C:\\Users\\Admin\\Documents\\personal\\altitude register system\\altitude-register\\fingerprint-bridge\\FingerprintBridge');
      console.log('   dotnet run');
    }
  }
}

test();