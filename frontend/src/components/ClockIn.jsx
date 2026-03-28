import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import fingerprintService from '../services/fingerprintService';
import { clockService } from '../services/api';
import './ClockIn.css';

const ClockIn = () => {
  const [capturing, setCapturing] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [liveStatus, setLiveStatus] = useState({ totalClockedIn: 0, byCampaign: {} });

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

  const handleClockInOut = async () => {
    setCapturing(true);
    setWelcomeMessage('');
    
    try {
      toast.info('Please place your finger on the scanner...', {
        duration: 2000,
        icon: '👆'
      });
      
      const fingerprint = await fingerprintService.captureFingerprint();
      
      if (!fingerprint.success) {
        toast.error(fingerprint.message);
        setCapturing(false);
        return;
      }
      
      const response = await clockService.clockInOut({
        fingerprintHash: fingerprint.hash,
        fingerprintTemplate: fingerprint.template
      });
      
      if (response.data.success) {
        setWelcomeMessage(response.data.message);
        toast.success(response.data.message, {
          duration: 5000,
          icon: response.data.data.status === 'clocked_in' ? '👋' : '👋'
        });
        
        await fetchLiveStatus();
        
        setTimeout(() => {
          setWelcomeMessage('');
        }, 5000);
      }
    } catch (error) {
      console.error('Clock in/out error:', error);
      toast.error(error.response?.data?.message || 'Failed to process. Please try again.');
    } finally {
      setCapturing(false);
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

  return (
    <div className="clockin-container">
      <div className="clockin-grid">
        {/* Main Clock In Card */}
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
            
            <button
              onClick={handleClockInOut}
              disabled={capturing}
              className="clockin-button"
            >
              {capturing ? (
                <div className="button-content">
                  <div className="spinner"></div>
                  <span>Processing...</span>
                </div>
              ) : (
                <div className="button-content">
                  <svg className="button-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Scan Fingerprint to Clock In/Out</span>
                </div>
              )}
            </button>
            
            <div className="mt-3 text-center">
              <p className="text-sm text-gray-500">Place your finger on the HID DigitalPersona 5300 scanner</p>
              <p className="text-xs text-gray-400 mt-1">The system will automatically detect clock in or clock out</p>
            </div>
          </div>
          
          <div className="clockin-footer">
            HID DigitalPersona 5300 • FBI PIV Certified • FAP 30 Certified
          </div>
        </div>
        
        {/* Live Status Card */}
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
            
            <div className="scanner-status">
              <div className="status-dot"></div>
              <span className="status-text">Scanner Ready</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClockIn;