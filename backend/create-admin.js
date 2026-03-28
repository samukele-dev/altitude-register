const { db, admin } = require('./config/firebase');
const bcrypt = require('bcryptjs');

async function createAdminUser() {
  try {
    // Check if admin already exists
    const adminQuery = await db.collection('users')
      .where('email', '==', 'admin@altitude.co.za')
      .limit(1)
      .get();
    
    if (!adminQuery.empty) {
      console.log('✅ Admin user already exists');
      const adminDoc = adminQuery.docs[0];
      console.log('Admin user data:', adminDoc.data());
      return;
    }
    
    // Hash ID number (required field)
    const hashedIdNumber = await bcrypt.hash('ADMIN001', 10);
    
    // Create admin user
    const adminData = {
      firstName: 'System',
      lastName: 'Administrator',
      employeeId: 'Admin123!',
      email: 'admin@altitude.co.za',
      phoneNumber: '+27123456789',
      idNumber: hashedIdNumber,
      campaign: 'Management',
      team: 'Admin',
      role: 'admin',
      fingerprintTemplate: null,
      fingerprintHash: null,
      isActive: true,
      enrolledAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await db.collection('users').add(adminData);
    console.log('✅ Admin user created with ID:', docRef.id);
    console.log('Login credentials:');
    console.log('  Email: admin@altitude.co.za');
    console.log('  Password: Admin123!');
  } catch (error) {
    console.error('❌ Failed to create admin user:', error.message);
  }
}

createAdminUser();