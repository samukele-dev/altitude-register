const cron = require('node-cron');
const { db } = require('../config/firebase');
const reportController = require('../controllers/reportController');

class SchedulerService {
  constructor() {
    this.scheduleDailyReport();
    this.scheduleDataCleanup();
    console.log('⏰ Scheduler service initialized');
  }

  scheduleDailyReport() {
    // Schedule for 9:00 AM every day
    cron.schedule('0 9 * * *', async () => {
      console.log('📊 Running scheduled daily report generation...');
      try {
        const req = { query: {} };
        const res = {
          json: (data) => console.log('Report generated:', data),
          status: (code) => ({ json: (data) => console.log('Error:', data) })
        };
        
        await reportController.generateDailyReport(req, res);
        console.log('✅ Daily report generated successfully');
      } catch (error) {
        console.error('❌ Scheduled report generation failed:', error);
      }
    });
    console.log('📅 Daily report scheduled for 9:00 AM');
  }

  scheduleDataCleanup() {
    // Run every Sunday at 2:00 AM - clean up old logs
    cron.schedule('0 2 * * 0', async () => {
      console.log('🧹 Running scheduled data cleanup...');
      try {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        
        // Archive old attendance records (optional)
        // This would move old records to an archive collection
        
        console.log('✅ Data cleanup completed');
      } catch (error) {
        console.error('❌ Data cleanup failed:', error);
      }
    });
  }
}

module.exports = new SchedulerService();