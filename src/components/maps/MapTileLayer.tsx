import { useState } from 'react';
import { TileLayer } from 'react-leaflet';

const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';
const CARTO_ATTRIBUTION = `${OSM_ATTRIBUTION}, &copy; <a href="https://carto.com/attribution/">CARTO</a>`;

/** Uses the previous CARTO Voyager basemap when an app-owned key is configured,
 * and returns to standard OSM tiles if CARTO cannot serve the layer. */
export default function MapTileLayer() {
  const [cartoUnavailable, setCartoUnavailable] = useState(false);
  const cartoKey = import.meta.env.VITE_CARTO_API_KEY?.trim();
  const useCarto = Boolean(cartoKey) && !cartoUnavailable;
  const url = useCarto
    ? `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${encodeURIComponent(cartoKey!)}`
    : OSM_TILE_URL;

  return (
    <TileLayer
      key={url}
      url={url}
      attribution={useCarto ? CARTO_ATTRIBUTION : OSM_ATTRIBUTION}
      errorTileUrl={OSM_TILE_URL}
      eventHandlers={useCarto ? { tileerror: () => setCartoUnavailable(true) } : undefined}
      maxZoom={19}
      keepBuffer={4}
    />
  );
}
