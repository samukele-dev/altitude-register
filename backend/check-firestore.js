const { db } = require('./config/firebase');

async function checkFirestore() {
  console.log('🔍 Checking Firestore status...');
  
  try {
    // Try to list collections
    const collections = await db.listCollections();
    console.log(`✅ Found ${collections.length} collections`);
    
    collections.forEach(collection => {
      console.log(`   - ${collection.id}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('1. Go to Firebase Console → Firestore Database');
    console.log('2. Make sure database is created (not just enabled)');
    console.log('3. If not created, click "Create database"');
    console.log('4. Choose "Start in test mode"');
    console.log('5. Select location (try nam5 or us-central1 instead of africa-south1)');
  }
}

checkFirestore();