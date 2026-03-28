const { db } = require('./config/firebase');

async function diagnose() {
  console.log('🔍 Diagnosing Firestore connection...\n');
  
  try {
    // Check if db is initialized
    if (!db) {
      console.log('❌ db is null - Firebase not initialized');
      return;
    }
    
    console.log('✅ db object exists');
    
    // Try to list collections (this will fail if database doesn't exist)
    try {
      const collections = await db.listCollections();
      console.log(`✅ Found ${collections.length} collections`);
      collections.forEach(col => console.log(`   - ${col.id}`));
    } catch (error) {
      console.log(`❌ Cannot list collections: ${error.message}`);
      
      if (error.message.includes('NOT_FOUND')) {
        console.log('\n💡 The database exists but cannot be accessed.');
        console.log('This usually means:');
        console.log('1. The database location (africa-south1) might need special configuration');
        console.log('2. The service account might not have permission for this region');
      }
    }
    
    // Try to write to a test collection
    console.log('\n📝 Attempting to write to a test collection...');
    try {
      await db.collection('_system_test').doc('test').set({
        timestamp: new Date().toISOString(),
        message: 'Test write'
      });
      console.log('✅ Write successful!');
      
      // Clean up
      await db.collection('_system_test').doc('test').delete();
      console.log('✅ Cleanup successful');
      
    } catch (writeError) {
      console.log(`❌ Write failed: ${writeError.message}`);
      
      if (writeError.message.includes('NOT_FOUND')) {
        console.log('\n💡 SOLUTION: The database needs to be created in Firebase Console');
        console.log('Steps:');
        console.log('1. Go to: https://console.firebase.google.com/');
        console.log('2. Select your project: altitude-register-system');
        console.log('3. Click "Firestore Database" in left menu');
        console.log('4. Click "Create database"');
        console.log('5. Choose "Start in test mode"');
        console.log('6. Select location: "nam5 (us-central)" (africa-south1 has issues)');
        console.log('7. Click "Enable"');
        console.log('8. Wait 2 minutes for database to be created');
        console.log('9. Run this script again');
      }
    }
    
  } catch (error) {
    console.error('Diagnose error:', error.message);
  }
}

diagnose();