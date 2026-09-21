import { initials } from '@/helpers/format';
import { cn } from '@/helpers/utils';

/** A steady colour per customer, from the theme's own accents, so a face is recognisable across pages. */
const AVATAR_TONES = ['--chart-1', '--gold', '--info', '--note-purple-edge', '--success', '--primary'];
const avatarTone = (id = '') => AVATAR_TONES[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATAR_TONES.length];

const SIZES = { sm: 'h-9 w-9 text-xs', lg: 'h-14 w-14 text-lg' };

/** Initials in the customer's colour — round for a person, squared for a company. */
export function CustomerAvatar({ customer, size = 'sm', className }) {
  const company = customer.type === 'company';
  return (
    <span
      role="img"
      aria-label={company ? 'Company' : 'Individual'}
      style={{ '--tone': `var(${avatarTone(customer.id)})` }}
      className={cn(
        'grid shrink-0 place-items-center bg-[hsl(var(--tone)/0.14)] font-bold text-[hsl(var(--tone))] ring-1 ring-[hsl(var(--tone)/0.25)]',
        SIZES[size], company ? 'rounded-xl' : 'rounded-full', className,
      )}
    >
      <span lang={customer.preferredLocale}>{initials(customer.name)}</span>
    </span>
  );
}
