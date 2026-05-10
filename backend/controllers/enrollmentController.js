const { db, admin } = require('../config/firebase');
const bcrypt = require('bcryptjs');
const emailService = require('../services/emailService');
const fingerprintBridge = require('../services/fingerprintBridge');
const { firestoreIdToUint32 } = require('../services/fingerprintBridge');

const ensureCampaignExists = async (campaign) => {
  if (!campaign) return;
  const ref = db.collection('campaigns').doc(campaign);
  const doc = await ref.get();
  if (!doc.exists) {
    await ref.set({ name: campaign, agentCount: 0, createdAt: new Date() });
  }
};

const ensureTeamExists = async (team, campaign) => {
  if (!team) return;
  const ref = db.collection('teams').doc(team);
  const doc = await ref.get();
  if (!doc.exists) {
    await ref.set({ name: team, campaign, agentCount: 0, createdAt: new Date() });
  }
};

const enrollEmployee = async (req, res) => {
  try {
    const {
      firstName, lastName, employeeId, email,
      phoneNumber, idNumber, campaign, team,
      fingerprintTemplate, fingerprintHash
    } = req.body;

    console.log('📝 Enrolling employee:', { firstName, lastName, employeeId, campaign, team });

    // Template presence check — format conversion (ISO→SG400) is handled
    // automatically by fingerprintBridge.register() via the /extract endpoint.
    if (!fingerprintTemplate) {
      return res.status(400).json({ success: false, message: 'Fingerprint template is required' });
    }

    // Check for duplicate employee ID
    const existingQuery = await db.collection('users').where('employeeId', '==', employeeId).limit(1).get();
    if (!existingQuery.empty) {
      return res.status(400).json({ success: false, message: 'Employee ID already exists' });
    }

    // Check for duplicate email
    const emailQuery = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!emailQuery.empty) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    await ensureCampaignExists(campaign);
    await ensureTeamExists(team, campaign);

    const hashedIdNumber = await bcrypt.hash(idNumber, 10);

    // Create the Firestore document first to get the document ID
    const employeeData = {
      firstName, lastName, employeeId, email,
      phoneNumber, idNumber: hashedIdNumber,
      campaign, team,
      role: 'agent',
      fingerprintTemplate,
      fingerprintHash,
      fingerprintQuality: req.body.fingerprintQuality || 0,
      isActive: true,
      enrolledAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('users').add(employeeData);
    console.log(`✅ Employee created in Firestore: ${docRef.id}`);

    // Compute the bridge uint32 ID and store it on the user doc for fast reverse lookup
    const bridgeId = firestoreIdToUint32(docRef.id);
    await docRef.update({ bridgeId });
    console.log(`🔢 Bridge uint32 ID: ${bridgeId}`);

    // Register fingerprint with the SecuSearch bridge
    console.log(`🔐 Registering fingerprint with bridge...`);
    const bridgeResult = await fingerprintBridge.register(fingerprintTemplate, docRef.id);

    if (bridgeResult.success) {
      console.log(`✅ Fingerprint registered with bridge (ID: ${bridgeId})`);
    } else {
      // Don't fail enrollment – bridge may be restarted and templates reloaded
      console.warn(`⚠️ Bridge registration failed: ${bridgeResult.error}`);
      console.warn(`   Template is stored in Firestore and can be re-registered on next bridge start.`);
    }

    try {
      await emailService.sendWelcomeEmail({ firstName, lastName, employeeId, email, campaign, team });
    } catch (emailError) {
      console.log('Email not sent:', emailError.message);
    }

    res.status(201).json({
      success: true,
      message: 'Employee enrolled successfully',
      data: { id: docRef.id, bridgeId, firstName, lastName, employeeId, email, campaign, team }
    });
  } catch (error) {
    console.error('Enrollment error:', error);
    res.status(500).json({ success: false, message: 'Failed to enroll employee', error: error.message });
  }
};

const getEmployees = async (req, res) => {
  try {
    const { campaign, team, isActive, limit = 100, search } = req.query;
    let query = db.collection('users');
    if (campaign) query = query.where('campaign', '==', campaign);
    if (team) query = query.where('team', '==', team);
    if (isActive !== undefined) query = query.where('isActive', '==', isActive === 'true');

    const snapshot = await query.limit(parseInt(limit)).get();
    const employees = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      delete data.fingerprintTemplate;
      delete data.fingerprintHash;
      delete data.idNumber;

      if (search) {
        const fullName = `${data.firstName} ${data.lastName}`.toLowerCase();
        const empId = data.employeeId.toLowerCase();
        if (!fullName.includes(search.toLowerCase()) && !empId.includes(search.toLowerCase())) return;
      }

      employees.push({ id: doc.id, ...data });
    });

    res.json({ success: true, data: employees });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch employees', error: error.message });
  }
};

const getEmployeeById = async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: 'Employee not found' });

    const data = doc.data();
    delete data.fingerprintTemplate;
    delete data.fingerprintHash;
    delete data.idNumber;

    res.json({ success: true, data: { id: doc.id, ...data } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch employee', error: error.message });
  }
};

const updateEmployee = async (req, res) => {
  try {
    const docRef = db.collection('users').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ success: false, message: 'Employee not found' });

    const updateData = { ...req.body, updatedAt: admin.firestore.FieldValue.serverTimestamp() };

    // Prevent overwriting sensitive / immutable fields
    delete updateData.fingerprintTemplate;
    delete updateData.fingerprintHash;
    delete updateData.idNumber;
    delete updateData.role;
    delete updateData.employeeId;
    delete updateData.bridgeId;

    await docRef.update(updateData);
    res.json({ success: true, message: 'Employee updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update employee', error: error.message });
  }
};

const deleteEmployee = async (req, res) => {
  try {
    const docRef = db.collection('users').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ success: false, message: 'Employee not found' });

    const userData = doc.data();

    // Remove from SecuSearch bridge first
    const bridgeResult = await fingerprintBridge.remove(req.params.id);
    if (bridgeResult.success) {
      console.log(`✅ Fingerprint removed from bridge for ${req.params.id}`);
    } else {
      console.warn(`⚠️ Bridge removal failed (continuing): ${bridgeResult.error}`);
    }

    await docRef.delete();

    // Decrement campaign and team counts
    if (userData.campaign) {
      await db.collection('campaigns').doc(userData.campaign).update({
        agentCount: admin.firestore.FieldValue.increment(-1)
      }).catch(() => {});
    }
    if (userData.team) {
      await db.collection('teams').doc(userData.team).update({
        agentCount: admin.firestore.FieldValue.increment(-1)
      }).catch(() => {});
    }

    res.json({ success: true, message: 'Employee deleted permanently' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete employee', error: error.message });
  }
};

module.exports = { enrollEmployee, getEmployees, getEmployeeById, updateEmployee, deleteEmployee };