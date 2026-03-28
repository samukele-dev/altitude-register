const HID = require('node-hid');

console.log('🔍 Scanning for HID devices...\n');

const devices = HID.devices();

// Look for DigitalPersona devices
const fingerprintDevices = devices.filter(d => 
  d.vendorId === 0x05ba || 
  d.vendorId === 0x0c2e ||
  (d.product && d.product.toLowerCase().includes('digitalpersona'))
);

console.log(`Found ${fingerprintDevices.length} potential fingerprint devices:\n`);

fingerprintDevices.forEach(d => {
  console.log(`Device:`);
  console.log(`  Vendor ID: 0x${d.vendorId?.toString(16)}`);
  console.log(`  Product ID: 0x${d.productId?.toString(16)}`);
  console.log(`  Product: ${d.product || 'Unknown'}`);
  console.log(`  Manufacturer: ${d.manufacturer || 'Unknown'}`);
  console.log(`  Path: ${d.path}`);
  console.log('---');
});

if (fingerprintDevices.length === 0) {
  console.log('❌ No fingerprint devices found.');
  console.log('💡 Make sure drivers are installed.');
}