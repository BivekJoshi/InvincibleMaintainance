/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import crypto from 'node:crypto';
import * as D from './seed-data.js';

const prisma = new PrismaClient();

const toPaisa = (r) => Math.round(Number(r || 0) * 100);
const days = (n) => new Date(Date.now() + n * 86400000);
const token = () => crypto.randomBytes(32).toString('base64url');

const HOME_SECTIONS = [
  ['hero', 'Hero slider'], ['quick_inquiry', 'Quick inquiry strip'], ['services', 'Services grid'],
  ['projects', 'Projects'], ['offers', 'Special offers'], ['gallery', 'Photo gallery'],
  ['why_choose', 'Why choose us'], ['stats', 'Counters'], ['seepage', 'Seepage & cracks'],
  ['interior', 'Interior design'], ['construction', 'Why construction'], ['renovation', 'Renovation reasons'],
  ['pre_engineered', 'Pre-engineered buildings'], ['kitchen', 'Kitchen modernization'],
  ['pricing', 'Popular work & pricing'], ['other_civil', 'Other civil work'],
  ['process', 'Working process'], ['testimonials', 'Testimonials'], ['cta_form', 'Free consultation form'],
];

async function main() {
  console.log('Seeding…');

  // ── settings
  for (const s of D.SETTINGS) {
    await prisma.setting.upsert({
      where: { key: s.key },
      create: { ...s, value: s.value },
      update: { group: s.group, label: s.label, type: s.type, hint: s.hint, sortOrder: s.sortOrder },
    });
  }
  console.log(`  settings: ${D.SETTINGS.length}`);

  // ── users
  const hash = await argon2.hash('Password123', { type: argon2.argon2id });
  const USERS = [
    { name: 'Admin', email: 'admin@homeplexnepal.com', role: 'ADMIN', phone: '9808338255' },
    { name: 'Sabina Editor', email: 'editor@homeplexnepal.com', role: 'EDITOR', phone: '9841000001' },
    { name: 'Rajesh Sales', email: 'sales@homeplexnepal.com', role: 'SALES', phone: '9841000002' },
    { name: 'Kiran Dispatcher', email: 'dispatch@homeplexnepal.com', role: 'DISPATCHER', phone: '9841000003' },
    { name: 'Bimal Accountant', email: 'accounts@homeplexnepal.com', role: 'ACCOUNTANT', phone: '9841000004' },
    { name: 'Hari Technician', email: 'hari@homeplexnepal.com', role: 'TECHNICIAN', phone: '9841000005' },
    { name: 'Suresh Technician', email: 'suresh@homeplexnepal.com', role: 'TECHNICIAN', phone: '9841000006' },
  ];
  const users = {};
  for (const u of USERS) {
    users[u.role === 'TECHNICIAN' ? u.email : u.role] = await prisma.user.upsert({
      where: { email: u.email },
      create: { ...u, passwordHash: hash },
      update: { name: u.name, role: u.role, phone: u.phone },
    });
  }
  console.log(`  users: ${USERS.length} (password: Password123)`);

  // ── technicians
  const techs = [];
  for (const [i, email] of ['hari@homeplexnepal.com', 'suresh@homeplexnepal.com'].entries()) {
    techs.push(await prisma.technician.upsert({
      where: { userId: users[email].id },
      create: {
        userId: users[email].id,
        employeeCode: `TECH-00${i + 1}`,
        skills: i === 0 ? ['waterproofing', 'repair-maintenance'] : ['interior', 'construction'],
        certifications: i === 0 ? ['Waterproofing Level 2'] : ['Carpentry Level 3'],
        serviceAreas: ['Lalitpur', 'Kathmandu'],
        hourlyRate: toPaisa(i === 0 ? 450 : 400),
        dailyCapacity: 4,
      },
      update: {},
    }));
  }
  console.log(`  technicians: ${techs.length}`);

  // ── home sections
  for (const [i, [key, title]] of HOME_SECTIONS.entries()) {
    await prisma.homeSection.upsert({
      where: { key },
      create: { key, title, sortOrder: i, isVisible: true },
      update: { title },
    });
  }

  // ── message templates
  for (const t of D.MESSAGE_TEMPLATES) {
    await prisma.messageTemplate.upsert({
      where: { key_channel_locale: { key: t.key, channel: t.channel, locale: t.locale } },
      create: t,
      update: { body: t.body, subject: t.subject },
    });
  }
  console.log(`  message templates: ${D.MESSAGE_TEMPLATES.length}`);

  // ── hero slides
  await prisma.heroSlide.deleteMany({});
  await prisma.heroSlide.createMany({ data: D.HERO_SLIDES });

  // ── categories + services
  const cats = {};
  for (const c of D.SERVICE_CATEGORIES) {
    cats[c.slug] = await prisma.serviceCategory.upsert({ where: { slug: c.slug }, create: c, update: c });
  }

  const slugify = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const services = {};
  for (const s of [...D.SERVICES, ...D.OTHER_CIVIL]) {
    const { category, priceFrom, priceTo, ...rest } = s;
    const slug = slugify(s.name);
    services[slug] = await prisma.service.upsert({
      where: { slug },
      create: {
        ...rest, slug, categoryId: cats[category].id,
        priceFrom: priceFrom != null ? toPaisa(priceFrom) : null,
        priceTo: priceTo != null ? toPaisa(priceTo) : null,
      },
      update: { excerpt: rest.excerpt, body: rest.body },
    });
  }
  console.log(`  services: ${Object.keys(services).length}`);

  // ── features / lists / blocks / process
  await prisma.feature.deleteMany({});
  await prisma.feature.createMany({ data: D.FEATURES });
  await prisma.listItem.deleteMany({});
  await prisma.listItem.createMany({ data: D.LIST_ITEMS });
  await prisma.processStep.deleteMany({});
  await prisma.processStep.createMany({ data: D.PROCESS_STEPS });
  for (const b of D.CONTENT_BLOCKS) {
    await prisma.contentBlock.upsert({ where: { key: b.key }, create: b, update: b });
  }

  // ── offers / pricing / testimonials / faqs
  await prisma.offer.deleteMany({});
  await prisma.offer.createMany({
    data: D.OFFERS.map((o) => ({
      ...o, priceMin: toPaisa(o.priceMin), priceMax: toPaisa(o.priceMax),
      startsAt: days(-7), endsAt: days(60),
    })),
  });
  await prisma.pricingPlan.deleteMany({});
  await prisma.pricingPlan.createMany({
    data: D.PRICING_PLANS.map((p) => ({ ...p, priceMin: toPaisa(p.priceMin), priceMax: toPaisa(p.priceMax) })),
  });
  await prisma.testimonial.deleteMany({});
  await prisma.testimonial.createMany({ data: D.TESTIMONIALS.map((t) => ({ ...t, isApproved: true })) });
  await prisma.faq.deleteMany({});
  await prisma.faq.createMany({ data: D.FAQS });

  // ── projects
  for (const p of D.PROJECTS) {
    const { category, ...rest } = p;
    const slug = slugify(p.title);
    await prisma.project.upsert({
      where: { slug },
      create: { ...rest, slug, categoryId: cats[category].id, completedAt: p.status === 'completed' ? days(-45) : null },
      update: { summary: rest.summary, body: rest.body },
    });
  }
  console.log(`  projects: ${D.PROJECTS.length}`);

  // ── rate card
  for (const r of D.RATE_CARD) {
    await prisma.rateCardItem.upsert({
      where: { code: r.code }, create: { ...r, rate: toPaisa(r.rate) }, update: { rate: toPaisa(r.rate) },
    });
  }
  console.log(`  rate card: ${D.RATE_CARD.length}`);

  // ── materials + opening stock
  const matCats = {};
  for (const name of [...new Set(D.MATERIALS.map((m) => m.category))]) {
    matCats[name] = await prisma.materialCategory.create({ data: { name } }).catch(async () =>
      prisma.materialCategory.findFirst({ where: { name } }));
  }
  const supplier = await prisma.supplier.create({
    data: { name: 'Valley Building Supplies', phone: '01-4470000', address: 'Kalimati, Kathmandu' },
  }).catch(() => prisma.supplier.findFirst());

  const materials = {};
  for (const m of D.MATERIALS) {
    const { category, opening, purchaseRate, sellRate, ...rest } = m;
    materials[m.code] = await prisma.material.upsert({
      where: { code: m.code },
      create: {
        ...rest, categoryId: matCats[category].id, supplierId: supplier.id,
        purchaseRate: toPaisa(purchaseRate), sellRate: toPaisa(sellRate),
      },
      update: {},
    });
    const existing = await prisma.stockMovement.count({ where: { materialId: materials[m.code].id, type: 'PURCHASE' } });
    if (!existing) {
      await prisma.stockMovement.create({
        data: {
          materialId: materials[m.code].id, type: 'PURCHASE', qty: opening,
          rate: toPaisa(purchaseRate), reference: 'Opening stock',
        },
      });
    }
  }
  console.log(`  materials: ${D.MATERIALS.length} with opening stock`);

  // ── job templates
  for (const t of D.JOB_TEMPLATES) {
    const { service, ...rest } = t;
    const existing = await prisma.jobTemplate.findFirst({ where: { name: t.name } });
    if (!existing) {
      await prisma.jobTemplate.create({ data: { ...rest, serviceId: service ? services[service]?.id ?? null : null } });
    }
  }

  // ═══ demo pipeline: leads → customer → quotation → job → invoice → warranty → AMC

  if ((await prisma.lead.count()) === 0) {
    const seepage = services['seepage-damp-treatment'];
    const terrace = services['roof-and-terrace-waterproofing'] ?? services['roof-terrace-waterproofing'];

    // One breached, one at risk, one healthy — so the SLA board has something to show.
    await prisma.lead.createMany({
      data: [
        {
          name: 'Ramesh Karki', phone: '9841234567', address: 'Sanepa, Lalitpur', area: 'Sanepa',
          serviceId: seepage?.id, message: 'Damp patch spreading on the bedroom wall since last monsoon.',
          source: 'web_form', status: 'NEW', assignedToId: users.SALES.id,
          createdAt: new Date(Date.now() - 5 * 3600_000), slaDueAt: new Date(Date.now() - 3 * 3600_000),
        },
        {
          name: 'Nabin Shrestha', phone: '9812345678', address: 'Chabahil, Kathmandu', area: 'Chabahil',
          serviceId: terrace?.id, message: 'Terrace leaking into the top-floor room.',
          source: 'estimator', status: 'NEW', assignedToId: users.SALES.id,
          estimatedAmount: toPaisa(148500), estimatePayload: { qty: 540, unit: 'sq.ft', rateMin: 15000, rateMax: 40000 },
          createdAt: new Date(Date.now() - 100 * 60_000), slaDueAt: new Date(Date.now() + 20 * 60_000),
        },
        {
          name: 'Gita Lama', phone: '9803456789', address: 'Imadol, Lalitpur', area: 'Imadol',
          message: 'Want a quote for a modular kitchen.', source: 'call', status: 'CONTACTED',
          assignedToId: users.SALES.id, firstResponseAt: new Date(Date.now() - 40 * 60_000),
          createdAt: new Date(Date.now() - 60 * 60_000), slaDueAt: new Date(Date.now() + 60 * 60_000),
        },
      ],
    });

    const customer = await prisma.customer.create({
      data: {
        name: 'Sunita Shrestha', phone: '9801112233', email: 'sunita@example.com',
        sites: { create: { label: 'Home — Jhamsikhel', address: 'Jhamsikhel, Lalitpur', area: 'Jhamsikhel', isPrimary: true } },
      },
      include: { sites: true },
    });
    const site = customer.sites[0];

    const fy = 2083;
    await prisma.counter.createMany({
      data: [{ scope: 'QT', year: fy, value: 1 }, { scope: 'JOB', year: fy, value: 1 }, { scope: 'INV', year: fy, value: 1 }, { scope: 'AMC', year: fy, value: 1 }],
      skipDuplicates: true,
    });

    // Quotation: 320 sq.ft seepage treatment + replastering.
    const qItems = [
      { description: 'Chemical damp treatment', unit: 'sq.ft', qty: 320, rate: toPaisa(220) },
      { description: 'Internal plaster repair', unit: 'sq.ft', qty: 320, rate: toPaisa(95) },
    ].map((i, idx) => ({ ...i, amount: Math.round(i.qty * i.rate), sortOrder: idx }));
    const qSub = qItems.reduce((a, b) => a + b.amount, 0);
    const qVat = Math.round((qSub * 13) / 100);

    const quotation = await prisma.quotation.create({
      data: {
        number: `QT-${fy}-0001`, customerId: customer.id, siteId: site.id, status: 'APPROVED',
        validUntil: days(15), subtotal: qSub, vatAmount: qVat, total: qSub + qVat,
        createdById: users.SALES.id, sentAt: days(-10), decidedAt: days(-9), publicToken: token(),
        items: { create: qItems },
      },
    });

    const completedAt = days(-5);
    const job = await prisma.job.create({
      data: {
        number: `JOB-${fy}-0001`, type: 'REPAIR', customerId: customer.id, siteId: site.id,
        quotationId: quotation.id, title: 'Seepage treatment — master bedroom wall',
        description: 'Damp traced to a failed neighbouring terrace outlet.',
        status: 'COMPLETED', scheduledStart: days(-7), actualStart: days(-7), actualEnd: completedAt,
        completionNote: 'Treated and replastered. Ponding test on the adjoining terrace passed.',
        customerRating: 5, customerFeedback: 'Excellent work, wall is completely dry.',
        createdById: users.DISPATCHER.id,
        assignments: { create: { technicianId: techs[0].id, isLead: true } },
        tasks: {
          create: D.JOB_TEMPLATES[0].tasks.map((t, i) => ({ title: t.title, isDone: true, doneAt: completedAt, sortOrder: i })),
        },
        timeLogs: {
          create: { technicianId: techs[0].id, startedAt: days(-7), endedAt: completedAt, minutes: 960 },
        },
        events: { create: { to: 'COMPLETED', actorId: techs[0].userId, note: 'Signed off by customer' } },
      },
    });

    for (const [code, qty] of [['WP-CRYST', 24], ['PUTTY-WALL', 60], ['PAINT-EMUL', 12]]) {
      await prisma.jobMaterial.create({
        data: { jobId: job.id, materialId: materials[code].id, qty, rate: materials[code].sellRate },
      });
      await prisma.stockMovement.create({
        data: { materialId: materials[code].id, type: 'ISSUE_TO_JOB', qty: -qty, rate: materials[code].sellRate, jobId: job.id, reference: job.number },
      });
    }

    const warranty = await prisma.warranty.create({
      data: {
        jobId: job.id, customerId: customer.id, scope: 'Workmanship warranty on seepage treatment',
        startsAt: completedAt, endsAt: days(25), publicToken: token(),
      },
    });

    const invItems = [...qItems.map((i) => ({ ...i, jobId: job.id }))];
    const iSub = invItems.reduce((a, b) => a + b.amount, 0);
    const iVat = Math.round((iSub * 13) / 100);
    const invoice = await prisma.invoice.create({
      data: {
        number: `INV-${fy}-0001`, customerId: customer.id, quotationId: quotation.id, status: 'PARTIAL',
        issuedAt: days(-4), dueDate: days(11), subtotal: iSub, vatAmount: iVat, total: iSub + iVat,
        paidAmount: toPaisa(50000), publicToken: token(),
        items: { create: invItems },
        payments: { create: { amount: toPaisa(50000), method: 'ESEWA', reference: 'ESW-99213', receivedAt: days(-3) } },
      },
    });

    await prisma.amcContract.create({
      data: {
        number: `AMC-${fy}-0001`, customerId: customer.id, siteId: site.id,
        planName: 'Annual Home Care — Standard', coveredServices: ['seepage', 'plumbing', 'electrical'],
        startDate: days(-5), endDate: days(360), visitsPerYear: 4, amount: toPaisa(24000),
        visits: { create: [{ dueDate: days(85) }, { dueDate: days(175) }, { dueDate: days(265) }, { dueDate: days(355) }] },
      },
    });

    await prisma.serviceReminder.create({
      data: {
        customerId: customer.id, jobId: job.id, dueAt: days(325), channel: 'sms',
        message: 'Hello Sunita Shrestha, it has been almost a year since we treated your bedroom wall. Would you like a free pre-monsoon check-up? - Homeplex Nepal',
      },
    });

    console.log(`  demo pipeline: 3 leads, 1 customer, ${quotation.number}, ${job.number}, ${invoice.number}, warranty until ${warranty.endsAt.toISOString().slice(0, 10)}, 1 AMC contract`);
  }

  console.log('\nSeed complete.');
  console.log('  Admin login:      admin@homeplexnepal.com / Password123');
  console.log('  Technician login: hari@homeplexnepal.com / Password123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
