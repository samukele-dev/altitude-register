import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { reportService } from '../services/api';
import { toast } from 'react-hot-toast';
import './Reports.css';

const Reports = () => {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState(null);
  const [sending, setSending] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    try {
      // Use fetch directly to handle blob response
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/reports/generate?date=${selectedDate}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate report');
      }
      
      // Get the blob from response
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_${selectedDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success('Report downloaded successfully!');
      setReportData({ stats: { date: selectedDate, totalClockedIn: 0, totalEmployees: 0, attendanceRate: 0, campaigns: 0 } });
      
    } catch (error) {
      console.error('Failed to generate report:', error);
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const sendEmailReport = async () => {
    if (!reportData) {
      toast.error('Please generate a report first');
      return;
    }
    
    setSending(true);
    try {
      const response = await reportService.sendEmail({
        recipients: ['hr@altitudebpo.co.za'],
        date: selectedDate
      });
      if (response.data.success) {
        toast.success('Report sent to hr@altitudebpo.co.za');
      }
    } catch (error) {
      toast.error('Failed to send email');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="reports-container">
      <div className="reports-header">
        <h1>Attendance Reports</h1>
        <p>Generate and download daily attendance reports by team</p>
      </div>

      <div className="report-controls">
        <div className="date-picker">
          <label>Select Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="date-input"
          />
        </div>
        <button 
          onClick={generateReport} 
          disabled={loading}
          className="generate-btn"
        >
          {loading ? 'Generating...' : '📊 Generate Report'}
        </button>
        <button 
          onClick={sendEmailReport} 
          disabled={!reportData || sending}
          className="email-btn"
        >
          {sending ? 'Sending...' : '📧 Email to HR'}
        </button>
      </div>

      {reportData && (
        <div className="report-preview">
          <div className="report-summary">
            <h3>Report Summary</h3>
            <div className="summary-stats">
              <div className="stat">
                <span className="stat-label">Date:</span>
                <span className="stat-value">{reportData.stats.date}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Report Ready:</span>
                <span className="stat-value">✓ Downloaded</span>
              </div>
            </div>
            <div className="report-actions">
              <button onClick={generateReport} className="download-link">
                📥 Download Again
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="info-section">
        <h3>About Reports</h3>
        <ul>
          <li>Reports are generated as Excel files with separate sheets for each team</li>
          <li>Each sheet contains employee clock-in times and attendance status</li>
          <li>Reports are automatically emailed to hr@altitudebpo.co.za daily at 10:00 AM</li>
          <li>You can also manually generate and send reports using the buttons above</li>
        </ul>
      </div>
    </div>
  );
};

export default Reports;