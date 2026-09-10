import { Card } from '@/components/ui/card';
import { Reveal } from '@/three/motion/motionKit';

/**
 * The office on a map, when an editor has supplied an embed URL — and nothing
 * at all when they have not. A third-party iframe is lazy and same-origin-free
 * by policy: it is a convenience, and it should never be what makes the page
 * slow to become usable.
 */
export function ContactMap({ src }) {
  if (!src) return null;

  return (
    <Reveal delay={0.1}>
      <Card className="mt-8 overflow-hidden">
        <iframe
          src={src}
          title="Our location"
          className="h-72 w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </Card>
    </Reveal>
  );
}
