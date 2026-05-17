import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { ArrowLeft, Navigation, Star, Clock, Locate, X, Scissors, Users, Loader2, LocateOff } from 'lucide-react';
import { useBarbers } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/marker-icon-2x.png',
  iconUrl: '/marker-icon.png',
  shadowUrl: '/marker-shadow.png',
});

const ME_ICON = L.divIcon({
  className: '',
  html: `<div style="width:20px;height:20px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(59,130,246,0.5);"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function barberPhotoIcon(avatar: string, shopName: string, status: string, selected: boolean) {
  const statusRing: Record<string, string> = {
    available: '#10b981',
    finishing_soon: '#f59e0b',
    busy: '#ef4444',
    offline: '#9ca3af',
  };
  const ring = statusRing[status] || '#10b981';
  const size = selected ? 52 : 44;
  const shadow = selected ? `0 0 0 3px hsl(38 92% 52%)` : `0 2px 6px rgba(0,0,0,0.25)`;
  const initial = (shopName?.[0] || '✂').toUpperCase();
  const imgHtml = avatar && !avatar.startsWith('/')
    ? `<img src="${avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none';this.nextSibling.style.display='flex'" /><div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;font-size:${Math.round(size * 0.4)}px;font-weight:900;color:#fff;border-radius:50%;">${initial}</div>`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:${Math.round(size * 0.4)}px;font-weight:900;color:#fff;border-radius:50%;">${initial}</div>`;

  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;
      border-radius:50%;
      border:3px solid ${ring};
      box-shadow:${shadow};
      overflow:hidden;
      background:linear-gradient(135deg,hsl(38 92% 42%),hsl(28 90% 30%));
    ">${imgHtml}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function FlyTo({ pos }: { pos: [number, number] | null }) {
  const map = useMap();
  useEffect(() => { if (pos) map.flyTo(pos, 15, { duration: 0.8 }); }, [pos, map]);
  return null;
}

function FlyToUser({ pos }: { pos: [number, number] | null }) {
  const map = useMap();
  useEffect(() => { if (pos) map.flyTo(pos, 15, { duration: 1 }); }, [pos, map]);
  return null;
}

type Filter = 'all' | 'available' | 'nearby';

export default function MapPage() {
  const navigate = useNavigate();
  const allBarbers = useBarbers();
  const { language } = useLanguage();
  const ar = language === 'ar';

  const [userLoc, setUserLoc] = useState<[number, number] | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [flyToUser, setFlyToUser] = useState<[number, number] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [routeInfo, setRouteInfo] = useState<{ distKm: number; etaMin: number } | null>(null);
  const watchRef = useRef<number | null>(null);

  const stopWatch = useCallback(() => {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
  }, []);

  const startLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error(ar ? 'الجهاز لا يدعم GPS' : 'GPS not supported');
      return;
    }
    setLocationLoading(true);
    stopWatch();

    watchRef.current = navigator.geolocation.watchPosition(
      pos => {
        const p: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserLoc(p);
        setLocationEnabled(true);
        setLocationLoading(false);
        setFlyToUser(prev => prev ? null : p);
      },
      err => {
        setLocationLoading(false);
        setLocationEnabled(false);
        toast.error(
          err.code === 1
            ? (ar ? 'فعّل إذن الموقع من الإعدادات' : 'Enable location permission')
            : (ar ? 'تعذّر تحديد الموقع' : 'Failed to get location')
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }
    );
  }, [ar, stopWatch]);

  const toggleLocation = useCallback(() => {
    if (locationEnabled || locationLoading) {
      stopWatch();
      setLocationEnabled(false);
      setLocationLoading(false);
      setUserLoc(null);
      setFlyToUser(null);
      setRouteInfo(null);
    } else {
      startLocation();
    }
  }, [locationEnabled, locationLoading, startLocation, stopWatch]);

  useEffect(() => () => stopWatch(), [stopWatch]);

  const barbersWithCoords = allBarbers.filter(b => b.lat && b.lng && (b.services?.length || 0) > 0 && b.onboardingComplete === true);

  const filtered = barbersWithCoords.filter(b => {
    if (filter === 'available') return b.liveStatus === 'available';
    if (filter === 'nearby' && userLoc) {
      const dx = (b.lat! - userLoc[0]) * 111;
      const dy = (b.lng! - userLoc[1]) * 111 * Math.cos(b.lat! * Math.PI / 180);
      return Math.sqrt(dx * dx + dy * dy) < 5;
    }
    return true;
  });

  const selectedBarber = filtered.find(b => b.id === selected);

  useEffect(() => {
    if (!selectedBarber || !userLoc) { setRouteInfo(null); return; }
    const { lat, lng } = selectedBarber;
    if (!lat || !lng) return;
    fetch(`https://router.project-osrm.org/route/v1/driving/${userLoc[1]},${userLoc[0]};${lng},${lat}?overview=false`)
      .then(r => r.json())
      .then(d => {
        const r = d.routes?.[0];
        if (r) setRouteInfo({ distKm: r.distance / 1000, etaMin: Math.round(r.duration / 60) });
      })
      .catch(() => {
        if (userLoc && lat && lng) {
          const dx = (lat - userLoc[0]) * 111;
          const dy = (lng - userLoc[1]) * 111;
          setRouteInfo({ distKm: Math.sqrt(dx * dx + dy * dy), etaMin: Math.round(Math.sqrt(dx * dx + dy * dy) / 0.5) });
        }
      });
  }, [selectedBarber?.id, userLoc]);

  const statusLabel = (s: string) => ({
    available: ar ? 'متاح ✅' : 'Available ✅',
    finishing_soon: ar ? 'ينتهي قريباً 🟡' : 'Finishing soon 🟡',
    busy: ar ? 'مشغول 🔴' : 'Busy 🔴',
    offline: ar ? 'مغلق ⚫' : 'Closed ⚫',
  }[s] || (ar ? 'متاح' : 'Available'));

  return (
    <div className="fixed inset-0 bg-background">
      <div className="absolute top-0 left-0 right-0 z-[1000] px-4 pt-12 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} style={{ touchAction: 'manipulation' }}
            className="w-10 h-10 bg-background border border-border rounded-full flex items-center justify-center shadow-md">
            <ArrowLeft size={18} className="text-foreground" />
          </button>

          <div className="flex-1 bg-background border border-border rounded-2xl px-4 py-2.5 shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black text-foreground">{ar ? 'الحلاقون القريبون' : 'Nearby Barbers'}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users size={11} />
                <span>{filtered.filter(b => b.liveStatus === 'available').length} {ar ? 'متاح' : 'available'}</span>
              </div>
            </div>
          </div>

          <button
            onClick={toggleLocation}
            style={{
              touchAction: 'manipulation',
              background: locationEnabled
                ? 'linear-gradient(135deg, hsl(38 92% 52%) 0%, hsl(28 90% 40%) 100%)'
                : 'hsl(var(--background))',
              border: locationEnabled ? 'none' : '1px solid hsl(var(--border))',
            }}
            className="flex flex-col items-center justify-center w-12 h-12 rounded-2xl shadow-xl"
          >
            {locationLoading ? (
              <Loader2 size={17} className="text-white animate-spin" />
            ) : locationEnabled ? (
              <Locate size={17} className="text-white" />
            ) : (
              <LocateOff size={17} className="text-foreground/60" />
            )}
            <span className="text-[8px] font-black leading-none mt-0.5"
              style={{ color: locationEnabled ? '#fff' : 'hsl(var(--muted-foreground))' }}>
              {locationLoading ? '...' : locationEnabled ? (ar ? 'مشغّل' : 'ON') : (ar ? 'موقع' : 'OFF')}
            </span>
          </button>
        </div>

        <div className="flex gap-2 mt-2.5 overflow-x-auto pb-1">
          {([
            { key: 'all', label: ar ? 'الكل' : 'All', count: barbersWithCoords.length },
            { key: 'available', label: ar ? 'متاح الآن' : 'Available', count: barbersWithCoords.filter(b => b.liveStatus === 'available').length },
            { key: 'nearby', label: ar ? 'الأقرب' : 'Nearby', count: null },
          ] as { key: Filter; label: string; count: number | null }[]).map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              style={{ touchAction: 'manipulation' }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-sm ${
                filter === f.key
                  ? 'bg-primary text-white'
                  : 'bg-background border border-border text-foreground/80'
              }`}
            >
              {f.label}
              {f.count !== null && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${filter === f.key ? 'bg-white/20' : 'bg-border'}`}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <MapContainer
        center={userLoc || [31.9539, 35.9106]}
        zoom={13}
        scrollWheelZoom
        style={{ position: 'absolute', inset: 0, zIndex: 0, width: '100%', height: '100%' }}
        attributionControl={false}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution=""
          errorTileUrl="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          keepBuffer={4}
        />
        {flyToUser && <FlyToUser pos={flyToUser} />}
        {selectedBarber && <FlyTo pos={[selectedBarber.lat!, selectedBarber.lng!]} />}
        {userLoc && locationEnabled && <Marker position={userLoc} icon={ME_ICON} />}
        {filtered.map(b => (
          <Marker
            key={b.id}
            position={[b.lat!, b.lng!]}
            icon={barberPhotoIcon(b.avatar, b.shopName || b.name, b.liveStatus || 'available', selected === b.id)}
            eventHandlers={{ click: () => setSelected(prev => prev === b.id ? null : b.id) }}
          />
        ))}
      </MapContainer>

      {locationLoading && (
        <div className="absolute top-32 left-1/2 -translate-x-1/2 z-[1000] bg-black/70 backdrop-blur-sm border border-white/10 rounded-2xl px-4 py-2 flex items-center gap-2">
          <Loader2 size={13} className="text-primary animate-spin" />
          <span className="text-xs text-white font-bold">
            {ar ? 'جارٍ تحديد موقعك...' : 'Getting your location...'}
          </span>
        </div>
      )}

      <div className={`absolute bottom-28 left-4 right-4 z-[1000] transition-all duration-300 ease-out ${
        selectedBarber ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0 pointer-events-none'
      }`}>
        {selectedBarber && (
          <div className="bg-card/95 backdrop-blur-sm border border-border rounded-3xl p-4 shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              {selectedBarber.avatar && !selectedBarber.avatar.startsWith('/') ? (
                <img src={selectedBarber.avatar} alt="" className="w-14 h-14 rounded-2xl object-cover flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Scissors size={22} className="text-primary" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-black text-foreground truncate">{selectedBarber.shopName || selectedBarber.name}</p>
                <p className="text-xs text-muted-foreground truncate">{selectedBarber.address || selectedBarber.name}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[11px] font-bold text-primary">{statusLabel(selectedBarber.liveStatus || 'available')}</span>
                  {selectedBarber.rating && (
                    <div className="flex items-center gap-1">
                      <Star size={10} className="fill-primary text-primary" />
                      <span className="text-xs font-bold">{selectedBarber.rating.toFixed(1)}</span>
                    </div>
                  )}
                  {routeInfo && (
                    <>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Navigation size={10} /> {routeInfo.distKm.toFixed(1)} km
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock size={10} /> {routeInfo.etaMin} {ar ? 'د' : 'min'}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <button onClick={() => setSelected(null)}
                className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                <X size={13} className="text-muted-foreground" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => navigate(`/barbers/${selectedBarber.id}`)}
                className="bg-primary text-primary-foreground py-3 rounded-2xl text-sm font-black"
              >
                {ar ? 'احجز الآن' : 'Book Now'}
              </button>
              <button
                onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedBarber.lat},${selectedBarber.lng}`, '_blank')}
                className="bg-secondary text-foreground py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-1.5"
              >
                <Navigation size={14} /> {ar ? 'الاتجاهات' : 'Directions'}
              </button>
            </div>
          </div>
        )}
      </div>

      {filtered.length === 0 && (
        <div className="absolute bottom-32 left-4 right-4 z-[1000] bg-card/90 backdrop-blur-sm border border-border rounded-2xl p-4 text-center">
          <p className="text-sm font-bold text-foreground">{ar ? 'لا يوجد حلاقون' : 'No barbers found'}</p>
          <p className="text-xs text-muted-foreground mt-1">{ar ? 'جرب فلتراً آخر' : 'Try a different filter'}</p>
        </div>
      )}
    </div>
  );
}
