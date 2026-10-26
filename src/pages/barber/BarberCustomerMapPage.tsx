import { useEffect, useState } from 'react';
import { useSafeBack } from "@/hooks/useSafeBack";
import { useNavigate, useParams } from 'react-router-dom';
import { MapContainer, Marker, Polyline, useMap } from 'react-leaflet';
import MapTileLayer from '@/components/maps/MapTileLayer';
import L from 'leaflet';
import { ArrowLeft, Navigation, MessageCircle, Phone, Clock, MapPin, Bell } from 'lucide-react';
import { useLiveBooking } from '@/contexts/LiveBookingContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { pushNotification } from '@/lib/db';
import { toast } from 'sonner';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/marker-icon-2x.png',
  iconUrl: '/marker-icon.png',
  shadowUrl: '/marker-shadow.png',
});

const customerIcon = new L.DivIcon({
  className: '',
  html: `<div style="width:28px;height:28px;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(59,130,246,0.5);display:flex;align-items:center;justify-content:center;color:white;font-size:13px;">👤</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const salonIcon = new L.DivIcon({
  className: '',
  html: `<div style="width:40px;height:40px;background:hsl(38,92%,52%);border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:20px;">💈</div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 2) {
      map.fitBounds(L.latLngBounds(points.map(p => L.latLng(p[0], p[1]))), { padding: [80, 80] });
    } else if (points.length === 1) {
      map.setView(points[0], 14);
    }
  }, [points, map]);
  return null;
}

function distanceKm(a: [number, number], b: [number, number]) {
  const R = 6371;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLng = (b[1] - a[1]) * Math.PI / 180;
  const lat1 = a[0] * Math.PI / 180;
  const lat2 = b[0] * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export default function BarberCustomerMapPage() {
  const navigate = useNavigate();
  const safeBack = useSafeBack();
  const { bookingId } = useParams();
  const { allBookings, acceptBooking, startBooking, completeBooking } = useLiveBooking();
  const { barberUser } = useAuth();
  const { language } = useLanguage();
  const ar = language === 'ar';
  const booking = allBookings.find(b => b.id === bookingId);
  const [now, setNow] = useState(Date.now());
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const customer = booking?.customerLocation;
    const salon = booking?.salonLocation;
    if (!customer || !salon) { setRoutePoints([]); setEtaMinutes(null); return; }
    let cancelled = false;
    const from: [number, number] = [salon.lat, salon.lng];
    const to: [number, number] = [customer.lat, customer.lng];
    fetch(`https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`)
      .then(response => response.json())
      .then(data => {
        if (cancelled) return;
        const route = data.routes?.[0];
        if (data.code === 'Ok' && route) {
          setRoutePoints(route.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]] as [number, number]));
          setEtaMinutes(Math.max(1, Math.round(route.duration / 60)));
        } else {
          setRoutePoints([from, to]);
          setEtaMinutes(Math.max(1, Math.round(distanceKm(from, to) / 25 * 60)));
        }
      })
      .catch(() => {
        if (cancelled) return;
        setRoutePoints([from, to]);
        setEtaMinutes(Math.max(1, Math.round(distanceKm(from, to) / 25 * 60)));
      });
    return () => { cancelled = true; };
  }, [booking?.id, booking?.customerLocation?.lat, booking?.customerLocation?.lng, booking?.salonLocation?.lat, booking?.salonLocation?.lng]);

  useEffect(() => {
    if (!booking?.customerId) return;
    const interval = setInterval(() => {
      const b = booking;
      if (!b?.customerId) return;
      const cPos: [number, number] | null = b.customerLocation ? [b.customerLocation.lat, b.customerLocation.lng] : null;
      const sPos: [number, number] = b.salonLocation ? [b.salonLocation.lat, b.salonLocation.lng] : [31.9539, 35.9106];
      const dist = cPos ? distanceKm(cPos, sPos).toFixed(1) : null;
      void pushNotification(b.customerId, {
        type: 'booking_update',
        title: `📍 ${barberUser?.name || (ar ? 'الحلاق' : 'Barber')}`,
        body: dist
          ? (ar ? `ينتظرك في الصالون — أنت على بُعد ${dist} كم` : `Waiting for you at salon — you're ${dist} km away`)
          : (ar ? 'يرجى التوجه للصالون' : 'Please head to the salon'),
        fromUid: barberUser?.uid || '',
        fromName: barberUser?.name || '',
        bookingId: b.id,
      });
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [booking?.customerId, booking?.id]);

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5 flex-col gap-3">
        <p className="text-4xl">🗺️</p>
        <p className="font-bold text-foreground">{ar ? 'الحجز غير موجود' : 'Booking not found'}</p>
        <button onClick={() => navigate('/barber/bookings')}
          className="bg-primary text-primary-foreground px-6 py-2.5 rounded-2xl font-bold text-sm">
          {ar ? 'رجوع' : 'Back to Bookings'}
        </button>
      </div>
    );
  }

  const salonPos: [number, number] | null = booking.salonLocation
    ? [booking.salonLocation.lat, booking.salonLocation.lng]
    : null;
  const customerPos: [number, number] | null = booking.customerLocation
    ? [booking.customerLocation.lat, booking.customerLocation.lng]
    : null;

  const points: [number, number][] = customerPos && salonPos ? [customerPos, salonPos] : customerPos ? [customerPos] : salonPos ? [salonPos] : [];
  const distance = customerPos && salonPos ? distanceKm(customerPos, salonPos).toFixed(1) : null;

  const bookedAtMs = booking.createdAt;
  const minutesAgo = booking.customerLocationUpdatedAt ? Math.max(0, Math.floor((now - booking.customerLocationUpdatedAt) / 60000)) : null;
  const lastSeenLabel = minutesAgo === null
    ? (ar ? 'موقع العميل غير متاح' : 'Customer location unavailable')
    : minutesAgo < 60
      ? `${minutesAgo}${ar ? ' دقيقة' : ' min ago'}`
      : `${Math.floor(minutesAgo / 60)}${ar ? ' ساعة' : 'h ago'}`;

  const sendAlertToCustomer = () => {
    if (!booking.customerId) return;
    void pushNotification(booking.customerId, {
      type: 'message',
      title: `🔔 ${barberUser?.name || (ar ? 'الحلاق' : 'Barber')}`,
      body: ar ? 'رسالة من الحلاق: يرجى التوجه للصالون' : 'Message from barber: Please head to the salon',
      fromUid: barberUser?.uid || '',
      fromName: barberUser?.name || '',
      bookingId: booking.id,
    });
    toast.success(ar ? '📲 تم إرسال التنبيه للعميل' : '📲 Alert sent to customer');
  };

  return (
    <div className="min-h-screen flex flex-col relative" dir={ar ? 'rtl' : 'ltr'}>
      <div className="absolute top-0 left-0 right-0 z-[1000] px-4 pt-12 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={() => safeBack()}
            className="w-10 h-10 bg-card/95 backdrop-blur-sm border border-border rounded-full flex items-center justify-center shadow-lg">
            <ArrowLeft size={18} className={ar ? 'rotate-180' : ''} />
          </button>
          <div className="flex-1 bg-card/95 backdrop-blur-sm border border-border rounded-2xl px-4 py-2.5 shadow-lg">
            <p className="text-sm font-bold text-foreground">
              {booking.customerName || (ar ? 'العميل' : 'Customer')}
            </p>
            <p className="text-xs text-muted-foreground">{booking.service.name} · {booking.time}</p>
          </div>
        </div>
      </div>

      <MapContainer
        center={salonPos || customerPos || [31.9539, 35.9106]}
        zoom={13}
        className="flex-1 w-full"
        style={{ height: '60vh' }}
        zoomControl={false}
        attributionControl
      >
        <MapTileLayer />
        <FitBounds points={points} />
        {customerPos && <Marker position={customerPos} icon={customerIcon} />}
        {salonPos && <Marker position={salonPos} icon={salonIcon} />}
        {routePoints.length > 1 && (
          <Polyline
            positions={routePoints}
            pathOptions={{ color: '#3b82f6', weight: 4, dashArray: '10,6', opacity: 0.85 }}
          />
        )}
      </MapContainer>

      <div className="bg-card border-t border-border rounded-t-3xl -mt-6 relative z-[1000] px-5 pt-6 pb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-500/15 rounded-2xl flex items-center justify-center">
              <Navigation size={20} className="text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-black text-foreground">
                {distance ? `${distance} km` : '—'}
              </p>
              <p className="text-xs text-muted-foreground">
                {customerPos ? (ar ? 'مسافة العميل' : 'Customer distance') : (ar ? 'الموقع غير متاح' : 'Location not shared')}
              </p>
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-foreground">{etaMinutes !== null ? `${etaMinutes} ${ar ? 'دقيقة' : 'min'}` : '—'}</p>
            <p className="text-xs text-muted-foreground">{ar ? 'وصول تقريبي' : 'Approx. ETA'}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-foreground flex items-center gap-1 justify-end">
              <Clock size={12} /> {lastSeenLabel}
            </p>
            <p className="text-xs text-muted-foreground">{ar ? 'آخر تحديث للموقع' : 'Location updated'}</p>
          </div>
        </div>

        <div className="bg-muted/50 rounded-2xl p-4 flex items-center gap-3 mb-4">
          {booking.customerAvatar ? (
            <img src={booking.customerAvatar} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
          ) : (
            <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center text-xl font-bold text-primary flex-shrink-0">
              {booking.customerName?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-foreground text-sm">{booking.customerName || (ar ? 'العميل' : 'Customer')}</p>
            {booking.customerPhone && (
              <p className="text-xs text-muted-foreground">{booking.customerPhone}</p>
            )}
            <p className="text-xs text-primary font-bold mt-0.5">{booking.totalPrice} JOD · {booking.payMethod}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/barber/chat/${booking.id}`)}
              className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center"
            >
              <MessageCircle size={16} className="text-primary" />
            </button>
            <button
              onClick={sendAlertToCustomer}
              className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center"
            >
              <Bell size={16} className="text-amber-500" />
            </button>
            {booking.customerPhone ? (
              <a
                href={`tel:${booking.customerPhone}`}
                className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center"
              >
                <Phone size={16} className="text-green-400" />
              </a>
            ) : (
              <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center opacity-40">
                <Phone size={16} className="text-muted-foreground" />
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-secondary text-foreground uppercase">
            {booking.status.replace('_', ' ')}
          </span>
          {customerPos && (
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 ${minutesAgo !== null && minutesAgo < 2 ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'}`}>
              <MapPin size={10} /> {minutesAgo !== null && minutesAgo < 2 ? (ar ? 'مباشر' : 'Live') : (ar ? 'آخر موقع معروف' : 'Last known location')}
            </span>
          )}
        </div>

        <div className="flex gap-3">
          {booking.status === 'requested' && (
            <button onClick={() => acceptBooking(booking.id)}
              className="flex-1 bg-green-500 text-white font-bold py-3.5 rounded-2xl text-sm">
              {ar ? 'قبول الحجز' : 'Accept Booking'}
            </button>
          )}
          {(booking.status === 'accepted' || booking.status === 'preparing' || booking.status === 'your_turn') && (
            <button onClick={() => startBooking(booking.id)}
              className="flex-1 bg-primary text-primary-foreground font-bold py-3.5 rounded-2xl text-sm">
              {ar ? 'بدء الخدمة' : 'Start Service'}
            </button>
          )}
          {booking.status === 'in_progress' && (
            <button onClick={() => completeBooking(booking.id)}
              className="flex-1 bg-green-500 text-white font-bold py-3.5 rounded-2xl text-sm">
              {ar ? 'إنهاء الخدمة' : 'Complete'}
            </button>
          )}
          {customerPos && salonPos && (
            <button
              onClick={() => {
                const url = `https://www.google.com/maps/dir/${salonPos[0]},${salonPos[1]}/${customerPos[0]},${customerPos[1]}`;
                window.open(url, '_blank');
              }}
              className="bg-card border-2 border-blue-500/40 text-blue-400 font-bold px-5 py-3.5 rounded-2xl text-sm flex items-center gap-1"
            >
              <Navigation size={16} /> {ar ? 'الاتجاهات' : 'Directions'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
