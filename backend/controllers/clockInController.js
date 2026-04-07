const { db, admin } = require('../config/firebase');
const fingerprintService = require('../services/fingerprintService');

// Production configuration
const MATCH_THRESHOLD = 0.3; // 30% - based on test data

const clockIn = async (req, res) => {
  try {
    const { fingerprintHash, fingerprintTemplate } = req.body;

    console.log('🔍 Clock-in attempt');
    console.log('📝 Template length:', fingerprintTemplate?.length);

    // Validate input
    if (!fingerprintTemplate) {
      console.log('❌ Missing fingerprint template');
      return res.status(400).json({
        success: false,
        message: 'Fingerprint data is required'
      });
    }

    // Check database connection
    if (!db) {
      console.error('❌ Database not connected');
      return res.status(500).json({
        success: false,
        message: 'Database connection error'
      });
    }

    // Get ALL active users
    const allUsers = await db.collection('users')
      .where('isActive', '==', true)
      .get();
    
    console.log(`📊 Checking against ${allUsers.size} enrolled users`);

    let bestMatch = null;
    let bestSimilarity = 0;
    let bestUserDoc = null;

    // Compare captured fingerprint with each enrolled user
    for (const doc of allUsers.docs) {
      const userData = doc.data();
      
      // Skip users without fingerprint template
      if (!userData.fingerprintTemplate) {
        continue;
      }
      
      // Calculate similarity between templates
      const similarity = fingerprintService.calculateSimilarity(
        userData.fingerprintTemplate,
        fingerprintTemplate
      );
      
      console.log(`   ${userData.firstName} ${userData.lastName}: ${(similarity * 100).toFixed(1)}% match`);
      
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = userData;
        bestUserDoc = doc;
      }
    }

    // Check against threshold
    if (!bestMatch || bestSimilarity < MATCH_THRESHOLD) {
      console.log(`❌ No matching fingerprint found. Best match: ${(bestSimilarity * 100).toFixed(1)}% (threshold: ${MATCH_THRESHOLD * 100}%)`);
      
      // Log failed attempt for security audit
      try {
        await db.collection('failed_attempts').add({
          similarity: bestSimilarity,
          timestamp: new Date(),
          threshold: MATCH_THRESHOLD
        });
      } catch (logError) {
        console.error('Failed to log attempt:', logError.message);
      }
      
      return res.status(404).json({
        success: false,
        message: 'Fingerprint not recognized. Please try again or contact admin.'
      });
    }

    const user = bestMatch;
    const userDoc = bestUserDoc;
    
    console.log(`✅ Found matching fingerprint for: ${user.firstName} ${user.lastName} (${(bestSimilarity * 100).toFixed(1)}% match)`);

    const today = new Date().toISOString().split('T')[0];
    
    // Check if already clocked in today
    let existingClockIn;
    try {
      existingClockIn = await db.collection('attendance')
        .where('userId', '==', userDoc.id)
        .where('date', '==', today)
        .where('status', '==', 'clocked_in')
        .limit(1)
        .get();
    } catch (attendanceError) {
      console.error('❌ Attendance query error:', attendanceError.message);
      return res.status(500).json({
        success: false,
        message: 'Error checking attendance status'
      });
    }

    // If already clocked in today
    if (!existingClockIn.empty) {
      const existingRecord = existingClockIn.docs[0];
      const clockInTime = existingRecord.data().clockInTime?.toDate?.() || existingRecord.data().clockInTime;
      
      console.log(`⚠️ User already clocked in at: ${clockInTime}`);
      
      return res.status(400).json({
        success: false,
        message: `Good morning ${user.firstName}! You already clocked in today at ${new Date(clockInTime).toLocaleTimeString()}. Have a productive day!`
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
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    let docRef;
    try {
      docRef = await db.collection('attendance').add(attendanceData);
      console.log(`✅ Clock-in record created: ${docRef.id}`);
    } catch (createError) {
      console.error('❌ Failed to create attendance record:', createError.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to save clock-in record'
      });
    }
    
    // Update last clock-in time
    try {
      await userDoc.ref.update({
        lastClockIn: new Date()
      });
    } catch (updateError) {
      console.error('⚠️ Failed to update lastClockIn:', updateError.message);
    }
    
    // Update live status
    updateLiveStatus().catch(err => console.error('Live status update error:', err));

    // Random welcome messages
    const welcomeMessages = [
      `Hi ${user.firstName}! You've successfully clocked in. Have a productive day!`,
      `Good morning ${user.firstName}! Welcome to Altitude. Have a great shift!`,
      `Welcome ${user.firstName}! You're all clocked in. Make it a great day!`,
      `${user.firstName}, you're signed in. Ready to serve our customers!`,
      `Success! ${user.firstName} is clocked in. Let's make today amazing!`
    ];
    
    const randomMessage = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];

    res.json({
      success: true,
      message: randomMessage,
      data: {
        name: `${user.firstName} ${user.lastName}`,
        campaign: user.campaign,
        team: user.team,
        time: new Date().toISOString(),
        status: 'clocked_in'
      }
    });
  } catch (error) {
    console.error('❌ Clock-in error:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to process clock-in. Please try again.',
      error: error.message
    });
  }
};

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
  } catch (error) {
    console.error('Update live status error:', error);
  }
};

const getTodayStatus = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const attendanceQuery = await db.collection('attendance')
      .where('date', '==', today)
      .where('status', '==', 'clocked_in')
      .get();
    
    const clockedIn = [];
    const stats = {
      totalClockedIn: 0,
      byCampaign: {},
      byTeam: {}
    };
    
    for (const doc of attendanceQuery.docs) {
      const attendance = doc.data();
      const userDoc = await db.collection('users').doc(attendance.userId).get();
      
      if (userDoc.exists) {
        const user = userDoc.data();
        
        // Convert Firestore timestamp to ISO string
        let clockInTimeString = null;
        if (attendance.clockInTime) {
          if (typeof attendance.clockInTime === 'object' && attendance.clockInTime.toDate) {
            clockInTimeString = attendance.clockInTime.toDate().toISOString();
          } else if (attendance.clockInTime instanceof Date) {
            clockInTimeString = attendance.clockInTime.toISOString();
          } else {
            clockInTimeString = attendance.clockInTime;
          }
        }
        
        clockedIn.push({
          id: doc.id,
          ...attendance,
          clockInTime: clockInTimeString,
          user: {
            firstName: user.firstName,
            lastName: user.lastName,
            employeeId: user.employeeId,
            campaign: user.campaign,
            team: user.team
          }
        });
        
        stats.totalClockedIn++;
        stats.byCampaign[user.campaign] = (stats.byCampaign[user.campaign] || 0) + 1;
        stats.byTeam[user.team] = (stats.byTeam[user.team] || 0) + 1;
      }
    }
    
    res.json({
      success: true,
      data: {
        clockedIn,
        stats,
        date: today
      }
    });
  } catch (error) {
    console.error('Get today status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch today\'s status',
      error: error.message
    });
  }
};

const getLiveStatus = async (req, res) => {
  try {
    const statusDoc = await db.collection('live_status').doc('current').get();
    
    if (!statusDoc.exists) {
      return res.json({
        success: true,
        data: {
          totalClockedIn: 0,
          byCampaign: {},
          byTeam: {},
          lastUpdated: null
        }
      });
    }
    
    const data = statusDoc.data();
    // Convert Firestore timestamp if present
    if (data.lastUpdated && typeof data.lastUpdated === 'object' && data.lastUpdated.toDate) {
      data.lastUpdated = data.lastUpdated.toDate().toISOString();
    }
    
    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Get live status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch live status',
      error: error.message
    });
  }
};

const getEmployeeAttendance = async (req, res) => {
  try {
    const { employeeId, startDate, endDate, limit = 50 } = req.query;
    
    let query = db.collection('attendance');
    
    if (employeeId) {
      query = query.where('employeeId', '==', employeeId);
    }
    
    if (startDate && endDate) {
      query = query.where('date', '>=', startDate)
                   .where('date', '<=', endDate);
    }
    
    const snapshot = await query.orderBy('date', 'desc')
                                 .orderBy('clockInTime', 'desc')
                                 .limit(parseInt(limit))
                                 .get();
    
    const attendance = [];
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      const userDoc = await db.collection('users').doc(data.userId).get();
      const user = userDoc.exists ? userDoc.data() : null;
      
      // Convert clockInTime
      let clockInTimeString = null;
      if (data.clockInTime) {
        if (typeof data.clockInTime === 'object' && data.clockInTime.toDate) {
          clockInTimeString = data.clockInTime.toDate().toISOString();
        } else if (data.clockInTime instanceof Date) {
          clockInTimeString = data.clockInTime.toISOString();
        } else {
          clockInTimeString = data.clockInTime;
        }
      }
      
      attendance.push({
        id: doc.id,
        ...data,
        clockInTime: clockInTimeString,
        user: user ? {
          firstName: user.firstName,
          lastName: user.lastName,
          employeeId: user.employeeId,
          campaign: user.campaign,
          team: user.team
        } : null
      });
    }
    
    res.json({
      success: true,
      data: attendance
    });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance',
      error: error.message
    });
  }
};

module.exports = {
  clockIn,
  getTodayStatus,
  getLiveStatus,
  getEmployeeAttendance
};