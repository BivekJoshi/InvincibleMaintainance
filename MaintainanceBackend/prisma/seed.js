import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import crypto from 'node:crypto';
import * as D from './seed-data.js';
import { nextNumber } from '../src/utils/numbering.js';
import { documentTotals } from '../src/utils/money.js';

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
    { name: 'Admin', email: 'admin@gharjatan.com.np', role: 'ADMIN', phone: '9808338255' },
    { name: 'Sabina Editor', email: 'editor@gharjatan.com.np', role: 'EDITOR', phone: '9841000001' },
    { name: 'Rajesh Sales', email: 'sales@gharjatan.com.np', role: 'SALES', phone: '9841000002' },
    { name: 'Meena Manager', email: 'manager@gharjatan.com.np', role: 'MANAGER', phone: '9841000008' },
    { name: 'Kiran Dispatcher', email: 'dispatch@gharjatan.com.np', role: 'DISPATCHER', phone: '9841000003' },
    { name: 'Bimal Accountant', email: 'accounts@gharjatan.com.np', role: 'ACCOUNTANT', phone: '9841000004' },
    { name: 'Hari Technician', email: 'hari@gharjatan.com.np', role: 'TECHNICIAN', phone: '9841000005' },
    { name: 'Suresh Technician', email: 'suresh@gharjatan.com.np', role: 'TECHNICIAN', phone: '9841000006' },
    { name: 'Anita Surveyor', email: 'survey@gharjatan.com.np', role: 'SURVEYOR', phone: '9841000007' },
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

  // ── the admin's shell shortcuts and sticky notes. Upserted by path; a note is
  //    added only if the admin has no live note with the same text.
  const SHORTCUTS = [
    { label: 'Leads', to: '/admin/leads', icon: 'Users' },
    { label: 'Quotations', to: '/admin/quotations', icon: 'FileText' },
    { label: 'Dispatch board', to: '/admin/dispatch', icon: 'CalendarDays' },
  ];
  for (const [sortOrder, s] of SHORTCUTS.entries()) {
    await prisma.userShortcut.upsert({
      where: { userId_to: { userId: users.ADMIN.id, to: s.to } },
      create: { ...s, userId: users.ADMIN.id, sortOrder },
      update: {},
    });
  }
  const NOTES = [
    { body: 'Call back the Lalitpur waterproofing lead before noon.', color: 'yellow', isPinned: true },
    { body: 'शुक्रबार साँझ ५ बजे प्राविधिकहरूसँग साप्ताहिक बैठक।', color: 'blue', isPinned: false },
  ];
  for (const n of NOTES) {
    const exists = await prisma.userNote.findFirst({ where: { userId: users.ADMIN.id, body: n.body, deletedAt: null } });
    if (!exists) await prisma.userNote.create({ data: { ...n, userId: users.ADMIN.id } });
  }
  console.log(`  admin shell: ${SHORTCUTS.length} shortcuts, ${NOTES.length} notes`);

  // ── technicians. A surveyor is a Technician too — that is what keeps them
  //    assignable on the dispatch board and reachable through the /tech app.
  const techs = [];
  for (const [i, email] of ['hari@gharjatan.com.np', 'suresh@gharjatan.com.np'].entries()) {
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
  const surveyor = await prisma.technician.upsert({
    where: { userId: users.SURVEYOR.id },
    create: {
      userId: users.SURVEYOR.id,
      employeeCode: 'SURV-001',
      skills: ['site-survey', 'waterproofing', 'structural-assessment'],
      certifications: ['Civil Engineer (NEC)', 'Moisture metering'],
      serviceAreas: ['Lalitpur', 'Kathmandu', 'Bhaktapur'],
      dailyCapacity: 6,
    },
    update: {},
  });
  console.log(`  technicians: ${techs.length} + 1 surveyor (${surveyor.employeeCode})`);

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

  // ── blog and pages
  const postCats = {};
  for (const c of D.POST_CATEGORIES) {
    postCats[c.slug] = await prisma.postCategory.upsert({ where: { slug: c.slug }, create: c, update: { name: c.name } });
  }
  for (const { category, publishedDaysAgo, ...post } of D.POSTS) {
    await prisma.post.upsert({
      where: { slug: post.slug },
      create: { ...post, categoryId: postCats[category].id, publishedAt: days(-publishedDaysAgo) },
      update: { title: post.title, excerpt: post.excerpt, body: post.body },
    });
  }
  for (const page of D.PAGES) {
    await prisma.page.upsert({ where: { slug: page.slug }, create: page, update: { title: page.title, body: page.body } });
  }
  console.log(`  posts: ${D.POSTS.length}, pages: ${D.PAGES.length}`);

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

  // ── Phase L2: pack sizes on an older database, trades, and demo recipes (only on items with none)
  for (const m of D.MATERIALS.filter((x) => x.packSize)) {
    await prisma.material.updateMany({ where: { code: m.code, packSize: null }, data: { packSize: m.packSize, packLabel: m.packLabel } });
  }
  const trades = {};
  for (const t of D.TRADES) {
    trades[t.code] = await prisma.trade.upsert({
      where: { code: t.code }, create: { ...t, dayWage: toPaisa(t.dayWage) }, update: {},
    });
  }
  let recipes = 0;
  for (const [code, recipe] of Object.entries(D.RECIPES)) {
    const item = await prisma.rateCardItem.findUnique({ where: { code }, include: { _count: { select: { components: true } } } });
    if (!item || item._count.components) continue;
    await prisma.rateCardItem.update({
      where: { code },
      data: {
        rateMode: recipe.rateMode,
        recipeQty: recipe.recipeQty,
        components: {
          create: recipe.components.map(([kind, ref, qty, wastagePct = 0, cost], sortOrder) => {
            const material = kind === 'MATERIAL' ? materials[ref] : null;
            const trade = kind === 'LABOUR' ? trades[ref] : null;
            return {
              kind, qty, wastagePct, sortOrder,
              materialId: material?.id ?? null,
              tradeId: trade?.id ?? null,
              description: material || trade ? null : ref,
              unit: material?.unit ?? (trade ? 'day' : 'lump'),
              cost: cost != null ? toPaisa(cost) : null,
            };
          }),
        },
      },
    });
    recipes += 1;
  }
  console.log(`  trades: ${D.TRADES.length} · recipes: ${recipes} new`);

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
    const seepage = services['seepage-and-damp-treatment'];
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
      // Values match the highest number this seed hands out, so the next real
      // document carries on from here rather than colliding.
      data: [
        { scope: 'QT', year: fy, value: 1 }, { scope: 'JOB', year: fy, value: 1 },
        { scope: 'INV', year: fy, value: 1 }, { scope: 'AMC', year: fy, value: 1 },
      ],
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
        message: 'Hello Sunita Shrestha, it has been almost a year since we treated your bedroom wall. Would you like a free pre-monsoon check-up? - Ghar Jatan',
      },
    });

    console.log(`  demo pipeline: 3 leads, 1 customer, ${quotation.number}, ${job.number}, ${invoice.number}, warranty until ${warranty.endsAt.toISOString().slice(0, 10)}, 1 AMC contract`);
  }

  // ═══ survey demo. Guarded on its own count rather than nested in the leads block,
  //     so `npm run db:seed` tops up a database that already has the demo pipeline.

  if ((await prisma.siteSurvey.count()) === 0) {
    const fy = 2083;
    const days = (n) => new Date(Date.now() + n * 86400000);
    const seepage = services['seepage-and-damp-treatment'];
    const seepChem = await prisma.rateCardItem.findUnique({ where: { code: 'SEEP-CHEM' } });
    const labourSkill = await prisma.rateCardItem.findUnique({ where: { code: 'LABOUR-SKILL' } });
    const wpCryst = await prisma.material.findUnique({ where: { code: 'WP-CRYST' } });
    const completed = await prisma.job.findFirst({
      where: { status: { in: ['COMPLETED', 'VERIFIED'] }, type: { not: 'INSPECTION' } },
      orderBy: { createdAt: 'asc' },
    });

    await prisma.counter.upsert({
      where: { scope_year: { scope: 'SRV', year: fy } },
      create: { scope: 'SRV', year: fy, value: 1 },
      update: { value: { set: 1 } },
    });

    // The customer booked online, so the lead carries preferredAt/preferredSlot.
    const bookedLead = await prisma.lead.create({
      data: {
        name: 'Prakash Maharjan', phone: '9851122334', email: 'prakash.mhj@example.com',
        address: 'Kupondole, Lalitpur', area: 'Kupondole', serviceId: seepage?.id,
        message: 'भुइँतलाको भित्तामा चिस्यान बढ्दै गएको छ।',
        source: 'booking', status: 'INSPECTION_SCHEDULED', assignedToId: users.SALES.id,
        preferredAt: days(1), preferredSlot: 'morning',
        createdAt: days(-2), slaDueAt: days(-2), firstResponseAt: days(-2),
      },
    });
    const bookedCustomer = await prisma.customer.create({
      data: {
        name: 'Prakash Maharjan', phone: '9851122334', email: 'prakash.mhj@example.com',
        sites: { create: { label: 'Home — Kupondole', address: 'Kupondole, Lalitpur', area: 'Kupondole', isPrimary: true } },
      },
      include: { sites: true },
    });
    await prisma.lead.update({ where: { id: bookedLead.id }, data: { customerId: bookedCustomer.id } });
    const bookedSite = bookedCustomer.sites[0];

    const visitNumber = await prisma.$transaction((tx) => nextNumber(tx, 'JOB'));
    const visit = await prisma.job.create({
      data: {
        number: visitNumber, type: 'INSPECTION', customerId: bookedCustomer.id, siteId: bookedSite.id,
        leadId: bookedLead.id, title: 'Free inspection — Seepage & Damp Treatment',
        description: 'Rising damp on the ground-floor wall.', status: 'COMPLETED', isBillable: false,
        priority: 'HIGH', scheduledStart: days(-1), actualStart: days(-1), actualEnd: days(-1),
        completionNote: 'Site survey submitted',
        assignments: { create: { technicianId: surveyor.id, isLead: true } },
      },
    });

    // Submitted and waiting in the admin inbox — quantities only, no price anywhere.
    const survey = await prisma.siteSurvey.create({
      data: {
        number: `SRV-${fy}-0001`, jobId: visit.id, leadId: bookedLead.id,
        customerId: bookedCustomer.id, siteId: bookedSite.id, serviceId: seepage?.id,
        surveyorId: surveyor.id, status: 'SUBMITTED',
        problemSummary: 'भुइँतलाको भित्तामा चिस्यान बढ्दै गएको छ।',
        diagnosis: 'Rising damp from a failed DPC on the north wall; no external plinth protection.',
        recommendation: 'Crystalline treatment on the internal face, then replaster with a waterproof admixture.',
        accessNotes: 'Narrow stair, no lift. Water point available in the courtyard.',
        riskNotes: 'Old wiring runs along the affected skirting — isolate before chipping.',
        areaValue: 240, areaUnit: 'sq.ft', estimatedDays: 3, urgency: 'HIGH',
        submittedAt: days(-1), submittedById: users.SURVEYOR.id,
        readings: {
          create: [
            { label: 'North wall, 300mm above floor', metric: 'moisture', value: 22.4, unit: '%', sortOrder: 0 },
            { label: 'North wall, 1200mm above floor', metric: 'moisture', value: 9.1, unit: '%', sortOrder: 1 },
            { label: 'Damp band height', metric: 'depth', value: 900, unit: 'mm', sortOrder: 2 },
            { label: 'DPC present?', metric: 'observation', textValue: 'None visible at plinth level', sortOrder: 3 },
          ],
        },
        items: {
          create: [
            { kind: 'SERVICE', rateCardItemId: seepChem?.id, description: 'Crystalline seepage treatment — internal face', unit: 'sq.ft', qty: 240, sortOrder: 0 },
            { kind: 'MATERIAL', materialId: wpCryst?.id, description: 'Crystalline waterproofing compound', unit: 'kg', qty: 30, wastagePct: 10, sortOrder: 1 },
            { kind: 'LABOUR', rateCardItemId: labourSkill?.id, description: 'Skilled applicator — chipping, treatment, plaster', unit: 'hour', qty: 36, sortOrder: 2 },
            { kind: 'OTHER', description: 'Temporary furniture shifting and covering', unit: 'lump', qty: 1, isOptional: true, note: 'Only if the customer cannot clear the room', sortOrder: 3 },
          ],
        },
      },
    });

    // The finished job from the demo pipeline, published as public proof.
    if (completed && !(await prisma.project.findUnique({ where: { jobId: completed.id } }))) {
      await prisma.project.create({
        data: {
          title: 'Bedroom wall seepage — Jhamsikhel',
          slug: 'bedroom-wall-seepage-jhamsikhel',
          jobId: completed.id, serviceId: seepage?.id, categoryId: seepage?.categoryId ?? null,
          location: 'Jhamsikhel', status: 'completed',
          problem: 'Damp patch spreading across a bedroom wall after the monsoon, with paint blistering at skirting level.',
          solution: 'Traced the source to a failed outlet on the adjoining terrace, applied crystalline treatment over 320 sq.ft and replastered.',
          outcome: 'Ponding test passed on the adjoining terrace. Dry through the following monsoon.',
          summary: 'Damp traced to a failed neighbouring terrace outlet.',
          durationDays: 3,
          // A band, not the customer's contract value.
          costBandMin: toPaisa(88000), costBandMax: toPaisa(132000),
          completedAt: days(-4), publishedAt: days(-3), isActive: true, isFeatured: true, sortOrder: 0,
        },
      });
    }

    console.log(`  survey demo: ${visit.number} surveyed by ${surveyor.employeeCode}, ${survey.number} waiting to be priced, 1 case study published`);
  }

  // ═══ quotation approval demo (Phase F): one quotation at each step of the office →
  //     customer loop. Guarded on its own marker customer, so it tops up an older database.

  if (!(await prisma.customer.findFirst({ where: { phone: '9841500001' } }))) {
    const seepChem = await prisma.rateCardItem.findUnique({ where: { code: 'SEEP-CHEM' } });
    const labourSkill = await prisma.rateCardItem.findUnique({ where: { code: 'LABOUR-SKILL' } });
    const line = (item, fallback, qty, sortOrder) => ({
      rateCardItemId: item?.id ?? null,
      description: item?.name ?? fallback.description,
      unit: item?.unit ?? fallback.unit,
      qty,
      rate: item?.rate ?? fallback.rate,
      sortOrder,
    });
    const lines = (area) => [
      line(seepChem, { description: 'Chemical seepage treatment', unit: 'sq.ft', rate: toPaisa(220) }, area, 0),
      line(labourSkill, { description: 'Skilled applicator', unit: 'hour', rate: toPaisa(450) }, Math.ceil(area / 10), 1),
    ];

    const DEMO = [
      {
        status: 'DRAFT', leadStatus: 'CONTACTED', area: 180,
        customer: { name: 'Anjali Karki', phone: '9841500001', address: 'Baneshwor, Kathmandu', area: 'Baneshwor' },
        extra: { sentBackReason: 'Use the monsoon rate for the membrane and add scaffolding.' },
      },
      {
        status: 'PENDING_APPROVAL', leadStatus: 'CONTACTED', area: 260,
        customer: { name: 'Bikash Rai', phone: '9841500002', address: 'Dhapasi, Kathmandu', area: 'Dhapasi' },
        extra: { submittedAt: days(0), submittedById: users.SALES.id },
      },
      {
        status: 'OFFICE_APPROVED', leadStatus: 'CONTACTED', area: 150,
        customer: { name: 'Nirmala Tamang', phone: '9841500003', address: 'Kalanki, Kathmandu', area: 'Kalanki' },
        extra: {
          submittedAt: days(-1), submittedById: users.SALES.id,
          approvedById: users.MANAGER.id, approvedAt: days(0), approvalNote: 'Rates match the rate card.',
        },
      },
      {
        status: 'SENT', leadStatus: 'QUOTED', area: 320,
        customer: { name: 'Hari Prasad Adhikari', phone: '9841500004', address: 'Lazimpat, Kathmandu', area: 'Lazimpat', email: 'hari.adhikari@example.com' },
        extra: {
          submittedAt: days(-3), submittedById: users.SALES.id, approvedById: users.MANAGER.id, approvedAt: days(-3),
          sentAt: days(-2), publicToken: token(),
        },
      },
      {
        status: 'CHANGES_REQUESTED', leadStatus: 'QUOTED', area: 400, locale: 'ne',
        customer: { name: 'सीता गुरुङ', phone: '9841500005', address: 'Budhanilkantha, Kathmandu', area: 'Budhanilkantha' },
        extra: {
          submittedAt: days(-5), submittedById: users.SALES.id, approvedById: users.MANAGER.id, approvedAt: days(-5),
          sentAt: days(-4), publicToken: token(), decidedAt: days(-1), decidedIp: '127.0.0.1',
          decisionNote: 'कृपया बार्दलीको भित्ता पनि थप्नुहोस् र श्रमको घण्टा घटाउन मिल्छ कि हेर्नुहोस्।',
        },
      },
    ];

    const vatRate = 13;
    for (const d of DEMO) {
      const customer = await prisma.customer.create({
        data: {
          name: d.customer.name, phone: d.customer.phone, email: d.customer.email ?? null,
          preferredLocale: d.locale ?? 'en',
          sites: { create: { label: 'Home', address: d.customer.address, area: d.customer.area, isPrimary: true } },
        },
        include: { sites: true },
      });
      const lead = await prisma.lead.create({
        data: {
          name: d.customer.name, phone: d.customer.phone, email: d.customer.email ?? null,
          address: d.customer.address, area: d.customer.area, serviceId: services['seepage-and-damp-treatment']?.id,
          source: 'call', status: d.leadStatus, assignedToId: users.SALES.id, customerId: customer.id,
          preferredLocale: d.locale ?? 'en', firstResponseAt: days(-6), createdAt: days(-6), slaDueAt: days(-6),
        },
      });
      const totals = documentTotals(lines(d.area), { vatApplied: true, vatRate });
      const number = await prisma.$transaction((tx) => nextNumber(tx, 'QT'));
      await prisma.quotation.create({
        data: {
          number, status: d.status, customerId: customer.id, siteId: customer.sites[0].id, leadId: lead.id,
          validUntil: days(14), subtotal: totals.subtotal, discount: totals.discount, vatApplied: true, vatRate,
          vatAmount: totals.vatAmount, total: totals.total, createdById: users.SALES.id,
          ...d.extra,
          items: { create: totals.lines },
        },
      });
    }
    console.log(`  quotation approval demo: ${DEMO.map((d) => d.status).join(', ')}`);
  }

  // ═══ follow-through demo (Phase L1): a lead in every state the leads list, the board and the
  //     lost report show — due today, overdue, nothing booked, a quote gone quiet, and losses.
  //     Guarded on its own marker lead, so it tops up an older database.

  if (!(await prisma.lead.findFirst({ where: { phone: '9841600001' } }))) {
    const seepage = services['seepage-and-damp-treatment'];
    const hours = (n) => new Date(Date.now() + n * 3600_000);
    const base = { source: 'call', assignedToId: users.SALES.id, serviceId: seepage?.id ?? null, slaDueAt: days(-6), firstResponseAt: days(-6) };
    const FOLLOW = [
      {
        name: 'Suman Thapa', phone: '9841600001', area: 'Kirtipur', status: 'CONTACTED', createdAt: days(-2), stageEnteredAt: days(-2),
        contactAttempts: 2, nextActionAt: hours(3), nextActionType: 'CALL', nextActionNote: 'Asked us to call after 2 pm — decides with his brother',
        qualification: { propertyType: 'house', floors: 3, buildingAgeYears: 22, budgetBand: '1l_5l', decisionMaker: 'family' },
        activity: { outcome: 'call_back', summary: 'Interested; call back this afternoon once his brother is home' },
      },
      {
        name: 'Pramila Shakya', phone: '9841600002', area: 'Patan', status: 'CONTACTED', createdAt: days(-6), stageEnteredAt: days(-5),
        contactAttempts: 1, nextActionAt: days(-2), nextActionType: 'FOLLOW_UP', nextActionNote: 'Comparing three companies on price',
        qualification: { propertyType: 'apartment', budgetBand: 'under_25k', decisionMaker: 'self' },
        activity: { outcome: 'price_shopping', summary: 'Getting three quotes; wants a price per sq.ft over the phone' },
      },
      {
        name: 'Deepak Maharjan', phone: '9841600003', area: 'Bhaktapur', status: 'CONTACTED', createdAt: days(-3), stageEnteredAt: days(-3),
        contactAttempts: 1, activity: { outcome: null, summary: 'Spoke briefly, will think about it' },
      },
    ];
    for (const { activity, ...d } of FOLLOW) {
      const lead = await prisma.lead.create({ data: { ...base, ...d } });
      await prisma.leadActivity.create({
        data: { leadId: lead.id, userId: users.SALES.id, type: 'call', summary: activity.summary, outcome: activity.outcome, createdAt: d.stageEnteredAt },
      });
    }

    // Sent five days ago and not answered — the stale sweep reminds its owner.
    const quiet = await prisma.customer.create({
      data: {
        name: 'Rajendra Basnet', phone: '9841600004', preferredLocale: 'en',
        sites: { create: { label: 'Home', address: 'Tokha, Kathmandu', area: 'Tokha', isPrimary: true } },
      },
      include: { sites: true },
    });
    const quietLead = await prisma.lead.create({
      data: {
        ...base, name: quiet.name, phone: quiet.phone, area: 'Tokha', status: 'QUOTED', customerId: quiet.id, createdAt: days(-9),
        stageEnteredAt: days(-5), contactAttempts: 3, nextActionAt: days(-2), nextActionType: 'FOLLOW_UP',
      },
    });
    const totals = documentTotals([{ description: 'Terrace membrane waterproofing', unit: 'sq.ft', qty: 480, rate: toPaisa(275), sortOrder: 0 }], { vatApplied: true, vatRate: 13 });
    await prisma.quotation.create({
      data: {
        number: await prisma.$transaction((tx) => nextNumber(tx, 'QT')), status: 'SENT', customerId: quiet.id, siteId: quiet.sites[0].id,
        leadId: quietLead.id, validUntil: days(10), subtotal: totals.subtotal, discount: totals.discount, vatApplied: true, vatRate: 13,
        vatAmount: totals.vatAmount, total: totals.total, createdById: users.SALES.id, submittedAt: days(-6), submittedById: users.SALES.id,
        approvedById: users.MANAGER.id, approvedAt: days(-6), sentAt: days(-5), publicToken: token(),
        items: { create: totals.lines },
      },
    });

    // Losses at different stages, so the lost report has something to say.
    const LOST = [
      { name: 'Kamal Joshi', phone: '9841600005', lostCategory: 'PRICE', lostAtStage: 'QUOTED', lostReason: 'Our quote was 30% over what he expected', closedAt: days(-3) },
      { name: 'Sarita Poudel', phone: '9841600006', lostCategory: 'COMPETITOR', lostAtStage: 'QUOTED', lostReason: 'Went with the company her neighbour used', closedAt: days(-6) },
      { name: 'Binod Tamang', phone: '9841600007', lostCategory: 'OWN_LABOUR', lostAtStage: 'CONTACTED', lostReason: 'His own mistri will do the plaster', closedAt: days(-8) },
      { name: 'Asha Rana', phone: '9841600008', lostCategory: 'OUT_OF_AREA', lostAtStage: 'NEW', lostReason: 'Site is in Pokhara', closedAt: days(-1) },
    ];
    for (const d of LOST) {
      await prisma.lead.create({ data: { ...base, ...d, status: 'LOST', createdAt: days(-12), stageEnteredAt: d.closedAt } });
    }
    console.log(`  follow-through demo: ${FOLLOW.length} leads to work, 1 quiet quotation, ${LOST.length} lost leads`);
  }

  // ═══ BOQ demo (Phase L3): one quotation as a real bill of quantities — three sections, measured rows,
  //     a NOTE, an optional row and rows priced from the rate library with their recipes frozen — so the
  //     builder, the take-off and the labour tab have something to show. Built through the same service
  //     as the screens. Guarded on its own marker customer.

  if (!(await prisma.customer.findFirst({ where: { phone: '9841700001' } }))) {
    const { createQuotation } = await import('../src/services/quotation.service.js');
    const card = async (code) => prisma.rateCardItem.findUnique({ where: { code } });
    const [plaster, paint, damp, tiles] = await Promise.all(['PLASTER-INT', 'PAINT-INT', 'SEEP-CHEM', 'TILE-FLOOR'].map(card));
    const cement = await prisma.material.findUnique({ where: { code: 'CEM-OPC' } });
    const rupees = (paisa) => paisa / 100;
    const boqCustomer = await prisma.customer.create({
      data: {
        name: 'Prakash Joshi', phone: '9841700001', preferredLocale: 'en',
        sites: { create: { label: 'Home', address: 'Bhaisepati, Lalitpur', area: 'Bhaisepati', isPrimary: true } },
      },
      include: { sites: true },
    });
    const q = await createQuotation({
      customerId: boqCustomer.id,
      siteId: boqCustomer.sites[0].id,
      internalNote: 'Demo BOQ (Phase L3): ground-floor bedroom and kitchen after a seepage repair.',
      items: [
        { rowType: 'SECTION', description: 'Damp treatment' },
        {
          rateCardItemId: damp.id, kind: 'SERVICE', description: damp.name, unit: damp.unit, rate: rupees(damp.rate),
          spec: 'Chip loose plaster to 1 m height, apply crystalline slurry in two coats, cure 72 hours.',
          measurements: [
            { area: 'Bedroom', description: 'North and west walls to 1 m', nos: 2, l: 12, h: 3.28 },
            { area: 'Kitchen', description: 'Back wall to 1 m', l: 10, h: 3.28 },
          ],
        },
        { rowType: 'NOTE', description: 'Walls must dry for 7 days before plaster and paint.' },
        { rowType: 'SECTION', description: 'Plaster and paint' },
        {
          rateCardItemId: plaster.id, kind: 'SERVICE', description: plaster.name, unit: plaster.unit, rate: rupees(plaster.rate),
          measurements: [
            { area: 'Bedroom', description: 'Walls', nos: 2, l: 12, h: 9 },
            { area: 'Bedroom', description: 'Door', l: 3, h: 7, deduct: true },
          ],
        },
        { rateCardItemId: paint.id, kind: 'SERVICE', description: paint.name, unit: paint.unit, rate: rupees(paint.rate), qty: 820 },
        { rowType: 'SECTION', description: 'Flooring' },
        { rateCardItemId: tiles.id, kind: 'SERVICE', description: tiles.name, unit: tiles.unit, rate: rupees(tiles.rate), qty: 180, isOptional: true },
        { kind: 'MATERIAL', materialId: cement.id, description: cement.name, unit: cement.unit, qty: 6, wastagePct: 5, rate: rupees(cement.sellRate) },
      ],
    }, users.SALES.id);
    console.log(`  BOQ demo: ${q.number} — ${q.items.length} rows in ${q.boq.sections.length} sections`);
  }

  // ═══ Phase L4: the terms library, the BOQ demo's contract, and a quotation below the minimum margin
  //     waiting for approval — so the gate shows. Each part tops up an older database.

  if (!(await prisma.quotationTerms.count())) {
    const standard = D.SETTINGS.find((st) => st.key === 'finance.quotationTerms')?.value ?? '';
    await prisma.quotationTerms.createMany({
      data: [
        {
          title: 'Standard terms', body: standard, isDefault: true, sortOrder: 0,
          bodyNe: '१. यो दरभाउ जारी मितिदेखि १५ दिनसम्म मान्य हुनेछ।\n२. काम सुरु गर्नुअघि ५०% अग्रिम भुक्तानी आवश्यक छ।\n'
            + '३. उल्लेख नभएसम्म दरमा भ्याट समावेश छैन।\n४. कामको एक महिनाको वारेन्टी हुनेछ।',
        },
        {
          title: 'Waterproofing — extended warranty', sortOrder: 1,
          body: 'Waterproofing carries a 3-year warranty against seepage through the treated area, provided the surface is not '
            + 'drilled or re-plastered by others. The warranty does not cover structural cracks that open after the work.',
        },
      ],
    });
    console.log('  terms library: 2 (the standard one is the default)');
  }

  const boqDemo = await prisma.quotation.findFirst({
    where: { customer: { phone: '9841700001' }, deletedAt: null }, include: { stages: true },
  });
  // Keyed on the duration, so a fresh database (where the demo was just made with the default schedule) and
  // an older one end up the same.
  if (boqDemo && boqDemo.estimatedDays == null) {
    const standard = await prisma.quotationTerms.findFirst({ where: { isDefault: true } });
    await prisma.quotation.update({
      where: { id: boqDemo.id },
      data: {
        estimatedDays: 6,
        exclusions: 'Water and electricity during the work are the owner\'s. Moving heavy furniture is not included.',
        terms: standard?.body ?? boqDemo.terms ?? null,
        stages: {
          deleteMany: {},
          create: [
            { label: 'Advance', basisPoints: 5000, trigger: 'ON_ACCEPT', sortOrder: 0 },
            { label: 'Plaster done', basisPoints: 4000, trigger: 'MILESTONE', sortOrder: 1 },
            { label: 'On completion', basisPoints: 1000, trigger: 'ON_COMPLETION', sortOrder: 2 },
          ],
        },
      },
    });
    console.log(`  BOQ demo contract: ${boqDemo.number} — 50/40/10, 6 days`);
  }

  if (!(await prisma.customer.findFirst({ where: { phone: '9841700002' } }))) {
    const { createQuotation } = await import('../src/services/quotation.service.js');
    const crystalline = await prisma.material.findUnique({ where: { code: 'WP-CRYST' } });
    const lowCustomer = await prisma.customer.create({
      data: {
        name: 'Sunil Maharjan', phone: '9841700002', preferredLocale: 'ne',
        sites: { create: { label: 'Home', address: 'Kirtipur, Kathmandu', area: 'Kirtipur', isPrimary: true } },
      },
      include: { sites: true },
    });
    // Sold at Rs 480 against a purchase rate of Rs 450: a 6% margin, under the 15% minimum.
    const low = await createQuotation({
      customerId: lowCustomer.id,
      siteId: lowCustomer.sites[0].id,
      internalNote: 'Demo (Phase L4): priced under the minimum margin — approving it asks for the acknowledgement.',
      items: [
        { rowType: 'SECTION', description: 'Damp treatment' },
        { kind: 'MATERIAL', materialId: crystalline.id, description: crystalline.name, unit: crystalline.unit, qty: 40, rate: 480 },
      ],
    }, users.SALES.id);
    await prisma.quotation.update({
      where: { id: low.id }, data: { status: 'PENDING_APPROVAL', submittedAt: new Date(), submittedById: users.SALES.id },
    });
    console.log(`  low-margin demo: ${low.number} waiting for approval`);
  }

  console.log('\nSeed complete.');
  console.log('  Admin login:      admin@gharjatan.com.np / Password123');
  console.log('  Manager login:    manager@gharjatan.com.np / Password123');
  console.log('  Technician login: hari@gharjatan.com.np / Password123');
  console.log('  Surveyor login:   survey@gharjatan.com.np / Password123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
