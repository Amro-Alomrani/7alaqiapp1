import { useState, useEffect, useRef, useCallback } from 'react';
import { useSafeBack } from "@/hooks/useSafeBack";
import { useNavigate } from 'react-router-dom';
import { MapContainer, Marker, Polyline, useMap } from 'react-leaflet';
import MapTileLayer from '@/components/maps/MapTileLayer';
import L from 'leaflet';
import { ArrowLeft, Navigation, Phone, MessageCircle, MapPin, Clock, Wifi } from 'lucide-react';
import { useLiveBooking } from '@/contexts/LiveBookingContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { LiveBarberLocation, subscribeBarberLiveLocation, updateCustomerLocation } from '@/lib/db';
import 'leaflet/dist/leaflet.css';
import { watchDeviceLocation } from '@/lib/location';
import { toast } from 'sonner';

delete (L.Icon.Default.prototype as L.Icon.Default & { _getIconUrl?: string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/marker-icon-2x.png',
  iconUrl: '/marker-icon.png',
  shadowUrl: '/marker-shadow.png',
});

const ME_ICON = new L.DivIcon({
  className: '',
  html: `<div style="width:22px;height:22px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(59,130,246,0.5);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const SALON_ICON = new L.DivIcon({
  className: '',
  html: `<div style="width:44px;height:44px;background:hsl(38,92%,50%);border-radius:50%;border:3px solid white;box-shadow:0 2px 12px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:22px;">💈</div>`,
  iconSize: [44, 44],
  iconAnchor: [22, 44],
});

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const firstLat = points[0]?.[0];
  const firstLng = points[0]?.[1];
  const secondLat = points[1]?.[0];
  const secondLng = points[1]?.[1];
  useEffect(() => {
    if (firstLat !== undefined && firstLng !== undefined && secondLat !== undefined && secondLng !== undefined) {
      map.fitBounds(L.latLngBounds([[firstLat, firstLng], [secondLat, secondLng]]), { padding: [80, 80] });
    }
  }, [firstLat, firstLng, secondLat, secondLng, map]);
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

export default function TrackingPage() {
  const navigate = useNavigate();
  const safeBack = useSafeBack();
  const { activeBooking } = useLiveBooking();
  const { language } = useLanguage();
  const ar = language === 'ar';

  const [devicePos, setDevicePos] = useState<[number, number] | null>(null);
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const [distKm, setDistKm] = useState<string | null>(null);
  const [etaMin, setEtaMin] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [barberLocation, setBarberLocation] = useState<LiveBarberLocation | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());

  const watchIdRef = useRef<(() => void) | null>(null);
  const lastFsWriteRef = useRef<number>(0);

  useEffect(() => {
    const timer = setInterval(() => setClockNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const salonPos: [number, number] | null = barberLocation
    ? [barberLocation.lat, barberLocation.lng]
    : activeBooking?.salonLocation
      ? [activeBooking.salonLocation.lat, activeBooking.salonLocation.lng]
      : null;
  const barberLive = !!barberLocation && clockNow - barberLocation.updatedAt < 60_000;

  useEffect(() => {
    if (!activeBooking?.barberId) return;
    return subscribeBarberLiveLocation(activeBooking.barberId, setBarberLocation);
  }, [activeBooking?.barberId]);

  const bookingCustomerLat = activeBooking?.customerLocation?.lat;
  const bookingCustomerLng = activeBooking?.customerLocation?.lng;
  const bookedCustomerPos: [number, number] | null = typeof bookingCustomerLat === 'number' && typeof bookingCustomerLng === 'number'
    ? [bookingCustomerLat, bookingCustomerLng]
    : null;
  const userPos = devicePos || bookedCustomerPos;

  const fetchRoute = useCallback(async (from: [number, number], to: [number, number], signal?: AbortSignal) => {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`Route service returned ${res.status}`);
      const data = await res.json();
      if (data.code === 'Ok' && data.routes?.[0]) {
        const coords: [number, number][] = data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]]);
        setRoutePoints(coords);
        const km = data.routes[0].distance / 1000;
        setDistKm(km.toFixed(1));
        const speed = 40; // km/h avg urban
        setEtaMin(Math.max(1, Math.round((km / speed) * 60)));
      }
    } catch {
      if (signal?.aborted) return;
      setRoutePoints([from, to]);
      const km = distanceKm(from, to);
      setDistKm(km.toFixed(1));
      setEtaMin(Math.max(1, Math.round((km / 40) * 60)));
    }
  }, []);

  const writeLocationToFs = useCallback(async (lat: number, lng: number) => {
    if (!activeBooking?.id) return;
    const now = Date.now();
    if (now - lastFsWriteRef.current < 25000) return;
    lastFsWriteRef.current = now;
    try {
      await updateCustomerLocation(activeBooking.id, lat, lng);
      setLastUpdated(new Date());
    } catch {
      toast.error(ar ? 'تعذر حفظ تحديث الموقع للحجز' : 'Could not save the location update');
    }
  }, [activeBooking, ar]);

  useEffect(() => {
    let active = true;
    void watchDeviceLocation(
      pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const p: [number, number] = [lat, lng];
        setDevicePos(p);
        writeLocationToFs(lat, lng);
      },
      err => {
        toast.error(ar ? 'تعذر تحديث موقعك المباشر' : 'Could not update your live location', { description: err.message });
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    ).then(stop => {
      if (active) watchIdRef.current = stop;
      else stop();
    }).catch(() => {
      if (active) toast.error(ar ? 'تعذر بدء تحديث الموقع المباشر' : 'Could not start live location updates');
    });
    return () => {
      active = false;
      if (watchIdRef.current) watchIdRef.current();
      watchIdRef.current = null;
    };
  }, [writeLocationToFs, ar]);

  const salonLat = salonPos?.[0];
  const salonLng = salonPos?.[1];
  useEffect(() => {
    if (!userPos || typeof salonLat !== 'number' || typeof salonLng !== 'number') return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetchRoute(userPos, [salonLat, salonLng], controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [userPos, salonLat, salonLng, fetchRoute]);


  if (!activeBooking) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5 flex-col gap-3">
        <p className="text-4xl">🗺️</p>
        <p className="font-bold text-foreground">{ar ? 'لا يوجد حجز نشط للتتبع' : 'No active booking to track'}</p>
        <button onClick={() => navigate('/')} className="bg-primary text-primary-foreground px-6 py-2.5 rounded-2xl font-bold text-sm mt-2">
          {ar ? 'الرئيسية' : 'Go Home'}
        </button>
      </div>
    );
  }

  const mapCenter: [number, number] = userPos && salonPos
    ? [(userPos[0] + salonPos[0]) / 2, (userPos[1] + salonPos[1]) / 2]
    : userPos || salonPos || [31.9539, 35.9106];

  return (
    <div className="min-h-screen flex flex-col relative" dir={ar ? 'rtl' : 'ltr'}>
      <div className="absolute top-0 left-0 right-0 z-[1000] px-4 pt-12 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={() => safeBack()}
            className="w-10 h-10 bg-card/95 backdrop-blur-sm border border-border rounded-full flex items-center justify-center shadow-lg">
            <ArrowLeft size={18} className={ar ? 'rotate-180' : ''} />
          </button>
          <div className="flex-1 bg-card/95 backdrop-blur-sm border border-border rounded-2xl px-4 py-2.5 shadow-lg">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${barberLive ? 'bg-green-400 animate-pulse' : 'bg-muted-foreground'}`} />
              <p className="text-sm font-bold text-foreground">
                {ar ? 'تتبع مباشر' : 'Live Tracking'}
              </p>
              {barberLive && (
                <span className="text-[10px] text-green-500 font-bold bg-green-500/10 px-1.5 py-0.5 rounded-full">LIVE</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{activeBooking.barberShop}</p>
          </div>
          {userPos && salonPos && (
            <button
              onClick={() => window.open(`https://www.google.com/maps/dir/${userPos[0]},${userPos[1]}/${salonPos[0]},${salonPos[1]}`, '_blank')}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground font-bold px-3 py-2 rounded-2xl text-xs shadow-lg"
            >
              <Navigation size={14} />
              {ar ? 'الاتجاهات' : 'Navigate'}
            </button>
          )}
        </div>
      </div>

      <MapContainer
        center={mapCenter}
        zoom={14}
        className="flex-1 w-full"
        style={{ height: '62vh' }}
        zoomControl={false}
        attributionControl
      >
        <MapTileLayer />
        {userPos && salonPos && <FitBounds points={[userPos, salonPos]} />}
        {userPos && <Marker position={userPos} icon={ME_ICON} />}
        {salonPos && <Marker position={salonPos} icon={SALON_ICON} />}
        {routePoints.length > 1 && (
          <Polyline
            positions={routePoints}
            pathOptions={{ color: '#d97706', weight: 5, opacity: 0.85 }}
          />
        )}
      </MapContainer>

      <div className="bg-card border-t border-border rounded-t-3xl -mt-6 relative z-[1000] px-5 pt-5 pb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 bg-primary/8 border border-primary/20 rounded-2xl p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/15 rounded-xl flex items-center justify-center">
              <Clock size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-xl font-black text-foreground">
                {salonPos && userPos && etaMin !== null ? `${etaMin} ${ar ? 'دقيقة' : 'min'}` : '—'}
              </p>
              <p className="text-[11px] text-muted-foreground">{ar ? 'وقت الوصول المتوقع' : 'Estimated arrival'}</p>
            </div>
          </div>
          <div className="flex-1 bg-blue-500/8 border border-blue-500/20 rounded-2xl p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/15 rounded-xl flex items-center justify-center">
              <MapPin size={18} className="text-blue-400" />
            </div>
            <div>
              <p className="text-xl font-black text-foreground">
                {salonPos && userPos && distKm !== null ? `${distKm} km` : '—'}
              </p>
              <p className="text-[11px] text-muted-foreground">{ar ? 'المسافة المتبقية' : 'Distance'}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4 px-1">
          <Wifi size={12} className={barberLive ? 'text-green-400' : 'text-muted-foreground'} />
          <span className="text-[11px] text-muted-foreground">
            {barberLive
              ? (ar ? 'موقع الحلاق مباشر — يتحدث باستمرار' : 'Barber location is live and updating')
              : barberLocation
                ? (ar ? 'آخر موقع للحلاق قديم؛ ننتظر تحديثاً جديداً' : 'Barber location is stale; waiting for a new update')
                : (ar ? 'الحلاق لم يبدأ مشاركة الموقع بعد' : 'The barber has not started sharing location yet')}
          </span>
          {lastUpdated && (
            <span className="text-[10px] text-green-500 font-bold ms-auto">
              {ar ? 'آخر تحديث' : 'Updated'} {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        <div className="bg-secondary/50 rounded-2xl p-4 flex items-center gap-3 mb-4">
          {activeBooking.barberAvatar && !activeBooking.barberAvatar.startsWith('/') ? (
            <img src={activeBooking.barberAvatar} alt={activeBooking.barberName}
              className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-black text-primary">{activeBooking.barberName?.[0] || '✂'}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-foreground text-sm">{activeBooking.barberName}</p>
            <p className="text-xs text-muted-foreground">{activeBooking.service.name} · {activeBooking.time}</p>
            <p className="text-xs text-primary font-bold mt-0.5">{activeBooking.totalPrice} JOD</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/booking-chat/${activeBooking.id}`)}
              className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center"
            >
              <MessageCircle size={16} className="text-primary" />
            </button>
            {activeBooking.barberPhone ? (
              <a href={`tel:${activeBooking.barberPhone}`} className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center">
                <Phone size={16} className="text-green-400" />
              </a>
            ) : (
              <button className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center opacity-40">
                <Phone size={16} className="text-green-400" />
              </button>
            )}
          </div>
        </div>

        <button
          onClick={() => navigate('/booking-status')}
          className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-2xl text-sm"
        >
          {ar ? 'عرض حالة الحجز' : 'View Booking Status'}
        </button>
      </div>
    </div>
  );
}
