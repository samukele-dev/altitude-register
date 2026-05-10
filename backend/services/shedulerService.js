const cron = require('node-cron');
const { generateDailyReport, sendEmailReport } = require('../controllers/reportController');

class SchedulerService {
  constructor() {
    this.scheduleDailyReport();
    this.scheduleDailyEmail();
    console.log('⏰ Scheduler service initialized');
  }

  scheduleDailyReport() {
    cron.schedule('0 9 * * *', async () => {
      console.log('📊 Running scheduled daily report generation...');
      try {
        const req = { query: { date: new Date().toISOString().split('T')[0] } };
        const res = { json: (data) => console.log('Report generated:', data) };
        await generateDailyReport(req, res);
      } catch (error) {
        console.error('Scheduled report generation failed:', error);
      }
    });
    console.log('📅 Daily report scheduled for 9:00 AM');
  }

  scheduleDailyEmail() {
    cron.schedule('0 10 * * *', async () => {
      console.log('📧 Sending daily report email to HR...');
      try {
        const req = { 
          body: { 
            recipients: ['hr@altitudebpo.co.za'],
            date: new Date().toISOString().split('T')[0]
          } 
        };
        const res = { json: (data) => console.log('Email sent:', data) };
        await sendEmailReport(req, res);
      } catch (error) {
        console.error('Scheduled email failed:', error);
      }
    });
    console.log('📧 Daily email scheduled for 10:00 AM to hr@altitudebpo.co.za');
  }
}

module.exports = new SchedulerService();