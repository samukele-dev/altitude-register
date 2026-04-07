import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-hot-toast';
import './Layout.css';

const Layout = ({ children }) => {
  const { user, logout, isAdmin, isTeamLeader } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', roles: ['admin', 'team_leader', 'agent'] },
    { name: 'Clock In', href: '/', roles: ['admin', 'team_leader', 'agent'] },
    { name: 'Enroll Employee', href: '/enroll', roles: ['admin'] },
    { name: 'Employees', href: '/employees', roles: ['admin', 'team_leader'] },
    { name: 'Reports', href: '/reports', roles: ['admin', 'team_leader'] },
  ];

  const filteredNav = navigation.filter(item => {
    if (item.roles.includes('admin') && isAdmin()) return true;
    if (item.roles.includes('team_leader') && isTeamLeader()) return true;
    if (item.roles.includes('agent') && !isAdmin() && !isTeamLeader()) return true;
    return false;
  });

  return (
    <div className="layout">
      <nav className="navbar">
        <div className="navbar-container">
          <div className="navbar-brand">
            <Link to="/" className="brand-text">
              <span className="brand-altitude">Altitude BPO </span>
              <span className="brand-register">Register</span>
            </Link>
          </div>
          
          <div className="navbar-menu">
            {filteredNav.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className="nav-link"
              >
                <span>{item.icon}</span>
                {item.name}
              </Link>
            ))}
          </div>
          
          <div className="navbar-user">
            <div className="user-info">
              <span>{user?.firstName} {user?.lastName}</span>
              <span className="user-role">{user?.role}</span>
            </div>
            <button onClick={handleLogout} className="logout-button">
              <svg className="logout-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
          
          <button 
            className="mobile-menu-button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <svg className="mobile-menu-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
        
        <div className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
          {filteredNav.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className="mobile-nav-link"
              onClick={() => setMobileMenuOpen(false)}
            >
              <span>{item.icon}</span>
              {item.name}
            </Link>
          ))}
          <div className="mobile-nav-link" style={{ borderTop: '1px solid var(--gray-200)', marginTop: '8px', paddingTop: '8px' }}>
            <span>{user?.firstName} {user?.lastName}</span>
            <span className="user-role">{user?.role}</span>
          </div>
          <button onClick={handleLogout} className="mobile-nav-link" style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}>
            <svg className="logout-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </nav>
      
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export default Layout;