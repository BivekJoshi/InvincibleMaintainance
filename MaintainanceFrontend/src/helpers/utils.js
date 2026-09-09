import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** shadcn's class combiner: conditional classes, with Tailwind conflicts resolved. */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
