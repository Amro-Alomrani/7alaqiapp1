import { useEffect, useState } from 'react';
import { ImageOff, LoaderCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createSignedChatImageUrl } from '@/lib/storage';
import { PRIVATE_STORAGE_MARKER } from '@/lib/supabase';

export function BookingMessageImage({ src, arabic, onOpen }: {
  src: string;
  arabic: boolean;
  onOpen: (url: string) => void;
}) {
  const { customer, barberUser } = useAuth();
  const uid = customer?.uid || barberUser?.uid || '';
  const [retry, setRetry] = useState(0);
  const [resolved, setResolved] = useState({ key: '', url: '', failed: false });
  const key = `${uid}:${src}:${retry}`;
  const privateImage = src.startsWith(PRIVATE_STORAGE_MARKER);

  useEffect(() => {
    if (!privateImage) return;
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      try {
        const url = await createSignedChatImageUrl(src);
        if (cancelled) return;
        setResolved({ key, url, failed: false });
        refreshTimer = setTimeout(() => { void refresh(); }, 50 * 60_000);
      } catch {
        if (!cancelled) setResolved({ key, url: '', failed: true });
      }
    };
    void refresh();
    return () => { cancelled = true; clearTimeout(refreshTimer); };
  }, [key, privateImage, src]);

  const failed = resolved.key === key && resolved.failed;
  const url = privateImage ? (resolved.key === key ? resolved.url : '') : src;
  if (failed) {
    return (
      <button type="button" onClick={() => setRetry(value => value + 1)} className="w-full min-h-28 p-4 flex flex-col gap-2 items-center justify-center text-xs">
        <ImageOff className="w-6 h-6" />
        {arabic ? 'تعذر تحميل الصورة. اضغط للمحاولة مجددًا' : 'Image could not load. Tap to retry'}
      </button>
    );
  }
  if (!url) {
    return <div className="min-h-28 flex items-center justify-center p-4" role="status" aria-label={arabic ? 'جار تحميل الصورة' : 'Loading image'}><LoaderCircle className="w-6 h-6 animate-spin" /></div>;
  }
  return (
    <button type="button" onClick={() => onOpen(url)} className="block w-full" aria-label={arabic ? 'فتح الصورة' : 'Open image'}>
      <img src={url} alt={arabic ? 'صورة في المحادثة' : 'Chat image'} className="w-full max-h-60 object-cover" loading="lazy" onError={() => setResolved({ key, url: '', failed: true })} />
    </button>
  );
}
