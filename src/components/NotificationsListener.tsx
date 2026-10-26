import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeNotifications, type NotificationDoc } from '@/lib/db';

/**
 * Mounted once at app root. Listens to the current user's notifications
 * collection and surfaces them as toasts + native browser notifications.
 * Suppresses anything older than the moment we mounted (so we don't replay history).
 */
export default function NotificationsListener() {
  const { customer, barberUser } = useAuth();
  const navigate = useNavigate();
  const uid = customer?.uid || barberUser?.uid;
  const startedAtRef = useRef<number>(0);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!uid || !Capacitor.isNativePlatform()) return;
    let disposed = false;
    let actionListener: { remove: () => Promise<void> } | undefined;
    void import('@capacitor/push-notifications').then(async ({ PushNotifications }) => {
      actionListener = await PushNotifications.addListener('pushNotificationActionPerformed', event => {
        const data = event.notification.data as { bookingId?: string; postId?: string } | undefined;
        if (data?.bookingId) navigate('/booking-status');
        else if (data?.postId) navigate('/feed');
        else navigate('/notifications');
      });
      if (disposed) await actionListener.remove();
    }).catch(() => undefined);
    return () => {
      disposed = true;
      void actionListener?.remove();
    };
  }, [uid, navigate]);

  useEffect(() => {
    if (!uid) return;
    startedAtRef.current = Date.now();
    seenRef.current = new Set();

    const unsub = subscribeNotifications(uid, (items) => {
      items.forEach(n => {
        if (seenRef.current.has(n.id)) return;
        seenRef.current.add(n.id);
        if (n.createdAt < startedAtRef.current - 2000) return; // skip historical
        showNotification(n, !Capacitor.isNativePlatform());
      });
    });
    return () => unsub();
  }, [uid]);

  return null;
}

function showNotification(n: NotificationDoc & { id: string }, showBrowserNotification: boolean) {
  try {
    const t = `${n.title}`;
    const description = n.body;
    if (n.type === 'booking_update' && /reject|cancel|❌|😔/i.test(n.title)) {
      toast.error(t, { description });
    } else {
      toast(t, { description });
    }
  } catch { return; }
  try {
    if (showBrowserNotification && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(n.title, { body: n.body, icon: n.fromAvatar || '/logo.png' });
    }
  } catch { return; }
}
