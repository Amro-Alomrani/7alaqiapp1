import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeNotifications, type NotificationDoc } from '@/lib/db';

/**
 * Mounted once at app root. Listens to the current user's notifications
 * collection and surfaces them as toasts + native browser notifications.
 * Suppresses anything older than the moment we mounted (so we don't replay history).
 */
export default function NotificationsListener() {
  const { customer, barberUser } = useAuth();
  const uid = customer?.uid || barberUser?.uid;
  const startedAtRef = useRef<number>(Date.now());
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!uid) return;
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        void Notification.requestPermission();
      }
    } catch {  }
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    startedAtRef.current = Date.now();
    seenRef.current = new Set();

    const unsub = subscribeNotifications(uid, (items) => {
      items.forEach(n => {
        if (seenRef.current.has(n.id)) return;
        seenRef.current.add(n.id);
        if (n.createdAt < startedAtRef.current - 2000) return; // skip historical
        showNotification(n);
      });
    });
    return () => unsub();
  }, [uid]);

  return null;
}

function showNotification(n: NotificationDoc & { id: string }) {
  try {
    const t = `${n.title}`;
    const description = n.body;
    if (n.type === 'booking_update' && /reject|cancel|❌|😔/i.test(n.title)) {
      toast.error(t, { description });
    } else {
      toast(t, { description });
    }
  } catch {  }
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(n.title, { body: n.body, icon: n.fromAvatar || '/logo.png' });
    }
  } catch {  }
}
