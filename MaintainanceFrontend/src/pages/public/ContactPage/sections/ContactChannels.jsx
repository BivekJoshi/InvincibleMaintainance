import { ArrowUpRight, Clock, Mail, MapPin, Phone } from 'lucide-react';
import { Eyebrow } from '@/components/site/Eyebrow';
import { Stagger, StaggerOnView } from '@/three/motion/motionKit';

const ROW = {
  hidden: { opacity: 0, x: -14 },
  show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

/** A line the visitor can act on. Wrapped in an anchor only when there is one. */
function ContactRow({ icon: Icon, label, value, href }) {
  const body = (
    <>
      <span className="flex items-center gap-4">
        <Icon className="h-4 w-4 shrink-0 text-gold" aria-hidden />
        <span>
          <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
          <span className="mt-0.5 block text-lg tracking-tight">{value}</span>
        </span>
      </span>
      {href ? (
        <ArrowUpRight
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          aria-hidden
        />
      ) : null}
    </>
  );

  const className = 'group flex items-center justify-between gap-4 py-5 transition-colors';
  return href
    ? <a href={href} className={`${className} hover:text-primary`}>{body}</a>
    : <div className={className}>{body}</div>;
}

/**
 * Every way to reach the company that is not this page's form.
 *
 * A visitor with a burst pipe wants a phone number, not a form — so the numbers
 * are as prominent as the form beside them, and each is a real `tel:` link
 * because most of this traffic is already holding a phone.
 */
export function ContactChannels({ phone, mobile, email, address }) {
  const rows = [
    { icon: Phone, label: 'Phone', value: phone, href: `tel:${phone}` },
    { icon: Phone, label: 'Mobile', value: mobile, href: `tel:${mobile}` },
    { icon: Mail, label: 'Email', value: email, href: `mailto:${email}` },
    { icon: MapPin, label: 'Address', value: address },
    { icon: Clock, label: 'Response time', value: 'We call back within two hours' },
  ].filter((row) => row.value);

  return (
    <div>
      <Eyebrow>Direct lines</Eyebrow>
      <h2 className="mt-3 text-2xl font-bold tracking-tight">Reach us without a form</h2>
      <StaggerOnView className="mt-8 divide-y border-y" stagger={0.06}>
        {rows.map((row) => (
          <Stagger.Item key={row.label} variants={ROW}>
            <ContactRow {...row} />
          </Stagger.Item>
        ))}
      </StaggerOnView>
    </div>
  );
}
