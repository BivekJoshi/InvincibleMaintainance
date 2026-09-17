import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { parseMapPin } from '@/form/schemas/customer.schema';

/**
 * "Use map pin": paste the coordinates a map app copies (`27.6712, 85.3240`) and they
 * fill Latitude and Longitude. Rendered as the site form's `intro`, inside its form.
 * A map picker replaces it later.
 */
export function MapPinInput() {
  const { setValue } = useFormContext();
  const [text, setText] = useState('');
  const [error, setError] = useState(null);

  const apply = () => {
    const pin = parseMapPin(text);
    if (!pin) {
      setError('Paste two numbers, e.g. 27.6712, 85.3240');
      return;
    }
    setError(null);
    setValue('lat', pin.lat, { shouldDirty: true, shouldValidate: true });
    setValue('lng', pin.lng, { shouldDirty: true, shouldValidate: true });
    setText('');
  };

  return (
    <div className="space-y-1.5 rounded-md border bg-muted/30 p-3">
      <Label htmlFor="map-pin">Use map pin</Label>
      <div className="flex gap-2">
        <Input
          id="map-pin" value={text} placeholder="27.6712, 85.3240" inputMode="decimal"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } }}
          aria-invalid={Boolean(error)} aria-describedby="map-pin-help"
        />
        <Button type="button" variant="outline" onClick={apply} disabled={!text.trim()}><MapPin /> Use</Button>
      </div>
      <p id="map-pin-help" className={error ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
        {error ?? 'In Google Maps, press and hold the spot, then copy the numbers shown.'}
      </p>
    </div>
  );
}
