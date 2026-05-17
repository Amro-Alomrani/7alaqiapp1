import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import jsQR from 'jsqr';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { recordCheckin } from '@/lib/db';

type ScanState = 'idle' | 'scanning' | 'processing' | 'success' | 'error';

export default function QRScanPage() {
  const navigate = useNavigate();
  const { customer } = useAuth();
  const { language } = useLanguage();
  const ar = language === 'ar';

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

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
      handleDecode(code.data);
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const handleDecode = async (text: string) => {
    stopCamera();
    setScanState('processing');
    try {
      let data: { barberId: string; barberName?: string; points?: number };
      try { data = JSON.parse(text); } catch { data = { barberId: text, points: 30 }; }
      if (!data.barberId) throw new Error('Invalid QR');
      const pts = data.points ?? 30;
      if (customer?.uid) {
        await recordCheckin(customer.uid, customer.name || '', data.barberId).catch(() => {});
      }
      setResult({ barberId: data.barberId, barberName: data.barberName, points: pts });
      setScanState('success');
    } catch {
      setError(ar ? 'رمز QR غير صالح' : 'Invalid QR code');
      setScanState('error');
    }
  };

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
        <button onClick={() => { stopCamera(); navigate(-1); }}
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
