import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { employeeService, reportService } from '../services/api';
import { toast } from 'react-hot-toast';
import './Employees.css';

const Employees = () => {
  const { user, isAdmin } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [campaigns, setCampaigns] = useState([]);
  const [teams, setTeams] = useState([]);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    fetchEmployees();
    fetchFilters();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await employeeService.getAll({ isActive: true, limit: 1000 });
      if (response.data.success) {
        setEmployees(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch employees:', error);
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const fetchFilters = async () => {
    try {
      const [campaignsRes, teamsRes] = await Promise.all([
        reportService.getCampaigns(),
        reportService.getTeams()
      ]);
      setCampaigns(campaignsRes.data.data || []);
      setTeams(teamsRes.data.data || []);
    } catch (error) {
      console.error('Failed to fetch filters:', error);
    }
  };

  const handleDelete = async (employeeId, employeeName) => {
    if (window.confirm(`Are you sure you want to delete ${employeeName}?`)) {
      try {
        const response = await employeeService.delete(employeeId);
        if (response.data.success) {
          toast.success('Employee deactivated successfully');
          fetchEmployees();
        }
      } catch (error) {
        toast.error('Failed to delete employee');
      }
    }
  };

  const handleEdit = (employee) => {
    setEditingEmployee({ ...employee });
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    try {
      const response = await employeeService.update(editingEmployee.id, {
        firstName: editingEmployee.firstName,
        lastName: editingEmployee.lastName,
        email: editingEmployee.email,
        phoneNumber: editingEmployee.phoneNumber,
        campaign: editingEmployee.campaign,
        team: editingEmployee.team,
        isActive: editingEmployee.isActive
      });
      if (response.data.success) {
        toast.success('Employee updated successfully');
        setShowEditModal(false);
        fetchEmployees();
      }
    } catch (error) {
      toast.error('Failed to update employee');
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = 
      emp.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCampaign = !selectedCampaign || emp.campaign === selectedCampaign;
    const matchesTeam = !selectedTeam || emp.team === selectedTeam;
    
    return matchesSearch && matchesCampaign && matchesTeam;
  });

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner spinner-lg"></div>
      </div>
    );
  }

  return (
    <div className="employees-container">
      <div className="employees-header">
        <h1>Employee Management</h1>
        <p>View, edit, and manage all enrolled employees</p>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by name, ID, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <select
          value={selectedCampaign}
          onChange={(e) => setSelectedCampaign(e.target.value)}
          className="filter-select"
        >
          <option value="">All Campaigns</option>
          {campaigns.map(c => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
        <select
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
          className="filter-select"
        >
          <option value="">All Teams</option>
          {teams.map(t => (
            <option key={t.id} value={t.name}>{t.name}</option>
          ))}
        </select>
        <button onClick={fetchEmployees} className="refresh-btn">🔄 Refresh</button>
      </div>

      {/* Employee Table */}
      <div className="employees-table-container">
        <table className="employees-table">
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Campaign</th>
              <th>Team</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.length > 0 ? (
              filteredEmployees.map(emp => (
                <tr key={emp.id}>
                  <td>{emp.employeeId}</td>
                  <td>{emp.firstName} {emp.lastName}</td>
                  <td>{emp.email}</td>
                  <td>{emp.phoneNumber}</td>
                  <td><span className="badge-campaign">{emp.campaign}</span></td>
                  <td><span className="badge-team">{emp.team}</span></td>
                  <td>
                    <span className={`status-badge ${emp.isActive ? 'active' : 'inactive'}`}>
                      {emp.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="actions">
                    <button 
                      onClick={() => handleEdit(emp)} 
                      className="edit-btn"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button 
                      onClick={() => handleDelete(emp.id, `${emp.firstName} ${emp.lastName}`)} 
                      className="delete-btn"
                      title="Delete"
                    >
                      🗑️
                    </button>
                   </td>
                 </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="empty-state">No employees found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {showEditModal && editingEmployee && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Edit Employee</h2>
              <button onClick={() => setShowEditModal(false)} className="close-btn">&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>First Name</label>
                <input
                  type="text"
                  value={editingEmployee.firstName || ''}
                  onChange={(e) => setEditingEmployee({...editingEmployee, firstName: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input
                  type="text"
                  value={editingEmployee.lastName || ''}
                  onChange={(e) => setEditingEmployee({...editingEmployee, lastName: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={editingEmployee.email || ''}
                  onChange={(e) => setEditingEmployee({...editingEmployee, email: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input
                  type="tel"
                  value={editingEmployee.phoneNumber || ''}
                  onChange={(e) => setEditingEmployee({...editingEmployee, phoneNumber: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Campaign</label>
                <select
                  value={editingEmployee.campaign || ''}
                  onChange={(e) => setEditingEmployee({...editingEmployee, campaign: e.target.value})}
                >
                  {campaigns.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Team</label>
                <select
                  value={editingEmployee.team || ''}
                  onChange={(e) => setEditingEmployee({...editingEmployee, team: e.target.value})}
                >
                  {teams.filter(t => t.campaign === editingEmployee.campaign).map(t => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={editingEmployee.isActive !== false}
                    onChange={(e) => setEditingEmployee({...editingEmployee, isActive: e.target.checked})}
                  />
                  Active
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowEditModal(false)} className="cancel-btn">Cancel</button>
              <button onClick={handleUpdate} className="save-btn">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Employees;