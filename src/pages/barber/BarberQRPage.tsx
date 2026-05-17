import React, { useRef } from 'react';
import { ArrowLeft, Download, Share2, QrCode } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as _qrlib from 'react-qr-code';
const QRCodeSVG: React.FC<{ value: string; size?: number; level?: string }> = (_qrlib as any).QRCode ?? (_qrlib as any).default ?? _qrlib;
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

export default function BarberQRPage() {
  const navigate = useNavigate();
  const { barberUser } = useAuth();
  const { language } = useLanguage();
  const ar = language === 'ar';
  const qrRef = useRef<HTMLDivElement>(null);

  const barberId = barberUser?.uid || '';
  const shopName = barberUser?.shopName || 'My Shop';

  const qrValue = `halaqijo://barber/${barberId}`;

  const downloadQR = async () => {
    try {
      const svg = qrRef.current?.querySelector('svg');
      if (!svg) return;

      const svgData = new XMLSerializer().serializeToString(svg as Node);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();
      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        canvas.width = 400;
        canvas.height = 400;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 400, 400);
        ctx.drawImage(img, 20, 20, 360, 360);
        URL.revokeObjectURL(url);
        const a = document.createElement('a');
        a.download = `${shopName}-QR.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
        toast.success(ar ? 'تم تنزيل QR' : 'QR downloaded');
      };
      img.src = url;
    } catch (e) {
      toast.error(ar ? 'فشل التنزيل' : 'Download failed');
    }
  };

  const shareQR = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: shopName,
          text: ar ? `امسح هذا الرمز لزيارة ${shopName} وكسب نقاط!` : `Scan to check in at ${shopName} and earn loyalty points!`,
          url: `https://halaqijo.app/barber/${barberId}`,
        });
      } else {
        await navigator.clipboard.writeText(`https://halaqijo.app/barber/${barberId}`);
        toast.success(ar ? 'تم نسخ الرابط' : 'Link copied');
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast.error(ar ? 'فشل المشاركة' : 'Share failed');
    }
  };

  if (!barberId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        {ar ? 'يجب تسجيل الدخول' : 'Please sign in'}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <div className="flex items-center gap-3 px-5 pt-14 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 bg-card border border-border rounded-full flex items-center justify-center"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="font-bold text-foreground">{ar ? 'رمز QR الخاص بك' : 'Your QR Code'}</h1>
          <p className="text-xs text-muted-foreground">{ar ? 'اطبعه وضعه في صالونك' : 'Print & display in your shop'}</p>
        </div>
      </div>

      <div className="px-5 flex flex-col items-center gap-6">

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-xs bg-card border border-border rounded-3xl p-6 flex flex-col items-center"
        >
          <div className="flex items-center gap-2 mb-5">
            <QrCode size={18} className="text-primary" />
            <span className="text-sm font-bold text-foreground">{shopName}</span>
          </div>

          <div ref={qrRef} className="bg-white p-4 rounded-2xl shadow-inner">
            <QRCodeSVG
              value={qrValue}
              size={200}
              level="H"
            />
          </div>

          <p className="text-xs text-muted-foreground mt-4 text-center leading-relaxed">
            {ar
              ? 'يمسح الزبائن هذا الرمز للتسجيل ويحصلون على نقاط مكافأة'
              : 'Customers scan this to check in and earn loyalty points'}
          </p>

          <div className="w-full mt-4 bg-primary/10 border border-primary/20 rounded-xl px-3 py-2 text-center">
            <p className="text-[10px] text-muted-foreground">{ar ? 'معرّف الصالون' : 'Barber ID'}</p>
            <p className="text-xs font-mono text-primary font-bold mt-0.5">{barberId}</p>
          </div>
        </motion.div>

        <div className="flex gap-3 w-full max-w-xs">
          <button
            onClick={downloadQR}
            className="flex-1 flex items-center justify-center gap-2 h-12 bg-primary text-primary-foreground font-bold rounded-2xl text-sm"
          >
            <Download size={16} />
            {ar ? 'تنزيل' : 'Download'}
          </button>
          <button
            onClick={shareQR}
            className="flex-1 flex items-center justify-center gap-2 h-12 bg-card border border-border text-foreground font-bold rounded-2xl text-sm"
          >
            <Share2 size={16} />
            {ar ? 'مشاركة' : 'Share'}
          </button>
        </div>

        <div className="w-full max-w-xs bg-card border border-border rounded-2xl p-4">
          <p className="text-sm font-bold text-foreground mb-3">
            {ar ? 'كيفية الاستخدام' : 'How to use'}
          </p>
          <div className="space-y-2.5">
            {[
              { icon: '🖨️', ar: 'اطبع الرمز وعلّقه في صالونك', en: 'Print and display in your shop' },
              { icon: '📱', ar: 'الزبون يفتح التطبيق ويختار "مسح QR"', en: 'Customer opens app → Scan QR' },
              { icon: '✅', ar: 'يتم تسجيل زيارته وتضاف له 20 نقطة', en: 'Visit logged + 20 points added' },
              { icon: '🔔', ar: 'ستصلك إشعار بكل زيارة جديدة', en: 'You\'ll be notified on each visit' },
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0">{step.icon}</span>
                <p className="text-sm text-muted-foreground">{ar ? step.ar : step.en}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
