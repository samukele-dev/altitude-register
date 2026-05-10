import { useEffect } from 'react';
import { useAuth } from './useAuth';

export const useActivityTracker = () => {
  const { logout } = useAuth();
  let inactivityTimer;

  const resetTimer = () => {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      logout();
    }, 30 * 60 * 1000); // 30 minutes
  };

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    
    resetTimer();
    
    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });
    
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
      if (inactivityTimer) clearTimeout(inactivityTimer);
    };
  }, []);
};