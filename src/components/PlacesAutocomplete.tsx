import { useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { Input } from '@/components/ui/input';

interface PlacesAutocompleteProps {
  value: string;
  onChange: (place: { name: string; lat: number | null; lng: number | null }) => void;
  placeholder?: string;
  id?: string;
  className?: string;
}

export default function PlacesAutocomplete({
  value,
  onChange,
  placeholder = 'Search location…',
  id,
  className,
}: PlacesAutocompleteProps) {
  const places = useMapsLibrary('places');
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (!places || !inputRef.current) return;

    autocompleteRef.current = new places.Autocomplete(inputRef.current, {
      fields: ['formatted_address', 'geometry', 'name'],
    });

    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current?.getPlace();
      if (!place) return;
      const name = place.formatted_address || place.name || '';
      const lat = place.geometry?.location?.lat() ?? null;
      const lng = place.geometry?.location?.lng() ?? null;
      setInputValue(name);
      onChange({ name, lat, lng });
    });

    return () => {
      if (autocompleteRef.current && (window as any).google) {
        (window as any).google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [places]);

  return (
    <Input
      ref={inputRef}
      id={id}
      value={inputValue}
      onChange={(e) => {
        setInputValue(e.target.value);
        onChange({ name: e.target.value, lat: null, lng: null });
      }}
      placeholder={placeholder}
      className={className}
    />
  );
}
