const axios = require('axios');
const https = require('https');

// Create agent that ignores certificate errors
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: false
});

async function testDirect() {
  console.log('🔍 Testing direct connection to NetIQ API...');
  
  try {
    const response = await axios({
      method: 'get',
      url: 'https://127.0.0.1:8442/api/v1/fingerprint/capture',
      httpsAgent: httpsAgent,
      timeout: 100000,
      headers: {
        'User-Agent': 'Node.js Bridge Test'
      }
    });
    
    console.log('✅ Connection successful!');
    console.log('Response:', response.data);
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    if (error.code) console.error('Code:', error.code);
    if (error.response) console.error('Response status:', error.response.status);
  }
}

testDirect();