import { Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';

interface ActivityMapProps {
  lat: number;
  lng: number;
  className?: string;
}

export default function ActivityMap({ lat, lng, className = 'h-48 w-full rounded-lg overflow-hidden' }: ActivityMapProps) {
  return (
    <div className={className}>
      <Map
        defaultCenter={{ lat, lng }}
        defaultZoom={14}
        gestureHandling="cooperative"
        disableDefaultUI
        mapId="activity-map"
      >
        <AdvancedMarker position={{ lat, lng }}>
          <Pin />
        </AdvancedMarker>
      </Map>
    </div>
  );
}
