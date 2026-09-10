import { motion } from '@/three/motion/motionKit';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { IS_DEV } from '@/config/env';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../loginContent';

/**
 * One-click sign-in for each seeded role.
 *
 * Gated on `IS_DEV`, which Vite resolves at build time — the array and the
 * password are removed from the production bundle entirely, not merely hidden.
 */
export function DemoAccounts({ variants, onPick }) {
  if (!IS_DEV) return null;

  return (
    <motion.div variants={variants} className="mt-7">
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="eyebrow shrink-0 text-muted-foreground">Demo accounts</span>
        <Separator className="flex-1" />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {DEMO_ACCOUNTS.map((account) => (
          <Button
            key={account.email}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPick(account.email)}
            className="h-7 rounded-full bg-card/70 px-3 font-normal text-muted-foreground hover:border-gold/50 hover:text-foreground"
          >
            {account.role}
          </Button>
        ))}
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        Development build only. Seeded password: <code>{DEMO_PASSWORD}</code>
      </p>
    </motion.div>
  );
}
