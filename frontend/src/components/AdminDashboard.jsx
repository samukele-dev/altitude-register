import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { clockService, reportService, employeeService } from '../services/api';
import Layout from './Layout';
import './Dashboard.css';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [liveStatus, setLiveStatus] = useState({ totalClockedIn: 0, byCampaign: {}, byTeam: {} });
  const [recentAttendance, setRecentAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [campaignsList, setCampaignsList] = useState([]);
  const [teamsList, setTeamsList] = useState([]);
  const [error, setError] = useState(null);

  // Helper function to format Firestore timestamp
  const formatClockDateTime = (timestamp) => {
    if (!timestamp) return { date: 'N/A', time: 'N/A' };
    
    try {
      // Handle Firestore Timestamp object
      if (timestamp && typeof timestamp === 'object' && timestamp.toDate) {
        const date = timestamp.toDate();
        return {
          date: date.toLocaleDateString(),
          time: date.toLocaleTimeString()
        };
      }
      
      // Handle ISO string or regular Date
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return { date: 'Invalid', time: 'Invalid' };
      return {
        date: date.toLocaleDateString(),
        time: date.toLocaleTimeString()
      };
    } catch (e) {
      return { date: 'Invalid', time: 'Invalid' };
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      console.log('📊 Fetching dashboard data...');
      
      const [liveRes, attendanceRes, campaignsRes, teamsRes, employeesRes] = await Promise.all([
        clockService.getLiveStatus(),
        clockService.getTodayStatus(),
        reportService.getCampaigns(),
        reportService.getTeams(),
        employeeService.getAll({ isActive: true, limit: 1000 })
      ]);

      if (liveRes.data.success) {
        setLiveStatus(liveRes.data.data);
      }

      if (attendanceRes.data.success) {
        setRecentAttendance(attendanceRes.data.data.clockedIn?.slice(0, 10) || []);
      }

      if (campaignsRes.data.success) {
        setCampaignsList(campaignsRes.data.data || []);
      }

      if (teamsRes.data.success) {
        setTeamsList(teamsRes.data.data || []);
      }

      if (employeesRes.data.success) {
        setTotalEmployees(employeesRes.data.data.length);
      }

      setError(null);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setError(error.message);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="loading-overlay">
          <div className="spinner spinner-lg"></div>
          <p style={{ marginTop: '1rem' }}>Loading dashboard...</p>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>
          <h3>Error loading dashboard</h3>
          <p>{error}</p>
          <button onClick={fetchData} className="btn btn-primary">Retry</button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="dashboard-container">
        <div className="dashboard-content">
          <div className="dashboard-header">
            <h1>Welcome back, {user?.firstName}!</h1>
            <p>Here's what's happening with your team today.</p>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="stat-label">Currently Clocked In</div>
              <div className="stat-number">{liveStatus.totalClockedIn}</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="stat-label">Total Employees</div>
              <div className="stat-number">{totalEmployees}</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div className="stat-label">Campaigns</div>
              <div className="stat-number">{campaignsList.length}</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="stat-label">Teams</div>
              <div className="stat-number">{teamsList.length}</div>
            </div>
          </div>

          <div className="charts-grid">
            <div className="chart-card">
              <div className="chart-header">
                <h2>Campaigns</h2>
              </div>
              <div className="chart-body">
                {campaignsList.length > 0 ? (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {campaignsList.map(campaign => (
                      <li key={campaign.id} style={{ 
                        padding: '12px', 
                        borderBottom: '1px solid #eee',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span><strong>{campaign.name}</strong></span>
                        <span className="badge badge-info">{campaign.agentCount || 0} agents</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
                    No campaigns yet.
                  </p>
                )}
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-header">
                <h2>Teams</h2>
              </div>
              <div className="chart-body">
                {teamsList.length > 0 ? (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {teamsList.map(team => (
                      <li key={team.id} style={{ 
                        padding: '12px', 
                        borderBottom: '1px solid #eee',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <strong>{team.name}</strong>
                          <div style={{ fontSize: '12px', color: '#666' }}>{team.campaign}</div>
                        </div>
                        <span className="badge badge-info">{team.agentCount || 0} agents</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
                    No teams yet.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="table-card">
            <div className="table-header">
              <h2>Recent Clock-ins</h2>
            </div>
            <div className="table-responsive">
              <table className="attendance-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Campaign</th>
                    <th>Team</th>
                    <th>Date</th>
                    <th>Clock In Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAttendance.length > 0 ? (
                    recentAttendance.map((record, idx) => {
                      const dateTime = formatClockDateTime(record.clockInTime);
                      return (
                        <tr key={idx}>
                          <td>
                            <div className="employee-name">
                              {record.user?.firstName} {record.user?.lastName}
                            </div>
                            <div className="employee-id">{record.user?.employeeId}</div>
                          </td>
                          <td>{record.user?.campaign}</td>
                          <td>{record.user?.team}</td>
                          <td>{dateTime.date}</td>
                          <td>{dateTime.time}</td>
                          <td>
                            <span className="badge badge-success">Clocked In</span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" className="empty-state">
                        No recent clock-ins.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AdminDashboard;