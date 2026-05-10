const { db, admin } = require('../config/firebase');
const fingerprintBridge = require('../services/fingerprintBridge');

const clockIn = async (req, res) => {
  try {
    const { fingerprintTemplate } = req.body;

    console.log('🔍 Clock-in attempt');
    console.log('📝 Template length:', fingerprintTemplate?.length);

    if (!fingerprintTemplate) {
      return res.status(400).json({
        success: false,
        message: 'Fingerprint data is required'
      });
    }

    if (!db) {
      return res.status(500).json({
        success: false,
        message: 'Database connection error'
      });
    }

    // 1:N identification via SecuSearch bridge
    console.log('🔍 Sending to fingerprint bridge for identification...');
    const matchResult = await fingerprintBridge.identify(fingerprintTemplate);

    if (!matchResult.success) {
      console.log('❌ No matching fingerprint found');
      return res.status(404).json({
        success: false,
        message: 'Fingerprint not recognized. Please try again or contact admin.'
      });
    }

    console.log(`✅ Bridge matched uint32 ID: ${matchResult.matched_id}`);

    // Reverse-lookup: uint32 bridge ID → Firestore document ID
    const firestoreId = await fingerprintBridge.reverseLookup(matchResult.matched_id, db);
    if (!firestoreId) {
      console.log(`❌ Could not map bridge ID ${matchResult.matched_id} to a Firestore user`);
      return res.status(404).json({
        success: false,
        message: 'User not found. Please contact admin.'
      });
    }

    // Fetch user document
    const userDoc = await db.collection('users').doc(firestoreId).get();
    if (!userDoc.exists) {
      console.log(`❌ Firestore user ${firestoreId} not found`);
      return res.status(404).json({
        success: false,
        message: 'User not found. Please contact admin.'
      });
    }

    const user = { id: userDoc.id, ...userDoc.data() };
    console.log(`✅ Found user: ${user.firstName} ${user.lastName}`);

    const today = new Date().toISOString().split('T')[0];

    // Check if already clocked in today
    const existingClockIn = await db.collection('attendance')
      .where('userId', '==', user.id)
      .where('date', '==', today)
      .where('status', '==', 'clocked_in')
      .limit(1)
      .get();

    if (!existingClockIn.empty) {
      const clockInTime = existingClockIn.docs[0].data().clockInTime?.toDate?.()
        || existingClockIn.docs[0].data().clockInTime;
      console.log(`⚠️ Already clocked in at: ${clockInTime}`);
      return res.status(400).json({
        success: false,
        message: `Good morning ${user.firstName}! You already clocked in today at ${new Date(clockInTime).toLocaleTimeString()}. Have a productive day!`
      });
    }

    // Create clock-in record
    const attendanceData = {
      userId: user.id,
      employeeId: user.employeeId,
      date: today,
      clockInTime: new Date(),
      status: 'clocked_in',
      verifiedByFingerprint: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('attendance').add(attendanceData);
    console.log(`✅ Clock-in record created: ${docRef.id}`);

    await db.collection('users').doc(user.id).update({ lastClockIn: new Date() });

    updateLiveStatus().catch(err => console.error('Live status update error:', err));

    const welcomeMessages = [
      `Hi ${user.firstName}! You've successfully clocked in. Have a productive day!`,
      `Good morning ${user.firstName}! Welcome to Altitude. Have a great shift!`,
      `Welcome ${user.firstName}! You're all clocked in. Make it a great day!`,
      `${user.firstName}, you're signed in. Ready to serve our customers!`,
      `Success! ${user.firstName} is clocked in. Let's make today amazing!`
    ];

    res.json({
      success: true,
      message: welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)],
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
    const stats = { totalClockedIn: 0, byCampaign: {}, byTeam: {} };

    for (const doc of attendanceQuery.docs) {
      const attendance = doc.data();
      const userDoc = await db.collection('users').doc(attendance.userId).get();
      if (!userDoc.exists) continue;

      const user = userDoc.data();
      let clockInTimeString = null;
      if (attendance.clockInTime) {
        clockInTimeString = typeof attendance.clockInTime === 'object' && attendance.clockInTime.toDate
          ? attendance.clockInTime.toDate().toISOString()
          : attendance.clockInTime;
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

    res.json({ success: true, data: { clockedIn, stats, date: today } });
  } catch (error) {
    console.error('Get today status error:', error);
    res.status(500).json({ success: false, message: "Failed to fetch today's status", error: error.message });
  }
};

const getLiveStatus = async (req, res) => {
  try {
    const statusDoc = await db.collection('live_status').doc('current').get();
    if (!statusDoc.exists) {
      return res.json({ success: true, data: { totalClockedIn: 0, byCampaign: {}, byTeam: {}, lastUpdated: null } });
    }
    const data = statusDoc.data();
    if (data.lastUpdated?.toDate) data.lastUpdated = data.lastUpdated.toDate().toISOString();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Get live status error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch live status', error: error.message });
  }
};

const getEmployeeAttendance = async (req, res) => {
  try {
    const { employeeId, startDate, endDate, limit = 50 } = req.query;
    let query = db.collection('attendance');
    if (employeeId) query = query.where('employeeId', '==', employeeId);
    if (startDate && endDate) {
      query = query.where('date', '>=', startDate).where('date', '<=', endDate);
    }

    const snapshot = await query.orderBy('date', 'desc').orderBy('clockInTime', 'desc').limit(parseInt(limit)).get();
    const attendance = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const userDoc = await db.collection('users').doc(data.userId).get();
      const user = userDoc.exists ? userDoc.data() : null;

      let clockInTimeString = null;
      if (data.clockInTime) {
        clockInTimeString = typeof data.clockInTime === 'object' && data.clockInTime.toDate
          ? data.clockInTime.toDate().toISOString()
          : data.clockInTime;
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

    res.json({ success: true, data: attendance });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch attendance', error: error.message });
  }
};

module.exports = { clockIn, getTodayStatus, getLiveStatus, getEmployeeAttendance };