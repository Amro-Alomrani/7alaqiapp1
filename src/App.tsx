import { HashRouter, Routes, Route, Outlet, useLocation, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import BottomNav from '@/components/layout/BottomNav';
import BarberStatusNotifier from '@/components/BarberStatusNotifier';
import NotificationsListener from '@/components/NotificationsListener';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { LiveBookingProvider } from '@/contexts/LiveBookingContext';
import { DataProvider } from '@/contexts/DataContext';
import { lazy, Suspense, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { useSafeBack } from '@/hooks/useSafeBack';
import { loyaltyEnabled } from '@/lib/features';

const Loader = () => <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

function NativeBackButtonHandler() {
  const safeBack = useSafeBack();
  const safeBackRef = useRef(safeBack);

  useEffect(() => { safeBackRef.current = safeBack; }, [safeBack]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false;
    let listener: { remove: () => Promise<void> } | undefined;
    void import('@capacitor/app').then(async ({ App }) => {
      listener = await App.addListener('backButton', () => safeBackRef.current());
      if (disposed) await listener.remove();
    }).catch(() => undefined);
    return () => {
      disposed = true;
      void listener?.remove();
    };
  }, []);

  return null;
}

const HomePage = lazy(() => import('@/pages/HomePage'));
const FeedPage = lazy(() => import('@/pages/FeedPage'));
const StyleMatchPage = lazy(() => import('@/pages/StyleMatchPage'));
const ExplorePage = lazy(() => import('@/pages/ExplorePage'));
const SalonPage = lazy(() => import('@/pages/SalonPage'));
const BarberDetailPage = lazy(() => import('@/pages/BarberDetailPage'));
const BookingPage = lazy(() => import('@/pages/BookingPage'));
const BookingSuccessPage = lazy(() => import('@/pages/BookingSuccessPage'));
const BookingStatusPage = lazy(() => import('@/pages/BookingStatusPage'));
const MapPage = lazy(() => import('@/pages/MapPage'));
const TrackingPage = lazy(() => import('@/pages/TrackingPage'));
const ChatPage = lazy(() => import('@/pages/ChatPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const HistoryPage = lazy(() => import('@/pages/HistoryPage'));
const QueuePage = lazy(() => import('@/pages/QueuePage'));
const HomeServicePage = lazy(() => import('@/pages/HomeServicePage'));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'));
const FavoritesPage = lazy(() => import('@/pages/FavoritesPage'));
const MessagesPage = lazy(() => import('@/pages/MessagesPage'));
const QRScanPage = lazy(() => import('@/pages/QRScanPage'));

const IntroPage = lazy(() => import('@/pages/IntroPage'));
const RoleSelectPage = lazy(() => import('@/pages/auth/RoleSelectPage'));
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const BarberLoginPage = lazy(() => import('@/pages/auth/BarberLoginPage'));
const LegalPage = lazy(() => import('@/pages/LegalPage'));
const DeleteAccountPage = lazy(() => import('@/pages/DeleteAccountPage'));

const BarberLayout = lazy(() => import('@/pages/barber/BarberLayout'));
const BarberDashboardPage = lazy(() => import('@/pages/barber/BarberDashboardPage'));
const BarberBookingsPage = lazy(() => import('@/pages/barber/BarberBookingsPage'));
const BarberQueuePage = lazy(() => import('@/pages/barber/BarberQueuePage'));
const BarberServicesPage = lazy(() => import('@/pages/barber/BarberServicesPage'));
const BarberProfilePage = lazy(() => import('@/pages/barber/BarberProfilePage'));
const BarberEarningsPage = lazy(() => import('@/pages/barber/BarberEarningsPage'));
const BarberCustomerMapPage = lazy(() => import('@/pages/barber/BarberCustomerMapPage'));
const BarberQRPage = lazy(() => import('@/pages/barber/BarberQRPage'));
const BarberStaffPage = lazy(() => import('@/pages/barber/BarberStaffPage'));
const BarberOnboardingPage = lazy(() => import('@/pages/barber/BarberOnboardingPage'));
const BookingChatPage = lazy(() => import('@/pages/BookingChatPage'));
const HIDE_NAV_PATHS = ['/booking-success', '/booking-status', '/queue', '/home-service', '/notifications', '/favorites', '/history', '/map', '/tracking', '/barbers/', '/salons/', '/chat', '/booking-chat/', '/messages', '/qr-scan'];

function CustomerGuard() {
  const { isCustomerLoggedIn, authReady } = useAuth();
  if (!authReady) return <Loader />;
  if (!isCustomerLoggedIn) return <Navigate to="/intro" replace />;
  return <Outlet />;
}

function BarberGuard() {
  const { isBarberLoggedIn, authReady } = useAuth();
  if (!authReady) return <Loader />;
  if (!isBarberLoggedIn) return <Navigate to="/barber/login" replace />;
  return <Outlet />;
}

function CustomerLayout() {
  const location = useLocation();
  const hideNav = HIDE_NAV_PATHS.some(p => location.pathname.startsWith(p)) ||
    location.pathname.startsWith('/book/');

  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-sm relative min-h-screen">
        <BarberStatusNotifier />
        <Outlet />
        {!hideNav && <BottomNav />}
        <Toaster />
      </div>
    </div>
  );
}

function AuthLayout() {
  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-sm">
        <Outlet />
      </div>
      <Toaster />
    </div>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<Loader />}>
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/intro" element={<IntroPage />} />
        <Route path="/select-role" element={<RoleSelectPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/barber/login" element={<BarberLoginPage />} />
        <Route path="/privacy" element={<LegalPage kind="privacy" />} />
        <Route path="/terms" element={<LegalPage kind="terms" />} />
      </Route>

      <Route path="/delete-account" element={<DeleteAccountPage />} />

      <Route element={<BarberGuard />}>
        <Route path="/barber" element={<BarberLayout />}>
          <Route index element={<BarberDashboardPage />} />
          <Route path="onboarding" element={<BarberOnboardingPage />} />
          <Route path="bookings" element={<BarberBookingsPage />} />
          <Route path="queue" element={<BarberQueuePage />} />
          <Route path="services" element={<BarberServicesPage />} />
          <Route path="profile" element={<BarberProfilePage />} />
          <Route path="earnings" element={<BarberEarningsPage />} />
          <Route path="staff" element={<BarberStaffPage />} />
          <Route path="customer/:bookingId" element={<BarberCustomerMapPage />} />
          <Route path="chat/:bookingId" element={<BookingChatPage />} />
          <Route path="qr" element={loyaltyEnabled ? <BarberQRPage /> : <Navigate to="/barber/profile" replace />} />
        </Route>
      </Route>

      <Route element={<CustomerLayout />}>
        <Route path="/barbers/:id" element={<BarberDetailPage />} />
        <Route path="/salons/:id" element={<SalonPage />} />
      </Route>

      <Route element={<CustomerGuard />}>
        <Route element={<CustomerLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/styles" element={<StyleMatchPage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/book/:barberId" element={<BookingPage />} />
          <Route path="/booking-success" element={<BookingSuccessPage />} />
          <Route path="/booking-status" element={<BookingStatusPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/tracking" element={<TrackingPage />} />
          <Route path="/queue" element={<QueuePage />} />
          <Route path="/home-service" element={<HomeServicePage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/booking-chat/:bookingId" element={<BookingChatPage />} />
          <Route path="/qr-scan" element={loyaltyEnabled ? <QRScanPage /> : <Navigate to="/profile" replace />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/intro" replace />} />
    </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <DataProvider>
              <LiveBookingProvider>
                <NativeBackButtonHandler />
                <NotificationsListener />
                <AppRoutes />
              </LiveBookingProvider>
            </DataProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </HashRouter>
  );
}
