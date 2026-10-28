import { useEffect, useRef, useState, useCallback } from 'react';
import { useSafeBack } from "@/hooks/useSafeBack";
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import jsQR from 'jsqr';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { recordCheckin } from '@/lib/db';
import { getCurrentLocation } from '@/lib/location';

type ScanState = 'idle' | 'scanning' | 'processing' | 'success' | 'error';

export default function QRScanPage() {
  const navigate = useNavigate();
  const safeBack = useSafeBack();
  const { customer } = useAuth();
  const { language } = useLanguage();
  const ar = language === 'ar';

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const handleDecodeRef = useRef<(text: string) => void>(() => undefined);

  const [scanState, setScanState] = useState<ScanState>('idle');
  const [result, setResult] = useState<{ barberId: string; barberName?: string; points: number } | null>(null);
  const [error, setError] = useState('');

  const stopCamera = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
    if (code?.data) {
      void handleDecodeRef.current(code.data);
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const handleDecode = async (text: string) => {
    stopCamera();
    setScanState('processing');
    try {
      let barberId = '';
      try {
        const url = new URL(text);
        if (url.protocol === 'halaqijo:' && url.hostname === 'barber') {
          barberId = decodeURIComponent(url.pathname.replace(/^\//, ''));
        }
      } catch { /* The legacy JSON format is checked below. */ }
      if (!barberId) {
        try {
          const legacy = JSON.parse(text) as { barberId?: unknown };
          if (typeof legacy.barberId === 'string') barberId = legacy.barberId.trim();
        } catch { /* Invalid QR payload. */ }
      }
      if (!barberId) throw new Error('Invalid QR');
      if (!customer?.uid) throw new Error('Please sign in first.');
      const position = await getCurrentLocation({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
      const checkin = await recordCheckin(customer.uid, customer.name || '', barberId, {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
      if (!checkin.success) throw new Error(checkin.message);
      setResult({ barberId, barberName: checkin.barberName, points: checkin.points });
      setScanState('success');
    } catch (cause) {
      const message = cause instanceof Error
        ? cause.message
        : typeof cause === 'object' && cause && 'message' in cause
          ? String(cause.message)
          : '';
      if (/already checked in/i.test(message)) {
        setError(ar ? 'سجّلت حضورك في هذا الصالون اليوم بالفعل.' : 'You have already checked in at this salon today.');
      } else if (/location|position|permission|timeout/i.test(message)) {
        setError(ar ? 'تعذر التحقق من موقعك. فعّل إذن الموقع وحاول مجدداً قرب الصالون.' : 'Could not verify your location. Allow location access and retry near the salon.');
      } else if (/salon|barber|available|verified map/i.test(message)) {
        setError(ar ? 'الصالون غير مفعّل أو لم يحفظ موقعاً صحيحاً بعد.' : 'This salon is not active or has not saved a valid location.');
      } else if (/sign in/i.test(message)) {
        setError(ar ? 'سجّل الدخول أولاً.' : 'Please sign in first.');
      } else {
        setError(ar ? 'رمز QR غير صالح أو تعذر تسجيل الزيارة.' : 'Invalid QR code or check-in could not be recorded.');
      }
      setScanState('error');
    }
  };

  handleDecodeRef.current = handleDecode;

  const startScan = useCallback(async () => {
    if (!customer) { toast.error(ar ? 'يجب تسجيل الدخول' : 'Please sign in first'); return; }
    setScanState('scanning');
    setError('');
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setError(ar ? 'لا يمكن الوصول إلى الكاميرا' : 'Cannot access camera');
      setScanState('error');
    }
  }, [customer, ar, tick]);

  return (
    <div className="min-h-screen bg-background flex flex-col" dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-3 px-5 pt-12 pb-4">
        <button onClick={() => { stopCamera(); safeBack(); }}
          className="w-10 h-10 bg-card border border-border rounded-full flex items-center justify-center">
          <ArrowLeft size={18} className={ar ? 'rotate-180' : ''} />
        </button>
        <h1 className="font-bold text-foreground">{ar ? 'مسح رمز QR' : 'Scan QR Code'}</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-5 gap-6">
        <div className="relative w-full max-w-xs aspect-square rounded-3xl overflow-hidden border-2 border-primary/40 bg-black">
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
          <canvas ref={canvasRef} className="hidden" />
          {scanState !== 'scanning' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              {scanState === 'processing' && <Loader2 size={40} className="text-primary animate-spin" />}
              {scanState === 'success' && <CheckCircle2 size={40} className="text-green-400" />}
              {scanState === 'error' && <XCircle size={40} className="text-red-400" />}
            </div>
          )}
          {scanState === 'scanning' && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-8 border-2 border-primary rounded-2xl" />
              <div className="absolute top-8 left-8 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg" />
              <div className="absolute top-8 right-8 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg" />
              <div className="absolute bottom-8 left-8 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg" />
              <div className="absolute bottom-8 right-8 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg" />
            </div>
          )}
        </div>

        {scanState === 'success' && result && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 w-full max-w-xs text-center">
            <CheckCircle2 size={32} className="text-green-400 mx-auto mb-2" />
            <p className="font-bold text-foreground">{ar ? 'تم تسجيل الحضور!' : 'Check-in recorded!'}</p>
            {result.barberName && <p className="text-sm text-muted-foreground mt-1">{result.barberName}</p>}
            <p className="text-primary font-black text-xl mt-2">+{result.points} {ar ? 'نقطة' : 'pts'}</p>
          </div>
        )}

        {scanState === 'error' && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 w-full max-w-xs text-center">
            <XCircle size={32} className="text-red-400 mx-auto mb-2" />
            <p className="font-bold text-red-400">{error}</p>
          </div>
        )}

        <div className="w-full max-w-xs flex flex-col gap-3">
          {(scanState === 'idle' || scanState === 'error') && (
            <button onClick={startScan}
              className="w-full h-14 rounded-2xl font-bold text-primary-foreground text-base"
              style={{ background: 'linear-gradient(135deg,hsl(38 92% 52%),hsl(28 90% 36%))' }}>
              {ar ? '📷 ابدأ المسح' : '📷 Start Scanning'}
            </button>
          )}
          {scanState === 'scanning' && (
            <button onClick={() => { stopCamera(); setScanState('idle'); }}
              className="w-full h-14 rounded-2xl bg-secondary text-foreground font-bold text-base">
              {ar ? 'إيقاف' : 'Stop'}
            </button>
          )}
          {scanState === 'success' && (
            <button onClick={() => navigate('/')}
              className="w-full h-14 rounded-2xl font-bold text-primary-foreground text-base"
              style={{ background: 'linear-gradient(135deg,hsl(38 92% 52%),hsl(28 90% 36%))' }}>
              {ar ? 'العودة للرئيسية' : 'Go Home'}
            </button>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center px-8">
          {ar ? 'وجّه الكاميرا نحو رمز QR الخاص بالصالون لتسجيل نقاط الولاء' : 'Point camera at the barber shop QR code to earn loyalty points'}
        </p>
      </div>
    </div>
  );
}
