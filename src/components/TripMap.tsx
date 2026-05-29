import { useEffect, useMemo } from 'react';
import { Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';

interface Stop {
  id: string;
  location_name: string;
  latitude: number | null;
  longitude: number | null;
}

interface TripMapProps {
  stops: Stop[];
  className?: string;
}

function FitBounds({ stops }: { stops: Stop[] }) {
  const map = useMap();
  const validStops = useMemo(() => stops.filter((s) => s.latitude && s.longitude), [stops]);

  useEffect(() => {
    if (!map || validStops.length === 0) return;
    const bounds = new (window as any).google.maps.LatLngBounds();
    validStops.forEach((s) => bounds.extend({ lat: s.latitude!, lng: s.longitude! }));
    map.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
  }, [map, validStops]);

  return null;
}

function StopsPolyline({ stops }: { stops: Stop[] }) {
  const map = useMap();
  const validStops = useMemo(() => stops.filter((s) => s.latitude && s.longitude), [stops]);

  useEffect(() => {
    if (!map || validStops.length < 2) return;
    const g = (window as any).google;
    if (!g?.maps) return;

    // Resolve primary green from the design system at runtime
    const primaryHsl = getComputedStyle(document.documentElement)
      .getPropertyValue('--primary')
      .trim() || '158 64% 42%';
    const color = `hsl(${primaryHsl})`;

    const dashSymbol = {
      path: 'M 0,-1 0,1',
      strokeOpacity: 1,
      strokeColor: color,
      scale: 3,
    };

    const polyline = new g.maps.Polyline({
      path: validStops.map((s) => ({ lat: s.latitude!, lng: s.longitude! })),
      geodesic: true,
      strokeOpacity: 0,
      icons: [{ icon: dashSymbol, offset: '0', repeat: '14px' }],
      zIndex: 0,
      map,
    });

    return () => {
      polyline.setMap(null);
    };
  }, [map, validStops]);

  return null;
}

export default function TripMap({ stops, className = 'h-full w-full min-h-[400px] rounded-lg overflow-hidden' }: TripMapProps) {
  const validStops = stops.filter((s) => s.latitude && s.longitude);
  const center = validStops.length > 0
    ? { lat: validStops[0].latitude!, lng: validStops[0].longitude! }
    : { lat: 35.68, lng: 139.76 };

  return (
    <div className={className}>
      <Map
        defaultCenter={center}
        defaultZoom={6}
        gestureHandling="cooperative"
        mapId="trip-map"
      >
        <FitBounds stops={stops} />
        <StopsPolyline stops={stops} />
        {validStops.map((stop, i) => (
          <AdvancedMarker key={stop.id} position={{ lat: stop.latitude!, lng: stop.longitude! }} zIndex={10}>
            <div className="bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold shadow-md">
              {i + 1}
            </div>
          </AdvancedMarker>
        ))}
      </Map>
    </div>
  );
}
