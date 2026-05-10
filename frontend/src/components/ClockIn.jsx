import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import fingerprintService from '../services/fingerprintService';
import { clockService } from '../services/api';
import './ClockIn.css';

const ClockIn = () => {
  const [step, setStep] = useState('id'); // 'id', 'fingerprint'
  const [employeeId, setEmployeeId] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [liveStatus, setLiveStatus] = useState({ totalClockedIn: 0, byCampaign: {} });
  const [scannerStatus, setScannerStatus] = useState('ready');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    fetchLiveStatus();
    const statusInterval = setInterval(fetchLiveStatus, 30000);
    
    return () => {
      clearInterval(timer);
      clearInterval(statusInterval);
    };
  }, []);

  const fetchLiveStatus = async () => {
    try {
      const response = await clockService.getLiveStatus();
      if (response.data.success) {
        setLiveStatus(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch live status:', error);
    }
  };

  const handleIdSubmit = async (e) => {
    e.preventDefault();
    if (!employeeId.trim()) {
      toast.error('Please enter your employee ID');
      return;
    }
    
    setProcessing(true);
    
    try {
      const response = await clockService.verifyEmployeeId(employeeId);
      
      if (response.data.success) {
        setEmployeeName(`${response.data.employee.firstName} ${response.data.employee.lastName}`);
        setStep('fingerprint');
        toast.success(`Welcome ${response.data.employee.firstName}! Please place your finger on the scanner.`, {
          duration: 3000,
          icon: '👆'
        });
        // Automatically start fingerprint capture
        await captureAndVerify(response.data.employee);
      } else {
        toast.error('Employee ID not found. Please try again.');
      }
    } catch (error) {
      toast.error('Error verifying employee ID');
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const captureAndVerify = async (employee) => {
    setScannerStatus('scanning');
    
    try {
      // Capture fingerprint (this will wait for finger)
      toast('Place your finger on the scanner...', { duration: 2000, icon: '👆' });
      
      const fingerprint = await fingerprintService.quickCaptureForClockIn();
      
      if (!fingerprint.success) {
        toast.error(fingerprint.message);
        setScannerStatus('ready');
        setStep('id');
        setEmployeeId('');
        return;
      }
      
      // Verify fingerprint matches
      setScannerStatus('processing');
      
      const response = await clockService.verifyFingerprint({
        employeeId: employee.employeeId,
        fingerprintHash: fingerprint.hash,
        fingerprintTemplate: fingerprint.template
      });
      
      if (response.data.success) {
        setWelcomeMessage(response.data.message);
        toast.success(response.data.message, { duration: 5000, icon: '👋' });
        await fetchLiveStatus();
        
        // Reset after 5 seconds
        setTimeout(() => {
          setWelcomeMessage('');
          setStep('id');
          setEmployeeId('');
          setEmployeeName('');
          setScannerStatus('ready');
        }, 5000);
      } else {
        toast.error(response.data.message || 'Fingerprint does not match');
        setScannerStatus('ready');
        setStep('id');
        setEmployeeId('');
      }
    } catch (error) {
      console.error('Clock-in error:', error);
      toast.error(error.response?.data?.message || 'Failed to clock in');
      setScannerStatus('ready');
      setStep('id');
      setEmployeeId('');
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleReset = () => {
    setStep('id');
    setEmployeeId('');
    setEmployeeName('');
    setWelcomeMessage('');
    setScannerStatus('ready');
  };

  return (
    <div className="clockin-container">
      <div className="clockin-grid">
        <div className="clockin-card">
          <div className="clockin-header">
            <h1>Altitude Register System</h1>
            <p>Attendance Management System</p>
          </div>
          
          <div className="clockin-content">
            <div className="clockin-time">
              <div className="time">{formatTime(currentTime)}</div>
              <div className="date">{formatDate(currentTime)}</div>
            </div>
            
            {welcomeMessage && (
              <div className="welcome-message">
                <p>{welcomeMessage}</p>
              </div>
            )}
            
            {step === 'id' ? (
              <form onSubmit={handleIdSubmit} className="id-form">
                <div className="form-group">
                  <label className="form-label">Enter Employee ID</label>
                  <input
                    type="text"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder="e.g., Emp02, test01, Emp001"
                    className="id-input"
                    autoFocus
                    disabled={processing}
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={processing}
                  className="clockin-button"
                >
                  {processing ? (
                    <div className="button-content">
                      <div className="spinner"></div>
                      <span>Verifying...</span>
                    </div>
                  ) : (
                    <div className="button-content">
                      <span>Continue</span>
                    </div>
                  )}
                </button>
                <p className="help-text">Enter your employee ID to begin</p>
              </form>
            ) : (
              <div className="fingerprint-section">
                <div className="scanner-status-container">
                  <div className={`scanner-indicator ${scannerStatus}`}>
                    <span className="indicator-dot"></span>
                    <span className="indicator-text">
                      {scannerStatus === 'ready' && 'Ready - Place Finger'}
                      {scannerStatus === 'scanning' && 'Scanning Fingerprint...'}
                      {scannerStatus === 'processing' && 'Verifying...'}
                    </span>
                  </div>
                </div>
                <div className="employee-info">
                  <p>Verifying fingerprint for:</p>
                  <strong>{employeeName || employeeId}</strong>
                </div>
                <div className="mt-3 text-center">
                  <p className="text-sm text-gray-500">Place your finger on the scanner</p>
                </div>
                <button 
                  onClick={handleReset}
                  className="reset-btn"
                >
                  ← Back to ID Entry
                </button>
              </div>
            )}
            
            <div className="clockin-footer-note">
              <p className="text-xs text-gray-400">You can only clock in once per day</p>
            </div>
          </div>
          
          <div className="clockin-footer">
            HID DigitalPersona 5300 • FBI PIV Certified • FAP 30 Certified
          </div>
        </div>
        
        <div className="live-status-card">
          <div className="live-status-header">
            <h2>Live Status</h2>
            <p>Currently Clocked In</p>
          </div>
          
          <div className="live-status-content">
            <div className="total-count">
              <div className="total-number">{liveStatus.totalClockedIn}</div>
              <div className="total-label">Employees Clocked In</div>
            </div>
            
            {Object.keys(liveStatus.byCampaign || {}).length > 0 && (
              <div className="campaign-stats">
                <h3>By Campaign:</h3>
                {Object.entries(liveStatus.byCampaign).map(([campaign, count]) => (
                  <div key={campaign} className="campaign-item">
                    <span className="campaign-name">{campaign}</span>
                    <span className="campaign-count">{count}</span>
                  </div>
                ))}
              </div>
            )}
            
            <div className="scanner-status-footer">
              <div className={`footer-dot ${scannerStatus === 'ready' ? 'ready' : 'active'}`}></div>
              <span className="status-text">
                {step === 'id' ? 'Ready for ID entry' : 'Waiting for fingerprint'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClockIn;