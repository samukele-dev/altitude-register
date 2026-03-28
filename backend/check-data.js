const { db } = require('./config/firebase');

async function checkData() {
  console.log('🔍 Checking collection data...\n');
  
  // Check campaigns
  console.log('📁 CAMPAIGNS:');
  const campaigns = await db.collection('campaigns').get();
  campaigns.forEach(doc => {
    console.log(`  ${doc.id}:`, doc.data());
  });
  console.log(`  Total: ${campaigns.size}\n`);
  
  // Check teams
  console.log('📁 TEAMS:');
  const teams = await db.collection('teams').get();
  teams.forEach(doc => {
    console.log(`  ${doc.id}:`, doc.data());
  });
  console.log(`  Total: ${teams.size}\n`);
  
  // Check users
  console.log('👥 USERS:');
  const users = await db.collection('users').get();
  users.forEach(doc => {
    const user = doc.data();
    console.log(`  ${user.firstName} ${user.lastName} (${user.employeeId}):`);
    console.log(`    Campaign: ${user.campaign}`);
    console.log(`    Team: ${user.team}`);
    console.log(`    Role: ${user.role}`);
  });
  console.log(`  Total: ${users.size}`);
}

checkData();