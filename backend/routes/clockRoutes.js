const express = require('express');
const router = express.Router();
const {
  clockIn,
  getTodayStatus,
  getLiveStatus,
  getEmployeeAttendance
} = require('../controllers/clockInController');
const { protect } = require('../middleware/auth');
const { validateClockIn } = require('../middleware/validation');

// Import db for verification endpoints
const { db } = require('../config/firebase');

// Helper function to update live status
const updateLiveStatus = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const attendanceQuery = await db.collection('attendance')
      .where('date', '==', today)
      .where('status', '==', 'clocked_in')
      .get();
    
    const byCampaign = {};
    const byTeam = {};
    
    for (const doc of attendanceQuery.docs) {
      const attendance = doc.data();
      const userDoc = await db.collection('users').doc(attendance.userId).get();
      
      if (userDoc.exists) {
        const user = userDoc.data();
        byCampaign[user.campaign] = (byCampaign[user.campaign] || 0) + 1;
        byTeam[user.team] = (byTeam[user.team] || 0) + 1;
      }
    }
    
    await db.collection('live_status').doc('current').set({
      totalClockedIn: attendanceQuery.size,
      byCampaign,
      byTeam,
      lastUpdated: new Date()
    }, { merge: true });
    
    console.log(`✅ Live status updated: ${attendanceQuery.size} employees clocked in`);
  } catch (error) {
    console.error('Update live status error:', error);
  }
};

// Public route for clock in (no auth required, uses fingerprint)
router.post('/', validateClockIn, clockIn);

// NEW: Verify employee ID endpoint
router.post('/verify-employee-id', async (req, res) => {
  try {
    const { employeeId } = req.body;
    
    console.log('🔍 Verifying employee ID:', employeeId);
    
    const userQuery = await db.collection('users')
      .where('employeeId', '==', employeeId)
      .where('isActive', '==', true)
      .limit(1)
      .get();
    
    if (userQuery.empty) {
      return res.status(404).json({
        success: false,
        message: 'Employee ID not found'
      });
    }
    
    const userDoc = userQuery.docs[0];
    const user = userDoc.data();
    
    res.json({
      success: true,
      employee: {
        employeeId: user.employeeId,
        firstName: user.firstName,
        lastName: user.lastName
      }
    });
  } catch (error) {
    console.error('Verify employee ID error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Verify fingerprint after employee ID
const fingerprintBridge = require('../services/fingerprintBridge');

router.post('/verify-fingerprint', async (req, res) => {
  try {
    const { employeeId, fingerprintHash, fingerprintTemplate } = req.body;
    
    console.log('🔍 Verifying fingerprint for employee:', employeeId);
    console.log('📝 Using SecuSearch bridge for 1:N identification');
    
    // First, verify the employee ID exists
    const userQuery = await db.collection('users')
      .where('employeeId', '==', employeeId)
      .where('isActive', '==', true)
      .limit(1)
      .get();
    
    if (userQuery.empty) {
      return res.status(404).json({
        success: false,
        message: 'Employee ID not found'
      });
    }
    
    const userDoc = userQuery.docs[0];
    const user = userDoc.data();
    
    // Use SecuSearch bridge for professional 1:N matching
    console.log('🔍 Sending to SecuSearch bridge for identification...');
    const matchResult = await fingerprintBridge.identify(fingerprintTemplate);
    
    if (!matchResult.success || matchResult.matched_id === 0) {
      console.log('❌ No fingerprint match found via SecuSearch');
      return res.status(401).json({
        success: false,
        message: 'Fingerprint does not match. Please try again.'
      });
    }
    
    // Convert bridge ID back to Firestore ID
    const firestoreId = await fingerprintBridge.reverseLookup(matchResult.matched_id, db);
    
    if (!firestoreId || firestoreId !== userDoc.id) {
      console.log(`❌ Bridge matched ID ${matchResult.matched_id} does not match employee ${employeeId}`);
      return res.status(401).json({
        success: false,
        message: 'Fingerprint does not match this employee. Please try again.'
      });
    }
    
    console.log(`✅ SecuSearch match found for ${user.firstName} ${user.lastName}`);
    
    // Check if already clocked in today
    const today = new Date().toISOString().split('T')[0];
    const existingClockIn = await db.collection('attendance')
      .where('userId', '==', userDoc.id)
      .where('date', '==', today)
      .where('status', '==', 'clocked_in')
      .limit(1)
      .get();
    
    if (!existingClockIn.empty) {
      return res.status(400).json({
        success: false,
        message: `Good morning ${user.firstName}! You already clocked in today.`
      });
    }
    
    // Create clock-in record
    const attendanceData = {
      userId: userDoc.id,
      employeeId: user.employeeId,
      date: today,
      clockInTime: new Date(),
      status: 'clocked_in',
      verifiedByFingerprint: true,
      matchConfidence: matchResult.confidence || 85,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db.collection('attendance').add(attendanceData);
    
    // Update last clock-in time
    await userDoc.ref.update({
      lastClockIn: new Date()
    });
    
    // Update live status
    await updateLiveStatus();
    
    const welcomeMessages = [
      `Hi ${user.firstName}! You've successfully clocked in. Have a productive day!`,
      `Good morning ${user.firstName}! Welcome to Altitude. Have a great shift!`,
      `Welcome ${user.firstName}! You're all clocked in. Make it a great day!`,
      `${user.firstName}, you're signed in. Ready to serve our customers!`
    ];
    
    const randomMessage = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
    
    res.json({
      success: true,
      message: randomMessage,
      data: {
        name: `${user.firstName} ${user.lastName}`,
        campaign: user.campaign,
        team: user.team,
        confidence: matchResult.confidence || 85
      }
    });

  } catch (error) {
    console.error('Verify fingerprint error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Protected routes
router.get('/today', protect, getTodayStatus);
router.get('/live', protect, getLiveStatus);
router.get('/attendance', protect, getEmployeeAttendance);

module.exports = router;