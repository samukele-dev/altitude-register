import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import fingerprintService from '../services/fingerprintService';
import { employeeService, reportService } from '../services/api';
import './EnrollmentForm.css';

const EnrollmentForm = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [fingerprintData, setFingerprintData] = useState(null);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 5, quality: 0, status: 'idle' });
  const [campaigns, setCampaigns] = useState([]);
  const [teams, setTeams] = useState([]);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [showNewTeam, setShowNewTeam] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    employeeId: '',
    email: '',
    phoneNumber: '',
    idNumber: '',
    campaign: '',
    team: '',
  });

  useEffect(() => {
    loadDropdownData();
  }, []);

  const loadDropdownData = async () => {
    try {
      const [campaignsRes, teamsRes] = await Promise.all([
        reportService.getCampaigns(),
        reportService.getTeams()
      ]);
      setCampaigns(campaignsRes.data.data || []);
      setTeams(teamsRes.data.data || []);
    } catch (error) {
      console.error('Failed to load dropdown data:', error);
    }
  };

  const handleCampaignChange = (e) => {
    const value = e.target.value;
    if (value === '__new__') {
      setShowNewCampaign(true);
      setFormData({ ...formData, campaign: '' });
    } else {
      setShowNewCampaign(false);
      setFormData({ ...formData, campaign: value });
      setNewCampaignName('');
    }
  };

  const handleNewCampaignChange = (e) => {
    const value = e.target.value;
    setNewCampaignName(value);
    setFormData({ ...formData, campaign: value });
  };

  const handleTeamChange = (e) => {
    const value = e.target.value;
    if (value === '__new__') {
      setShowNewTeam(true);
      setFormData({ ...formData, team: '' });
    } else {
      setShowNewTeam(false);
      setFormData({ ...formData, team: value });
      setNewTeamName('');
    }
  };

  const handleNewTeamChange = (e) => {
    const value = e.target.value;
    setNewTeamName(value);
    setFormData({ ...formData, team: value });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const captureFingerprint = async () => {
    setCapturing(true);
    setScanProgress({ current: 0, total: 5, quality: 0, status: 'scanning' });
    
    toast('Please place your finger on the scanner. We will capture 5 scans.', {
      duration: 3000,
      icon: '🖐️'
    });
    
    try {
      const result = await fingerprintService.captureFingerprint();
      
      if (result.success) {
        setFingerprintData({
          template: result.template,
          hash: result.hash,
          quality: result.quality,
          scans: result.scans
        });
        
        setScanProgress({
          current: result.scans,
          total: 5,
          quality: result.quality,
          status: 'complete'
        });
        
        toast.success(result.message);
      } else {
        toast.error(result.message || 'Failed to capture fingerprint');
        setScanProgress({ current: 0, total: 5, quality: 0, status: 'error' });
      }
    } catch (error) {
      toast.error('Error capturing fingerprint. Please ensure scanner is connected.');
      console.error(error);
      setScanProgress({ current: 0, total: 5, quality: 0, status: 'error' });
    } finally {
      setCapturing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!fingerprintData) {
      toast.error('Please capture fingerprint first');
      return;
    }

    if (!formData.campaign) {
      toast.error('Please select or create a campaign');
      return;
    }

    if (!formData.team) {
      toast.error('Please select or create a team');
      return;
    }

    setLoading(true);
    
    try {
      const enrollmentData = {
        ...formData,
        fingerprintTemplate: fingerprintData.template,
        fingerprintHash: fingerprintData.hash,
        fingerprintQuality: fingerprintData.quality
      };
      
      const response = await employeeService.enroll(enrollmentData);
      
      if (response.data.success) {
        toast.success('Employee enrolled successfully!');
        setFormData({
          firstName: '',
          lastName: '',
          employeeId: '',
          email: '',
          phoneNumber: '',
          idNumber: '',
          campaign: '',
          team: '',
        });
        setFingerprintData(null);
        setScanProgress({ current: 0, total: 5, quality: 0, status: 'idle' });
        setShowNewCampaign(false);
        setShowNewTeam(false);
        setNewCampaignName('');
        setNewTeamName('');
        
        loadDropdownData();
        
        setTimeout(() => {
          navigate('/employees');
        }, 2000);
      }
    } catch (error) {
      console.error('Enrollment error:', error);
      toast.error(error.response?.data?.message || 'Failed to enroll employee');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="enrollment-container">
      <div className="enrollment-card">
        <div className="enrollment-header">
          <div className="header-icon">👤</div>
          <h1>Employee Enrollment</h1>
          <p>Register new employee with biometric fingerprint</p>
          <div className="badge">5 scans required for best accuracy</div>
        </div>
        
        <form onSubmit={handleSubmit} className="enrollment-form">
          <div className="form-grid">
            {/* Personal Information */}
            <div className="form-section">
              <h3>
                <span className="section-icon">📋</span>
                Personal Information
              </h3>
              
              <div className="input-group">
                <input
                  type="text"
                  name="firstName"
                  placeholder="First Name"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                />
                <input
                  type="text"
                  name="lastName"
                  placeholder="Last Name"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <input
                type="text"
                name="idNumber"
                placeholder="ID Number"
                value={formData.idNumber}
                onChange={handleChange}
                required
              />
              
              <input
                type="email"
                name="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={handleChange}
                required
              />
              
              <input
                type="tel"
                name="phoneNumber"
                placeholder="Cell Number"
                value={formData.phoneNumber}
                onChange={handleChange}
                required
              />
            </div>
            
            {/* Work Information */}
            <div className="form-section">
              <h3>
                <span className="section-icon">💼</span>
                Work Information
              </h3>
              
              <input
                type="text"
                name="employeeId"
                placeholder="Employee Number"
                value={formData.employeeId}
                onChange={handleChange}
                required
              />
              
              <div className="select-group">
                <select
                  name="campaign"
                  value={showNewCampaign ? '__new__' : formData.campaign}
                  onChange={handleCampaignChange}
                  required
                >
                  <option value="">Select Campaign</option>
                  {campaigns.map(campaign => (
                    <option key={campaign.id || campaign.name} value={campaign.name}>
                      {campaign.name} ({campaign.agentCount || 0})
                    </option>
                  ))}
                  <option value="__new__">+ Create New Campaign</option>
                </select>
                
                {showNewCampaign && (
                  <input
                    type="text"
                    placeholder="New campaign name"
                    value={newCampaignName}
                    onChange={handleNewCampaignChange}
                    required
                  />
                )}
              </div>
              
              <div className="select-group">
                <select
                  name="team"
                  value={showNewTeam ? '__new__' : formData.team}
                  onChange={handleTeamChange}
                  required
                >
                  <option value="">Select Team</option>
                  {teams
                    .filter(team => !formData.campaign || team.campaign === formData.campaign)
                    .map(team => (
                      <option key={team.id || team.name} value={team.name}>
                        {team.name} ({team.agentCount || 0})
                      </option>
                    ))
                  }
                  <option value="__new__">+ Create New Team</option>
                </select>
                
                {showNewTeam && (
                  <input
                    type="text"
                    placeholder="New team name"
                    value={newTeamName}
                    onChange={handleNewTeamChange}
                    required
                  />
                )}
              </div>
            </div>
          </div>
          
          {/* Fingerprint Capture Section */}
          <div className="fingerprint-section">
            <h3>
              <span className="section-icon">🖐️</span>
              Fingerprint Enrollment
            </h3>
            <p className="section-note">Place your finger on the HID DigitalPersona 5300 scanner</p>
            
            <div className="fingerprint-area">
              {!fingerprintData ? (
                <div className="fingerprint-placeholder">
                  <div className="fingerprint-icon">🖐️</div>
                  <p>No fingerprint captured yet</p>
                  <small>5 scans required for best accuracy</small>
                </div>
              ) : (
                <div className="fingerprint-success-card">
                  <div className="success-icon">✓</div>
                  <div className="success-details">
                    <strong>Fingerprint Captured</strong>
                    <span>Quality: {fingerprintData.quality}%</span>
                    <span>Scans: {fingerprintData.scans}/5 successful</span>
                  </div>
                </div>
              )}
              
              {capturing && (
                <div className="scan-progress">
                  <div className="progress-ring">
                    <svg width="80" height="80" viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r="35" fill="none" stroke="#e5e7eb" strokeWidth="4"/>
                      <circle 
                        cx="40" cy="40" r="35" fill="none" stroke="#4f46e5" strokeWidth="4"
                        strokeDasharray={`${(scanProgress.current / scanProgress.total) * 219.8} 219.8`}
                        strokeLinecap="round"
                        transform="rotate(-90 40 40)"
                      />
                    </svg>
                  </div>
                  <div className="scan-info">
                    <span className="scan-count">Scan {scanProgress.current} of {scanProgress.total}</span>
                    <div className="scan-status">Place finger on scanner...</div>
                  </div>
                </div>
              )}
            </div>
            
            <button
              type="button"
              onClick={captureFingerprint}
              disabled={capturing}
              className={`capture-btn ${fingerprintData ? 'recapture' : ''}`}
            >
              {capturing ? (
                <>
                  <span className="spinner"></span>
                  Capturing...
                </>
              ) : fingerprintData ? (
                <>
                  <span>⟳</span>
                  Recapture Fingerprint
                </>
              ) : (
                <>
                  <span>🖐️</span>
                  Start Fingerprint Capture (5 scans)
                </>
              )}
            </button>
          </div>
          
          <button
            type="submit"
            disabled={loading || !fingerprintData}
            className="submit-btn"
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Enrolling...
              </>
            ) : (
              '✓ Enroll Employee'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EnrollmentForm;