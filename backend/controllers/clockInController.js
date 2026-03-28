const { db, admin } = require('../config/firebase');
const fingerprintService = require('../services/fingerprintService');

const clockInOut = async (req, res) => {
  try {
    const { fingerprintHash, fingerprintTemplate } = req.body;

    // Find user by fingerprint hash
    const usersQuery = await db.collection('users')
      .where('fingerprintHash', '==', fingerprintHash)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (usersQuery.empty) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found or inactive. Please contact admin.'
      });
    }

    const userDoc = usersQuery.docs[0];
    const user = { id: userDoc.id, ...userDoc.data() };

    // Verify fingerprint
    const verification = await fingerprintService.verifyFingerprint(
      user.fingerprintTemplate,
      fingerprintTemplate
    );

    if (!verification.verified) {
      return res.status(401).json({
        success: false,
        message: 'Fingerprint verification failed. Please try again.'
      });
    }

    const today = new Date().toISOString().split('T')[0];
    
    // Check if already clocked in today
    const attendanceQuery = await db.collection('attendance')
      .where('userId', '==', user.id)
      .where('date', '==', today)
      .where('status', '==', 'clocked_in')
      .limit(1)
      .get();

    let attendance;
    let message;

    if (!attendanceQuery.empty) {
      // Clock out
      const attendanceDoc = attendanceQuery.docs[0];
      await attendanceDoc.ref.update({
        clockOutTime: admin.firestore.FieldValue.serverTimestamp(),
        status: 'clocked_out',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      attendance = {
        id: attendanceDoc.id,
        ...attendanceDoc.data(),
        clockOutTime: new Date().toISOString()
      };
      message = `Goodbye ${user.firstName}! You've clocked out successfully.`;
    } else {
      // Clock in
      const attendanceData = {
        userId: user.id,
        employeeId: user.employeeId,
        date: today,
        clockInTime: admin.firestore.FieldValue.serverTimestamp(),
        status: 'clocked_in',
        verifiedByFingerprint: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      const docRef = await db.collection('attendance').add(attendanceData);
      
      // Update last clock-in time
      await userDoc.ref.update({
        lastClockIn: admin.firestore.FieldValue.serverTimestamp()
      });
      
      attendance = {
        id: docRef.id,
        ...attendanceData,
        clockInTime: new Date().toISOString()
      };
      message = `Welcome ${user.firstName}! You've clocked in successfully.`;
    }

    // Update live status
    await updateLiveStatus();

    res.json({
      success: true,
      message,
      data: {
        name: `${user.firstName} ${user.lastName}`,
        campaign: user.campaign,
        team: user.team,
        time: attendance.clockInTime || attendance.clockOutTime,
        status: attendance.status
      }
    });
  } catch (error) {
    console.error('Clock in/out error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process clock in/out',
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
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
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
        clockedIn.push({
          id: doc.id,
          ...attendance,
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
    
    res.json({
      success: true,
      data: statusDoc.data()
    });
  } catch (error) {
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
      
      attendance.push({
        id: doc.id,
        ...data,
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
  clockInOut,
  getTodayStatus,
  getLiveStatus,
  getEmployeeAttendance
};