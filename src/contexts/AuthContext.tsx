import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { signOutAll } from '@/lib/auth-providers';

interface CustomerUser {
  uid: string;
  name: string;
  phone: string;
  avatar: string;
}

interface BarberUser {
  uid: string;
  name: string;
  email: string;
  shopName: string;
  avatar?: string;
}

interface AuthContextType {
  customer: CustomerUser | null;
  barberUser: BarberUser | null;
  authReady: boolean;
  loginCustomer: (phone: string, name?: string, uid?: string) => void;
  logoutCustomer: () => void;
  loginBarber: (email: string, uid?: string, name?: string, shopName?: string) => void;
  logoutBarber: () => void;
  updateCustomerAvatar: (url: string) => void;
  isCustomerLoggedIn: boolean;
  isBarberLoggedIn: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const loadFromStorage = <T extends object>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const migrateCustomer = (c: CustomerUser | null): CustomerUser | null => {
  if (!c) return null;
  if (!c.uid || c.uid.startsWith('demo')) {
    localStorage.removeItem('barberco_customer');
    return null;
  }
  return c;
};
const migrateBarber = (b: BarberUser | null): BarberUser | null => {
  if (!b) return null;
  if (!b.uid || b.uid.startsWith('demo')) {
    localStorage.removeItem('barberco_barber');
    return null;
  }
  return b;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<CustomerUser | null>(
    () => migrateCustomer(loadFromStorage<CustomerUser>('barberco_customer'))
  );
  const [barberUser, setBarberUser] = useState<BarberUser | null>(
    () => migrateBarber(loadFromStorage<BarberUser>('barberco_barber'))
  );
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    (async () => {
      try {
        const { onAuthChange } = await import('@/lib/firebase');
        unsubscribe = await onAuthChange(fbUser => {
          if (!mounted) return;
          setAuthReady(true);

          if (!fbUser) {
            setBarberUser(null);
            setCustomer(null);
            localStorage.removeItem('barberco_barber');
            localStorage.removeItem('barberco_customer');
            return;
          }

          // Never expose cached data belonging to a different Firebase user.
          const storedCustomer = loadFromStorage<CustomerUser>('barberco_customer');
          const storedBarber = loadFromStorage<BarberUser>('barberco_barber');
          setCustomer(storedCustomer?.uid === fbUser.uid ? storedCustomer : null);
          setBarberUser(storedBarber?.uid === fbUser.uid ? storedBarber : null);
        });
        if (!mounted) unsubscribe();
      } catch {
        if (mounted) setAuthReady(true);
      }
    })();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Register once per authenticated session, including sessions restored from
  // local storage after the app is reopened. Store only the native FCM token;
  // browser push needs a separate VAPID/service-worker setup.
  useEffect(() => {
    const uid = customer?.uid || barberUser?.uid;
    if (!authReady || !uid) return;
    let cancelled = false;
    void (async () => {
      try {
        const { requestFcmToken } = await import('@/lib/firebase');
        const token = await requestFcmToken();
        if (!token || cancelled) return;
        const { updateBarberProfile, upsertUser } = await import('@/lib/db');
        if (barberUser?.uid === uid) await updateBarberProfile(uid, { fcmToken: token });
        else await upsertUser(uid, { fcmToken: token });
      } catch {
        // Push setup is optional and must not block login or app startup.
      }
    })();
    return () => { cancelled = true; };
  }, [authReady, customer?.uid, barberUser?.uid]);

  const loginCustomer = useCallback((_phone: string, name?: string, uid?: string) => {
    if (!uid) {
return;
    }
    setBarberUser(null);
    localStorage.removeItem('barberco_barber');
    const defaultAvatar = '/logo.png';
    const user: CustomerUser = {
      uid,
      name: name?.trim() || 'Customer',
      phone: _phone,
      avatar: defaultAvatar,
    };
    setCustomer(user);
    localStorage.setItem('barberco_customer', JSON.stringify(user));
    void import('@/lib/db').then(async ({ getUser }) => {
      try {
        const existing = await getUser(uid);
        if (existing) {
          setCustomer(prev => {
            if (!prev || prev.uid !== uid) return prev;
            const updated = { ...prev, name: existing.name || prev.name, phone: existing.phone || prev.phone, avatar: existing.avatar || prev.avatar };
            localStorage.setItem('barberco_customer', JSON.stringify(updated));
            return updated;
          });
        }
      } catch { /* Keep the signed-in profile while connectivity recovers. */ }
    }).catch(() => {});
  }, []);

  const logoutCustomer = useCallback(() => {
    setCustomer(null);
    localStorage.removeItem('barberco_customer');
    void signOutAll();
  }, []);

  const loginBarber = useCallback((_email: string, uid?: string, name?: string, shopName?: string) => {
    if (!uid) {
return;
    }
    setCustomer(null);
    localStorage.removeItem('barberco_customer');
    const user: BarberUser = { uid, email: _email, name: name || 'Barber', shopName: shopName || 'Barbershop' };
    setBarberUser(user);
    localStorage.setItem('barberco_barber', JSON.stringify(user));
    void import('@/lib/db').then(async ({ getBarber }) => {
      if (!name || !shopName) {
        getBarber(uid).then(doc => {
          if (doc) {
            const updated = { ...user, name: doc.name || user.name, shopName: doc.shopName || user.shopName };
            setBarberUser(current => {
              if (current?.uid !== uid) return current;
              localStorage.setItem('barberco_barber', JSON.stringify(updated));
              return updated;
            });
          }
        }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const logoutBarber = useCallback(() => {
    setBarberUser(null);
    void signOutAll();
    localStorage.removeItem('barberco_barber');
  }, []);

  const updateCustomerAvatar = useCallback((url: string) => {
    setCustomer(prev => {
      if (!prev) return prev;
      const updated = { ...prev, avatar: url };
      localStorage.setItem('barberco_customer', JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{
      customer,
      barberUser,
      authReady,
      loginCustomer,
      logoutCustomer,
      loginBarber,
      logoutBarber,
      updateCustomerAvatar,
      isCustomerLoggedIn: !!customer,
      isBarberLoggedIn: !!barberUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
