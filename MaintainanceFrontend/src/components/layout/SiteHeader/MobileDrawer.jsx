import { Link, NavLink } from 'react-router-dom';
import { CalendarCheck, ChevronRight, LayoutDashboard, LogIn, Phone, X } from 'lucide-react';
import { EASE, motion } from '@/three/motion/motionKit';
import { Button } from '@/components/ui/button';
import { DataIcon } from '@/components/site/DataIcon';
import { LocaleSwitch } from '@/components/common/LocaleSwitch';
import { ThemeModeSwitch } from '@/components/theme/ThemeModeSwitch';
import { cn } from '@/helpers/utils';
import { HeaderSearch } from './HeaderSearch';

/**
 * The small-screen menu: a sheet off the right edge rather than a panel that
 * pushes the page down. It can be flicked closed, and it never animates height.
 *
 * The language and theme controls own their own state, so this takes neither —
 * the drawer is a place to put them, not their owner.
 */
export function MobileDrawer({
  reduced, focusSearch, query, categories, nav, company, phone, mobile,
  isAuthenticated, appHome, activeTo, onSearch, onClose,
}) {
  const list = {
    hidden: {},
    show: { transition: { staggerChildren: reduced ? 0 : 0.045, delayChildren: reduced ? 0 : 0.1 } },
  };
  const row = {
    hidden: reduced ? {} : { opacity: 0, x: 20 },
    show: { opacity: 1, x: 0, transition: { duration: reduced ? 0 : 0.42, ease: EASE } },
  };

  const links = [
    ...nav,
    {
      to: isAuthenticated ? appHome : '/login',
      label: isAuthenticated ? 'Dashboard' : 'Staff login',
      icon: isAuthenticated ? LayoutDashboard : LogIn,
    },
  ];

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduced ? 0.01 : 0.25 }}
        onClick={onClose}
        className="fixed inset-0 z-[45] bg-ink/50 backdrop-blur-sm lg:hidden"
        aria-hidden
      />

      <motion.div
        id="site-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`${company} menu`}
        initial={reduced ? { opacity: 0 } : { x: '100%' }}
        animate={reduced ? { opacity: 1 } : { x: 0 }}
        exit={reduced ? { opacity: 0 } : { x: '100%' }}
        transition={reduced ? { duration: 0.01 } : { type: 'spring', stiffness: 330, damping: 36, mass: 0.9 }}
        drag={reduced ? false : 'x'}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.25 }}
        onDragEnd={(_, info) => { if (info.offset.x > 90 || info.velocity.x > 600) onClose(); }}
        className="fixed inset-y-0 right-0 z-50 flex w-[min(22rem,88vw)] flex-col bg-background shadow-float lg:hidden"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b px-5">
          <span className="text-sm font-semibold tracking-tight">{company}</span>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close menu">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <motion.div variants={list} initial="hidden" animate="show" className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          <motion.div variants={row}>
            <HeaderSearch defaultValue={query} onSearch={onSearch} autoFocus={focusSearch} compact={false} />
          </motion.div>

          <nav className="mt-5" aria-label="Main">
            {links.map((item) => {
              const Icon = item.icon;
              return (
                <motion.div key={item.to} variants={row}>
                  <NavLink
                    to={item.to}
                    className={cn(
                      'group/link flex items-center justify-between gap-3 border-b py-3.5 text-[15px] font-medium transition-colors',
                      activeTo === item.to ? 'text-primary' : 'hover:text-primary',
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      {Icon ? <Icon className="h-4 w-4 text-muted-foreground" aria-hidden /> : null}
                      {item.label}
                    </span>
                    <ChevronRight
                      aria-hidden
                      className="h-4 w-4 text-muted-foreground transition-transform duration-300 group-hover/link:translate-x-1"
                    />
                  </NavLink>
                </motion.div>
              );
            })}
          </nav>

          {categories.length ? (
            <motion.div variants={row} className="mt-6">
              <p className="eyebrow text-muted-foreground">Browse by trade</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {categories.map((c) => (
                  <Link
                    key={c.id}
                    to={`/services?category=${c.slug}`}
                    className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"
                  >
                    <DataIcon name={c.icon} className="h-3.5 w-3.5" />
                    {c.name}
                  </Link>
                ))}
              </div>
            </motion.div>
          ) : null}

          <motion.div variants={row} className="mt-6">
            <p className="eyebrow text-muted-foreground">Talk to us</p>
            <div className="mt-3 space-y-1.5">
              {[phone, mobile].map((n) => (
                <a
                  key={n}
                  href={`tel:${n}`}
                  className="flex items-center gap-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Phone className="h-3.5 w-3.5 text-gold" aria-hidden /> {n}
                </a>
              ))}
            </div>
          </motion.div>
        </motion.div>

        <div className="shrink-0 space-y-3 border-t p-5">
          <div className="flex gap-3">
            <Button asChild className="flex-1"><Link to="/book"><CalendarCheck className="h-4 w-4" /> Book a visit</Link></Button>
            <Button asChild variant="outline" className="flex-1"><a href={`tel:${mobile}`}><Phone className="h-4 w-4" /> Call us</a></Button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <LocaleSwitch />
            <ThemeModeSwitch size="sm" />
          </div>
        </div>
      </motion.div>
    </>
  );
}
