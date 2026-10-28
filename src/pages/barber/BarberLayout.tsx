import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Bell } from 'lucide-react';
import BarberBottomNav from '@/components/barber/BarberBottomNav';
import { Toaster } from '@/components/ui/sonner';
import { useLiveBooking } from '@/contexts/LiveBookingContext';
import { useAuth } from '@/contexts/AuthContext';
import { getBarber } from '@/lib/db';

function NewBookingNotifier({ barberId }: { barberId: string }) {
  const navigate = useNavigate();
  const { allBookings } = useLiveBooking();
  const seenIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    const myPending = allBookings.filter(b => b.barberId === barberId && b.status === 'requested');
    if (seenIds.current === null) {
      seenIds.current = new Set(myPending.map(b => b.id));
      return;
    }
    for (const b of myPending) {
      if (seenIds.current.has(b.id)) continue;
      seenIds.current.add(b.id);
      toast(`💈 New booking request`, {
        description: `${b.service.name} · ${b.date} ${b.time} · ${b.totalPrice} JOD`,
        action: { label: 'View', onClick: () => navigate(`/barber/customer/${b.id}`) },
        duration: 8000,
        icon: <Bell size={16} />,
      });
    }
  }, [allBookings, navigate, barberId]);

  return null;
}

export default function BarberLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { barberUser } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  const uid = barberUser?.uid;
  const isOnboardingPage = location.pathname === '/barber/onboarding';
  const hideNav = location.pathname.startsWith('/barber/customer/') || isOnboardingPage;

  useEffect(() => {
    if (!uid) return;
    if (onboarded === true && !isOnboardingPage) return;

    let cancelled = false;
    (async () => {
      try {
        const barber = await getBarber(uid);
        if (cancelled) return;
        const complete = barber?.onboardingComplete === true;
        setOnboarded(complete);
        if (!complete && !isOnboardingPage) {
          navigate('/barber/onboarding', { replace: true });
        }
      } catch {
        if (!cancelled) {
          setOnboarded(false);
          if (!isOnboardingPage) navigate('/barber/onboarding', { replace: true });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [uid, isOnboardingPage, onboarded, navigate]);

  if (!uid) return null;

  if (onboarded === null && !isOnboardingPage) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center">
      <div className="w-full max-w-sm relative min-h-screen">
        {onboarded && <NewBookingNotifier barberId={uid} />}
        <div className={`min-h-screen ${hideNav ? '' : 'pb-28'}`}>
          <Outlet />
        </div>
        {!hideNav && onboarded && <BarberBottomNav />}
        <Toaster />
      </div>
    </div>
  );
}
