import { motion } from '@/three/motion/motionKit';
import { cn } from '@/helpers/utils';

/**
 * The outcome panel a document ends on: approved, declined, claim received,
 * expired.
 *
 * One component and three tokens, because these were four separate callouts
 * that between them used `emerald-50`, `emerald-950` and a bare `bg-muted` —
 * a palette outside the theme, which meant they were the only surfaces on the
 * site that did not follow a mode switch. See `--success` in `globals.css`.
 *
 * @param {{ tone?: 'success'|'warning'|'info'|'muted', icon?: React.ComponentType,
 *   title: string, children?: React.ReactNode, animate?: boolean }} props
 */
export function DocumentNotice({ tone = 'muted', icon: Icon, title, children, animate = true }) {
  const Wrapper = animate ? motion.div : 'div';
  const motionProps = animate
    ? { initial: { opacity: 0, scale: 0.97 }, animate: { opacity: 1, scale: 1 } }
    : {};

  return (
    <Wrapper
      {...motionProps}
      role="status"
      className={cn(
        'flex items-start gap-3 rounded-lg border p-4',
        tone === 'success' && 'surface-success',
        tone === 'warning' && 'surface-warning',
        tone === 'info' && 'surface-info',
        tone === 'muted' && 'border-transparent bg-muted text-muted-foreground',
      )}
    >
      {Icon ? <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden /> : null}
      <div>
        <p className="font-semibold">{title}</p>
        {children ? <p className="mt-0.5 text-sm opacity-80">{children}</p> : null}
      </div>
    </Wrapper>
  );
}
