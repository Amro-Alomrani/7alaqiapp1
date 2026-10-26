import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';

/** Navigate back inside the app, with a stable fallback for deep links. */
export function useSafeBack() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return useCallback(() => {
    const isNativeRoot = Capacitor.isNativePlatform() && (
      pathname === '/' || pathname === '/intro' || pathname === '/barber'
    );
    if (isNativeRoot) {
      void import('@capacitor/app').then(({ App }) => App.exitApp()).catch(() => undefined);
      return;
    }

    const index = window.history.state?.idx;
    if (typeof index === 'number' && index > 0) {
      navigate(-1);
      return;
    }

    if (pathname === '/register' || pathname === '/login' || pathname === '/barber/login') {
      navigate('/select-role', { replace: true });
    } else if (pathname === '/select-role') {
      navigate('/intro', { replace: true });
    } else if (pathname.startsWith('/barber/') && pathname !== '/barber/login') {
      navigate('/barber', { replace: true });
    } else if (pathname !== '/barber' && pathname !== '/intro' && pathname !== '/') {
      navigate('/', { replace: true });
    } else if (Capacitor.isNativePlatform()) {
      void import('@capacitor/app').then(({ App }) => App.exitApp()).catch(() => undefined);
    }
  }, [navigate, pathname]);
}
