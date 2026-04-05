import { useEffect, useMemo } from 'react';
import { Map, AdvancedMarker, Pin, useMap } from '@vis.gl/react-google-maps';

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
    const bounds = new google.maps.LatLngBounds();
    validStops.forEach((s) => bounds.extend({ lat: s.latitude!, lng: s.longitude! }));
    map.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
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
        {validStops.map((stop, i) => (
          <AdvancedMarker key={stop.id} position={{ lat: stop.latitude!, lng: stop.longitude! }}>
            <div className="bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold shadow-md">
              {i + 1}
            </div>
          </AdvancedMarker>
        ))}
      </Map>
    </div>
  );
}
