import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeFollowerCount } from '@/lib/db';

export function useFollowerCount(barberId: string | undefined): number | null {
  const { customer, barberUser } = useAuth();
  const uid = customer?.uid || barberUser?.uid;
  const [result, setResult] = useState<{ barberId: string; uid: string; count: number } | null>(null);
  useEffect(() => {
    if (!barberId || !uid) return;
    return subscribeFollowerCount(barberId, count => setResult({ barberId, uid, count }));
  }, [barberId, uid]);
  return result && result.barberId === barberId && result.uid === uid ? result.count : null;
}
