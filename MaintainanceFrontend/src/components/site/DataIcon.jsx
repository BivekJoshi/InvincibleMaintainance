import {
  BadgeCheck, CalendarCheck, ChefHat, Clock, Coins, Compass, Droplets, Expand, FileCheck,
  FileText, Flame, Gift, Hammer, HardHat, Home, LayoutGrid, Phone, Plug, Receipt, Recycle,
  Ruler, Search, Shield, ShieldCheck, Sofa, TestTube, Timer, Umbrella, Wallet, Wrench, Zap,
} from 'lucide-react';
import { cn } from '@/helpers/utils';

/**
 * CMS rows carry a kebab-case lucide name in `icon`. Mapping them explicitly
 * (rather than `import * as Icons`) keeps the marketing bundle to the icons we
 * actually ship, and makes an unknown name fail visibly at review time.
 */
const ICONS = {
  'badge-check': BadgeCheck, 'calendar-check': CalendarCheck, 'chef-hat': ChefHat,
  clock: Clock, coins: Coins, compass: Compass, droplets: Droplets, expand: Expand,
  'file-check': FileCheck, 'file-text': FileText, flame: Flame, gift: Gift, hammer: Hammer,
  'hard-hat': HardHat, home: Home, 'layout-grid': LayoutGrid, phone: Phone,
  plug: Plug, receipt: Receipt, recycle: Recycle, ruler: Ruler, search: Search,
  shield: Shield, 'shield-check': ShieldCheck, sofa: Sofa, 'test-tube': TestTube,
  timer: Timer, umbrella: Umbrella, wallet: Wallet, wrench: Wrench, zap: Zap,
};

/** Renders the icon a content row asked for, falling back to a neutral mark. */
export function DataIcon({ name, className }) {
  const Icon = ICONS[name] ?? Compass;
  return <Icon className={cn('h-5 w-5', className)} aria-hidden />;
}
