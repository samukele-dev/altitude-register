const { db } = require('../config/firebase');
const { generateToken } = require('../middleware/auth');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('📝 Login attempt:', { email, passwordProvided: !!password });
    
    // Check if database is available
    if (!db) {
      console.error('❌ Database not available');
      return res.status(500).json({
        success: false,
        message: 'Database connection error'
      });
    }
    
    // Find user by email
    const usersQuery = await db.collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();
    
    if (usersQuery.empty) {
      console.log('❌ No user found with email:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    const userDoc = usersQuery.docs[0];
    const user = { id: userDoc.id, ...userDoc.data() };
    
    console.log('✅ User found:', {
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
      isActive: user.isActive
    });
    
    // Check if user is active
    if (!user.isActive) {
      console.log('❌ User is inactive');
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact admin.'
      });
    }
    
    // Compare password with employeeId
    const isValid = password === user.employeeId;
    console.log('🔐 Password validation:', { 
      provided: password, 
      expected: user.employeeId, 
      isValid 
    });
    
    if (!isValid) {
      console.log('❌ Invalid password');
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Generate token
    const token = generateToken(user.id);
    
    // Remove sensitive data
    delete user.fingerprintTemplate;
    delete user.fingerprintHash;
    delete user.idNumber;
    
    console.log('✅ Login successful for:', user.email);
    
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          campaign: user.campaign,
          team: user.team,
          employeeId: user.employeeId
        },
        token
      }
    });
  } catch (error) {
    console.error('❌ Login error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Login failed: ' + error.message
    });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const user = req.user;
    delete user.fingerprintTemplate;
    delete user.fingerprintHash;
    delete user.idNumber;
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get user'
    });
  }
};

const changePassword = async (req, res) => {
  res.json({
    success: true,
    message: 'Password change not implemented in demo'
  });
};

module.exports = { login, getCurrentUser, changePassword };