const axios = require('axios');
const https = require('https');

const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

async function test() {
  console.log('🔍 Testing NetIQ Device Service...');
  
  try {
    const response = await axios.get('https://127.0.0.1:8442/api/v1/fingerprint/capture', {
      httpsAgent,
      timeout: 100000
    });
    
    console.log('✅ Connected!');
    console.log('Response:', response.data);
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
}

test();