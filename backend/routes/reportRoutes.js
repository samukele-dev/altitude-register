const express = require('express');
const router = express.Router();
const {
  generateDailyReport,
  getReportHistory,
  getCampaigns,
  getTeams
} = require('../controllers/reportController');
const { protect, adminOnly, teamLeaderOnly } = require('../middleware/auth');

router.get('/generate', protect, teamLeaderOnly, generateDailyReport);
router.get('/history', protect, teamLeaderOnly, getReportHistory);
router.get('/campaigns', protect, getCampaigns);
router.get('/teams', protect, getTeams);

module.exports = router;