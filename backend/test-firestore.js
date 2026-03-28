const { db } = require('./config/firebase');

async function test() {
  console.log('Testing Firestore connection...');
  
  try {
    // Try to write
    await db.collection('test').doc('connection').set({
      timestamp: new Date().toISOString(),
      message: 'Test'
    });
    console.log('✅ Write successful');
    
    // Try to read
    const doc = await db.collection('test').doc('connection').get();
    console.log('✅ Read successful:', doc.data());
    
    // Clean up
    await db.collection('test').doc('connection').delete();
    console.log('✅ Cleanup successful');
    console.log('\n🎉 Firestore is working!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

test();