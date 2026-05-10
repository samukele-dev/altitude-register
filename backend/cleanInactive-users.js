const { db } = require('./config/firebase');

async function cleanupInactiveUsers() {
  console.log('🧹 Cleaning up inactive users...');
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const inactiveUsers = await db.collection('users')
    .where('isActive', '==', false)
    .where('updatedAt', '<', thirtyDaysAgo)
    .get();
  
  console.log(`Found ${inactiveUsers.size} inactive users older than 30 days`);
  
  let deleted = 0;
  for (const doc of inactiveUsers.docs) {
    await doc.ref.delete();
    deleted++;
    console.log(`  Deleted: ${doc.id}`);
  }
  
  console.log(`✅ Deleted ${deleted} inactive users permanently`);
}

cleanupInactiveUsers();