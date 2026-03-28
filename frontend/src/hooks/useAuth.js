import { useState, useEffect } from 'react';
import { authService } from '../services/api';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    const storedUser = authService.getCurrentUser();
    if (storedUser) {
      setUser(storedUser);
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      console.log('🔐 Login attempt:', { email });
      const response = await authService.login({ email, password });
      console.log('📥 Login response:', response.data);
      
      if (response.data.success) {
        const { user, token } = response.data.data;
        authService.setUser(user);
        authService.setToken(token);
        setUser(user);
        setToken(token);
        console.log('✅ Login successful for:', user.email);
        return { success: true, user };
      }
      return { success: false, error: response.data.message || 'Login failed' };
    } catch (error) {
      console.error('❌ Login error:', error.response?.data || error.message);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Login failed. Please try again.' 
      };
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setToken(null);
  };

  const isAdmin = () => user?.role === 'admin';
  const isTeamLeader = () => user?.role === 'team_leader' || user?.role === 'admin';
  const isAgent = () => user?.role === 'agent';

  return {
    user,
    token,
    loading,
    login,
    logout,
    isAdmin,
    isTeamLeader,
    isAgent,
    isAuthenticated: !!user
  };
};