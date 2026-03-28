const { db, admin } = require('../config/firebase');
const bcrypt = require('bcryptjs');
const emailService = require('../services/emailService');

// Helper function to ensure campaign exists
const ensureCampaignExists = async (campaignName) => {
  if (!campaignName) return false;
  
  try {
    const campaignRef = db.collection('campaigns').doc(campaignName);
    const campaignDoc = await campaignRef.get();
    
    if (!campaignDoc.exists) {
      await campaignRef.set({
        name: campaignName,
        description: `${campaignName} Campaign`,
        agentCount: 1,
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`✅ Auto-created campaign: ${campaignName}`);
      return true;
    } else {
      await campaignRef.update({
        agentCount: admin.firestore.FieldValue.increment(1)
      });
      return false;
    }
  } catch (error) {
    console.error('Error ensuring campaign exists:', error.message);
    return false;
  }
};

// Helper function to ensure team exists
const ensureTeamExists = async (teamName, campaignName) => {
  if (!teamName) return false;
  
  try {
    const teamRef = db.collection('teams').doc(teamName);
    const teamDoc = await teamRef.get();
    
    if (!teamDoc.exists) {
      await teamRef.set({
        name: teamName,
        campaign: campaignName,
        agentCount: 1,
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`✅ Auto-created team: ${teamName} in ${campaignName}`);
      return true;
    } else {
      await teamRef.update({
        agentCount: admin.firestore.FieldValue.increment(1)
      });
      return false;
    }
  } catch (error) {
    console.error('Error ensuring team exists:', error.message);
    return false;
  }
};

const enrollEmployee = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      employeeId,
      email,
      phoneNumber,
      idNumber,
      campaign,
      team,
      fingerprintTemplate,
      fingerprintHash
    } = req.body;

    console.log('📝 Enrolling employee:', { firstName, lastName, employeeId, campaign, team });

    // Check if employee already exists
    const existingQuery = await db.collection('users')
      .where('employeeId', '==', employeeId)
      .limit(1)
      .get();

    if (!existingQuery.empty) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID already exists'
      });
    }

    // Check if email already exists
    const emailQuery = await db.collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (!emailQuery.empty) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // AUTO-CREATE CAMPAIGN AND TEAM if they don't exist
    await ensureCampaignExists(campaign);
    await ensureTeamExists(team, campaign);

    // Hash ID number
    const hashedIdNumber = await bcrypt.hash(idNumber, 10);

    // Create employee document
    const employeeData = {
      firstName,
      lastName,
      employeeId,
      email,
      phoneNumber,
      idNumber: hashedIdNumber,
      campaign,
      team,
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

    // Send welcome email
    try {
      await emailService.sendWelcomeEmail({
        firstName,
        lastName,
        employeeId,
        email,
        campaign,
        team
      });
    } catch (emailError) {
      console.log('Email not sent (mock mode):', emailError.message);
    }

    res.status(201).json({
      success: true,
      message: 'Employee enrolled successfully',
      data: {
        id: docRef.id,
        firstName,
        lastName,
        employeeId,
        email,
        campaign,
        team
      }
    });
  } catch (error) {
    console.error('Enrollment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to enroll employee',
      error: error.message
    });
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
      // Remove sensitive data
      delete data.fingerprintTemplate;
      delete data.fingerprintHash;
      delete data.idNumber;
      
      // Apply search filter if provided
      if (search) {
        const fullName = `${data.firstName} ${data.lastName}`.toLowerCase();
        const empId = data.employeeId.toLowerCase();
        const searchLower = search.toLowerCase();
        if (!fullName.includes(searchLower) && !empId.includes(searchLower)) {
          return;
        }
      }
      
      employees.push({
        id: doc.id,
        ...data
      });
    });
    
    res.json({
      success: true,
      data: employees
    });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employees',
      error: error.message
    });
  }
};

const getEmployeeById = async (req, res) => {
  try {
    const docRef = db.collection('users').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }
    
    const data = doc.data();
    delete data.fingerprintTemplate;
    delete data.fingerprintHash;
    delete data.idNumber;
    
    res.json({
      success: true,
      data: {
        id: doc.id,
        ...data
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employee',
      error: error.message
    });
  }
};

const updateEmployee = async (req, res) => {
  try {
    const docRef = db.collection('users').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }
    
    const updateData = {
      ...req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Don't allow updating sensitive fields
    delete updateData.fingerprintTemplate;
    delete updateData.fingerprintHash;
    delete updateData.idNumber;
    delete updateData.role;
    delete updateData.employeeId;
    
    await docRef.update(updateData);
    
    res.json({
      success: true,
      message: 'Employee updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update employee',
      error: error.message
    });
  }
};

const deleteEmployee = async (req, res) => {
  try {
    const docRef = db.collection('users').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }
    
    // Soft delete - deactivate instead of permanent delete
    await docRef.update({
      isActive: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({
      success: true,
      message: 'Employee deactivated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate employee',
      error: error.message
    });
  }
};

module.exports = {
  enrollEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee
};