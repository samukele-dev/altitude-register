import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-hot-toast';

const SessionWarning = () => {
  const { logout } = useAuth();
  const [warningShown, setWarningShown] = useState(false);

  useEffect(() => {
    // Set timeout for 25 minutes (1500000 ms) - warn before 30 min expiry
    const warningTimer = setTimeout(() => {
      if (!warningShown) {
        setWarningShown(true);
        toast(
          (t) => (
            <div>
              <p>Your session will expire in 5 minutes.</p>
              <button 
                onClick={() => {
                  toast.dismiss(t.id);
                  // Refresh token or stay logged in
                }}
                style={{
                  marginTop: '8px',
                  padding: '4px 12px',
                  background: '#4f46e5',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Stay Logged In
              </button>
            </div>
          ),
          { duration: 10000 }
        );
      }
    }, 25 * 60 * 1000); // 25 minutes

    // Set timeout to auto logout at 30 minutes
    const logoutTimer = setTimeout(() => {
      toast.error('Session expired. Logging out...');
      logout();
    }, 30 * 60 * 1000); // 30 minutes

    return () => {
      clearTimeout(warningTimer);
      clearTimeout(logoutTimer);
    };
  }, [logout, warningShown]);

  return null;
};

export default SessionWarning;