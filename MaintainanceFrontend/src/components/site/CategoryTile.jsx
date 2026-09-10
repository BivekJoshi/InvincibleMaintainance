import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { motion } from '@/three/motion/motionKit';
import { DataIcon } from './DataIcon';
import { Media } from './Media';

/**
 * A trade tile for the storefront's front door.
 *
 * The row under the hero is the first choice a visitor makes, so each tile is
 * a target rather than a label: the trade's own mark, its name, how many
 * services sit behind it, and an arrow that leans out on hover. A watermark of
 * the same mark fills the corner, which stops an un-illustrated tile from
 * reading as an empty box.
 */
export function CategoryTile({ category, count, media, index = 0 }) {
  const picture = media?.[category.imageId];
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: index * 0.04 } },
      }}
      className="h-full"
    >
      <Card className="group relative h-full overflow-hidden card-hover">
        <Link to={`/services?category=${category.slug}`} className="flex h-full flex-col">
          {picture ? <Media media={picture} ratio={16 / 9} icon={category.icon} scrim="soft" zoom /> : null}

          <span className="relative flex flex-1 flex-col gap-5 p-5">
            {/* The trade's mark twice: once as the plate that carries it, once
                blown up behind the words at the opacity of a watermark. */}
            {picture ? null : (
              <DataIcon
                name={category.icon}
                className="pointer-events-none absolute -right-3 -top-2 h-24 w-24 text-primary/[0.06] transition-transform duration-500 group-hover:scale-110"
              />
            )}
            {picture ? null : (
              <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary ring-1 ring-inset ring-primary/15 transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground group-hover:ring-primary">
                <DataIcon name={category.icon} />
              </span>
            )}

            <span className="mt-auto flex items-end justify-between gap-3">
              <span>
                <span className="block text-[15px] font-semibold leading-snug tracking-tight transition-colors duration-300 group-hover:text-primary">
                  {category.name}
                </span>
                <span className="mt-1 block text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  {count != null ? `${count} service${count === 1 ? '' : 's'}` : 'Book online'}
                </span>
              </span>
              <ArrowRight
                className="h-4 w-4 shrink-0 translate-x-0 text-muted-foreground/50 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-primary"
                aria-hidden
              />
            </span>
          </span>

          <span className="underscore-gold absolute inset-x-0 bottom-0" aria-hidden />
        </Link>
      </Card>
    </motion.div>
  );
}
