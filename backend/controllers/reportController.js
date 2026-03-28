const ExcelJS = require('exceljs');
const { db, storage, admin } = require('../config/firebase');
const emailService = require('../services/emailService');
const { format } = require('date-fns');

const generateDailyReport = async (req, res) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    const dateStr = format(date, 'yyyy-MM-dd');

    // Get all attendance for the date
    const attendanceQuery = await db.collection('attendance')
      .where('date', '==', dateStr)
      .get();

    // Get all active users
    const usersQuery = await db.collection('users')
      .where('isActive', '==', true)
      .get();

    // Create user lookup map
    const users = {};
    usersQuery.forEach(doc => {
      users[doc.id] = doc.data();
    });

    // Group attendance by campaign and team
    const groupedData = {};
    let totalClockedIn = 0;
    const byCampaign = {};
    const byTeam = {};
    
    for (const doc of attendanceQuery.docs) {
      const attendance = doc.data();
      const user = users[attendance.userId];
      
      if (!user) continue;
      
      totalClockedIn++;
      byCampaign[user.campaign] = (byCampaign[user.campaign] || 0) + 1;
      byTeam[user.team] = (byTeam[user.team] || 0) + 1;
      
      const campaign = user.campaign || 'Unassigned';
      const team = user.team || 'Unassigned';
      
      if (!groupedData[campaign]) groupedData[campaign] = {};
      if (!groupedData[campaign][team]) groupedData[campaign][team] = [];
      
      groupedData[campaign][team].push({
        name: `${user.firstName} ${user.lastName}`,
        employeeId: user.employeeId,
        clockIn: attendance.clockInTime,
        clockOut: attendance.clockOutTime || 'Not clocked out',
        status: attendance.status
      });
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`Altitude_Report_${dateStr}`);

    // Set columns
    worksheet.columns = [
      { header: 'Campaign', key: 'campaign', width: 20 },
      { header: 'Team', key: 'team', width: 20 },
      { header: 'Employee ID', key: 'employeeId', width: 15 },
      { header: 'Employee Name', key: 'name', width: 25 },
      { header: 'Clock In', key: 'clockIn', width: 20 },
      { header: 'Clock Out', key: 'clockOut', width: 20 },
      { header: 'Status', key: 'status', width: 15 }
    ];

    // Style header
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2A5298' }
    };
    headerRow.alignment = { horizontal: 'center' };
    headerRow.height = 25;

    let currentRow = 2;
    
    // Add company header
    worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
    worksheet.getCell(`A${currentRow}`).value = 'Altitude Call Center';
    worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 18, color: { argb: 'FF2A5298' } };
    worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center' };
    currentRow++;

    worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
    worksheet.getCell(`A${currentRow}`).value = `Daily Attendance Report - ${format(date, 'MMMM dd, yyyy')}`;
    worksheet.getCell(`A${currentRow}`).font = { italic: true, size: 12 };
    worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center' };
    currentRow += 2;

    // Add summary section
    worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
    worksheet.getCell(`A${currentRow}`).value = 'SUMMARY';
    worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 14 };
    currentRow++;

    worksheet.addRow({ name: `Total Employees: ${usersQuery.size}` });
    worksheet.addRow({ name: `Total Clocked In: ${totalClockedIn}` });
    worksheet.addRow({ name: `Attendance Rate: ${((totalClockedIn / usersQuery.size) * 100).toFixed(1)}%` });
    currentRow += 2;

    // Add data
    for (const [campaign, teams] of Object.entries(groupedData)) {
      worksheet.addRow({ campaign });
      worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
      worksheet.getRow(currentRow).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(currentRow).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F81BD' }
      };
      currentRow++;

      for (const [team, employees] of Object.entries(teams)) {
        worksheet.addRow({ team });
        worksheet.mergeCells(`B${currentRow}:G${currentRow}`);
        worksheet.getRow(currentRow).font = { italic: true, bold: true };
        worksheet.getRow(currentRow).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE7E6E6' }
        };
        currentRow++;

        employees.forEach(emp => {
          worksheet.addRow({
            campaign: '',
            team: '',
            employeeId: emp.employeeId,
            name: emp.name,
            clockIn: emp.clockIn ? new Date(emp.clockIn).toLocaleTimeString() : 'N/A',
            clockOut: emp.clockOut === 'Not clocked out' ? emp.clockOut : 
                      emp.clockOut ? new Date(emp.clockOut).toLocaleTimeString() : 'N/A',
            status: emp.status === 'clocked_in' ? 'Clocked In' : 'Clocked Out'
          });
          currentRow++;
        });

        worksheet.addRow({ name: `Team Total: ${employees.length} employees` });
        worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
        worksheet.getRow(currentRow).font = { italic: true };
        currentRow++;
        currentRow++;
      }

      const campaignTotal = Object.values(teams).flat().length;
      worksheet.addRow({ name: `Campaign Total: ${campaignTotal} employees` });
      worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
      worksheet.getRow(currentRow).font = { bold: true };
      currentRow++;
      currentRow++;
    }

    worksheet.addRow({ name: `GRAND TOTAL: ${totalClockedIn} employees clocked in` });
    worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
    worksheet.getRow(currentRow).font = { bold: true, size: 14 };
    worksheet.getRow(currentRow).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' }
    };

    // Add borders
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    // Upload to Firebase Storage
    const fileName = `reports/attendance_${dateStr}.xlsx`;
    const file = storage.bucket().file(fileName);
    await file.save(buffer, {
      metadata: {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }
    });
    
    const fileUrl = `https://storage.googleapis.com/${storage.bucket().name}/${fileName}`;

    // Save report metadata
    const timestamp = admin ? admin.firestore.FieldValue.serverTimestamp() : new Date();
    await db.collection('daily_reports').doc(dateStr).set({
      date: dateStr,
      totalClockedIn,
      totalEmployees: usersQuery.size,
      attendanceRate: totalClockedIn / usersQuery.size,
      byCampaign,
      byTeam,
      reportFileUrl: fileUrl,
      generatedAt: timestamp
    }, { merge: true });

    res.json({
      success: true,
      message: 'Report generated successfully',
      data: {
        fileUrl,
        fileName,
        stats: {
          totalClockedIn,
          totalEmployees: usersQuery.size,
          attendanceRate: ((totalClockedIn / usersQuery.size) * 100).toFixed(1),
          campaigns: Object.keys(groupedData).length,
          date: dateStr
        }
      }
    });
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: error.message
    });
  }
};

const getReportHistory = async (req, res) => {
  try {
    const { limit = 30 } = req.query;
    
    const snapshot = await db.collection('daily_reports')
      .orderBy('date', 'desc')
      .limit(parseInt(limit))
      .get();
    
    const reports = [];
    snapshot.forEach(doc => {
      reports.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    res.json({
      success: true,
      data: reports
    });
  } catch (error) {
    console.error('Get report history error:', error);
    res.json({ success: true, data: [] });
  }
};

const getCampaigns = async (req, res) => {
  try {
    console.log('📁 Fetching campaigns...');
    
    // Disable caching
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Get ALL campaigns - don't use where filter that might fail
    const snapshot = await db.collection('campaigns').get();
    
    const campaigns = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      campaigns.push({
        id: doc.id,
        name: data.name || doc.id,
        description: data.description || '',
        agentCount: data.agentCount || 0,
        isActive: data.isActive !== false,
        createdAt: data.createdAt || new Date()
      });
    });
    
    console.log(`✅ Found ${campaigns.length} campaigns:`, campaigns.map(c => c.name));
    
    res.json({
      success: true,
      data: campaigns
    });
  } catch (error) {
    console.error('❌ Get campaigns error:', error.message);
    // Return empty array
    res.json({ success: true, data: [] });
  }
};

const getTeams = async (req, res) => {
  try {
    const { campaign } = req.query;
    console.log('📁 Fetching teams...', campaign ? `for campaign: ${campaign}` : 'all');
    
    // Disable caching
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Get ALL teams first
    let snapshot = await db.collection('teams').get();
    
    let teams = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      teams.push({
        id: doc.id,
        name: data.name || doc.id,
        campaign: data.campaign || '',
        agentCount: data.agentCount || 0,
        isActive: data.isActive !== false,
        createdAt: data.createdAt || new Date()
      });
    });
    
    // Filter by campaign if specified
    if (campaign && campaign !== 'undefined' && campaign !== 'null') {
      teams = teams.filter(team => team.campaign === campaign);
    }
    
    console.log(`✅ Found ${teams.length} teams:`, teams.map(t => t.name));
    
    res.json({
      success: true,
      data: teams
    });
  } catch (error) {
    console.error('❌ Get teams error:', error.message);
    res.json({ success: true, data: [] });
  }
};

module.exports = {
  generateDailyReport,
  getReportHistory,
  getCampaigns,
  getTeams
};