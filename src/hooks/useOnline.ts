import { useState, useEffect } from 'react';
import { devLog } from '../lib/devLog';

export const useOnline = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      devLog('🌐 Connexion internet rétablie');
      setIsOnline(true);
    };

    const handleOffline = () => {
      devLog('📴 Mode offline activé');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};

