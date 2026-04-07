const { db } = require('./config/firebase');

async function checkUsers() {
  console.log('🔍 Checking enrolled users...\n');
  
  const users = await db.collection('users').where('isActive', '==', true).get();
  
  console.log(`Found ${users.size} enrolled users:\n`);
  
  users.forEach(doc => {
    const user = doc.data();
    console.log(`📝 User: ${user.firstName} ${user.lastName}`);
    console.log(`   Employee ID: ${user.employeeId}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Campaign: ${user.campaign}`);
    console.log(`   Team: ${user.team}`);
    console.log(`   Fingerprint Hash: ${user.fingerprintHash?.substring(0, 20)}...`);
    console.log(`   Has Template: ${user.fingerprintTemplate ? 'Yes' : 'No'}`);
    console.log('---');
  });
}

checkUsers();