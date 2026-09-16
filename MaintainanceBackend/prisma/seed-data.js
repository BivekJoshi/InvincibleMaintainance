/** Content lifted from the studied site, restructured as editable data. */

export const SETTINGS = [
  { group: 'contact', key: 'contact.companyName', label: 'Company name', type: 'string', value: 'Ghar Jatan', sortOrder: 0 },
  { group: 'contact', key: 'contact.phonePrimary', label: 'Primary phone', type: 'string', value: '01-5407720', sortOrder: 1 },
  { group: 'contact', key: 'contact.phoneSecondary', label: 'Mobile', type: 'string', value: '9808338255', sortOrder: 2 },
  { group: 'contact', key: 'contact.onCallPhone', label: 'On-call number (new lead SMS)', type: 'string', value: '9808338255', sortOrder: 3 },
  { group: 'contact', key: 'contact.email', label: 'Email', type: 'string', value: 'support@gharjatan.com.np', sortOrder: 4 },
  { group: 'contact', key: 'contact.salesEmail', label: 'Sales inbox (new lead email)', type: 'string', value: 'support@gharjatan.com.np', sortOrder: 5 },
  { group: 'contact', key: 'contact.address', label: 'Address', type: 'string', value: 'Bhanimandal, Ekantakuna, Lalitpur', sortOrder: 6 },
  { group: 'contact', key: 'contact.city', label: 'City', type: 'string', value: 'Lalitpur', sortOrder: 7 },
  { group: 'contact', key: 'contact.mapEmbed', label: 'Google Maps embed URL', type: 'string', value: '', sortOrder: 8 },
  { group: 'contact', key: 'contact.viber', label: 'Viber number', type: 'string', value: '9808338255', sortOrder: 9 },
  { group: 'contact', key: 'contact.whatsapp', label: 'WhatsApp number', type: 'string', value: '9808338255', sortOrder: 10 },

  { group: 'social', key: 'social.facebook', label: 'Facebook URL', type: 'string', value: '', sortOrder: 0 },
  { group: 'social', key: 'social.instagram', label: 'Instagram URL', type: 'string', value: '', sortOrder: 1 },
  { group: 'social', key: 'social.tiktok', label: 'TikTok URL', type: 'string', value: '', sortOrder: 2 },
  { group: 'social', key: 'social.youtube', label: 'YouTube URL', type: 'string', value: '', sortOrder: 3 },

  {
    group: 'branding', key: 'badges.items', label: 'Hero trust badges', type: 'json', sortOrder: 0,
    value: [
      { icon: 'gift', label: 'Free Consultation' },
      { icon: 'clock', label: '2 Hour Response' },
      { icon: 'shield', label: '100% Secure' },
    ],
  },
  {
    group: 'branding', key: 'stats.items', label: 'Counter statistics', type: 'json', sortOrder: 1,
    value: [
      { value: '2.5k+', label: 'Satisfied Clients' },
      { value: '500+', label: 'Major Projects' },
      { value: '2 hr', label: 'Response Time' },
      { value: '1 month', label: 'Warranty' },
    ],
  },
  { group: 'branding', key: 'branding.tagline', label: 'Tagline', type: 'string', value: 'Certified engineers. Transparent pricing. Two-hour response.', sortOrder: 2 },
  { group: 'branding', key: 'branding.logoId', label: 'Logo', type: 'media', value: '', sortOrder: 3 },

  { group: 'seo', key: 'seo.defaultTitle', label: 'Default meta title', type: 'string', value: 'Home Construction, Repair & Interior Services in Kathmandu', sortOrder: 0 },
  { group: 'seo', key: 'seo.defaultDescription', label: 'Default meta description', type: 'string', value: 'Certified engineers for seepage repair, waterproofing, renovation, modular kitchens and interior design across Kathmandu and Lalitpur. Free consultation, 2-hour response, 1-month warranty.', sortOrder: 1 },
  { group: 'seo', key: 'seo.gaMeasurementId', label: 'GA4 measurement ID', type: 'string', value: '', sortOrder: 2 },
  { group: 'seo', key: 'seo.metaPixelId', label: 'Meta Pixel ID', type: 'string', value: '', sortOrder: 3 },

  { group: 'sla', key: 'sla.leadResponseMinutes', label: 'Lead response SLA (minutes)', type: 'number', value: 120, hint: 'The site publicly promises a 2-hour response.', sortOrder: 0 },
  { group: 'sla', key: 'sla.warnBeforeMinutes', label: 'Warn this many minutes before breach', type: 'number', value: 30, sortOrder: 1 },
  { group: 'sla', key: 'sla.autoAssign', label: 'Auto-assign new leads round-robin', type: 'boolean', value: true, sortOrder: 2 },

  { group: 'finance', key: 'finance.vatRate', label: 'VAT rate (%)', type: 'number', value: 13, sortOrder: 0 },
  { group: 'finance', key: 'finance.paymentTermDays', label: 'Default payment term (days)', type: 'number', value: 15, sortOrder: 1 },
  { group: 'finance', key: 'finance.panVatNo', label: 'Company PAN/VAT number', type: 'string', value: '', sortOrder: 2 },
  { group: 'finance', key: 'finance.quotationTerms', label: 'Default quotation terms', type: 'richtext', sortOrder: 3,
    value: '1. Prices are valid for 15 days from the date of this quotation.\n2. 50% advance is required before work begins.\n3. Rates exclude VAT unless stated.\n4. Workmanship carries a 1-month warranty.' },
  { group: 'finance', key: 'quotation.makerChecker', label: 'A different person approves each quotation', type: 'boolean', value: true, sortOrder: 5,
    hint: 'When on, whoever prepared a quotation cannot approve it; another manager or admin must.' },
  { group: 'finance', key: 'quotation.autoApproveBelow', label: 'Approve quotations automatically below (paisa)', type: 'number', value: 0, sortOrder: 6,
    hint: 'In paisa (NPR × 100): 500000 means NPR 5,000. Quotations whose total is below it skip manager approval, revisions included. 0 turns this off.' },
  { group: 'finance', key: 'finance.invoiceTerms', label: 'Default invoice terms', type: 'richtext', sortOrder: 4,
    value: 'Payment is due within 15 days. Please quote the invoice number with your transfer.' },

  { group: 'booking', key: 'booking.closedWeekdays', label: 'Closed weekdays (0 = Sunday … 6 = Saturday)', type: 'json', value: [6], hint: 'Days the online booking calendar will not offer.', sortOrder: 0 },
  { group: 'booking', key: 'booking.maxDaysAhead', label: 'Book up to this many days ahead', type: 'number', value: 30, sortOrder: 1 },
  { group: 'booking', key: 'booking.slotCapacity', label: 'Visits per slot', type: 'number', value: null, hint: 'Leave empty to derive it from the surveyors\' daily capacity.', sortOrder: 2 },
  { group: 'booking', key: 'booking.leadTimeHours', label: 'Minimum notice before a visit (hours)', type: 'number', value: 4, sortOrder: 3 },

  { group: 'warranty', key: 'warranty.defaultDays', label: 'Default warranty (days)', type: 'number', value: 30, hint: 'The site promises a 1-month warranty on technical solutions.', sortOrder: 0 },
];

export const SERVICE_CATEGORIES = [
  { name: 'Repair & Maintenance', slug: 'repair-maintenance', icon: 'wrench', sortOrder: 0 },
  { name: 'Construction', slug: 'construction', icon: 'hard-hat', sortOrder: 1 },
  { name: 'Interior', slug: 'interior', icon: 'sofa', sortOrder: 2 },
  { name: 'Waterproofing', slug: 'waterproofing', icon: 'droplets', sortOrder: 3 },
];

/**
 * Unique copy per service — the original site shipped nine near-identical
 * "Professional {service} with expert tools and results." lines, which the
 * schema now rejects.
 */
export const SERVICES = [
  {
    category: 'waterproofing', name: 'Seepage & Damp Treatment', icon: 'droplets',
    excerpt: 'We trace damp back to its source with moisture meters before touching a wall, then seal it so the stain does not return next monsoon.',
    body: 'Rising damp, lateral seepage and roof leakage all look identical on a painted wall and need completely different repairs. Our engineers survey with moisture meters and thermal readings, identify the actual water path, and treat the cause — not the stain. Every treatment is documented with before and after photographs.',
    priceFrom: 120, priceTo: 350, priceUnit: 'sq.ft', isFeatured: true, sortOrder: 0,
    metaTitle: 'Seepage & Damp Repair in Kathmandu | Certified Engineers',
    metaDescription: 'Permanent seepage and damp treatment in Kathmandu and Lalitpur. Free inspection with moisture meters, transparent per-sq.ft pricing, 1-month warranty.',
  },
  {
    category: 'waterproofing', name: 'Roof & Terrace Waterproofing', icon: 'umbrella',
    excerpt: 'Full terrace membrane systems with proper slope correction and drainage, designed to survive a Kathmandu monsoon rather than one shower.',
    body: 'Most terrace leaks are drainage failures, not membrane failures. We correct ponding slopes, rebuild the outlet detail, then apply a suitable membrane — APP, acrylic or PU depending on the exposure and traffic.',
    priceFrom: 150, priceTo: 400, priceUnit: 'sq.ft', isFeatured: true, sortOrder: 1,
  },
  {
    category: 'repair-maintenance', name: 'Crack Repair & Structural Patching', icon: 'zap',
    excerpt: 'Structural cracks get stitched and grouted; cosmetic cracks get filled. We tell you honestly which one you have.',
    body: 'A crack that widens along a diagonal is a structural signal and needs an engineer, not a painter. We assess crack width, direction and movement, then specify either epoxy injection with stitching, or a straightforward polymer fill.',
    priceFrom: 80, priceTo: 250, priceUnit: 'rft', sortOrder: 2,
  },
  {
    category: 'repair-maintenance', name: 'Plumbing Repair & Installation', icon: 'wrench',
    excerpt: 'Concealed leak detection, tank and pump work, CPVC re-piping — with the wall opened only where the leak actually is.',
    body: 'We locate concealed leaks acoustically before breaking any tile, which keeps the repair small and the restoration cheap.',
    priceFrom: 1500, priceTo: 8000, priceUnit: 'lump', sortOrder: 3,
  },
  {
    category: 'repair-maintenance', name: 'Electrical Repair & Rewiring', icon: 'plug',
    excerpt: 'Licensed electricians for load audits, DB upgrades, earthing and full rewiring, with a certificate you can show an insurer.',
    body: 'Old aluminium wiring and undersized DBs cause most household electrical faults in Kathmandu. We audit the load, test earthing resistance, and rewire to a documented layout.',
    priceFrom: 2000, priceTo: 25000, priceUnit: 'lump', sortOrder: 4,
  },
  {
    category: 'interior', name: 'Modular Kitchen Design & Fitting', icon: 'chef-hat',
    excerpt: 'Kitchens planned around how you actually cook — work triangle first, then finishes, with hardware you can service locally.',
    body: 'We plan the work triangle, ventilation and storage before choosing a single finish, and specify hardware that has spare parts available in Nepal.',
    priceFrom: 1200, priceTo: 3500, priceUnit: 'sq.ft', isFeatured: true, sortOrder: 5,
  },
  {
    category: 'interior', name: 'Interior Design & Furnishing', icon: 'sofa',
    excerpt: 'Full interior packages from layout drawings to final styling, quoted line by line so you can see exactly where the money goes.',
    body: 'Every interior quote is itemised by room and by trade. You approve the drawing and the rate card before we order anything.',
    priceFrom: 800, priceTo: 2500, priceUnit: 'sq.ft', sortOrder: 6,
  },
  {
    category: 'construction', name: 'House Renovation & Remodelling', icon: 'home',
    excerpt: 'Structural, plumbing and electrical upgrades handled as one sequenced project instead of five contractors blaming each other.',
    body: 'Renovation goes wrong when trades are booked independently. We hold a single sequenced programme, so demolition, structure, services and finishing follow in the right order.',
    priceFrom: 900, priceTo: 2800, priceUnit: 'sq.ft', isFeatured: true, sortOrder: 7,
  },
  {
    category: 'construction', name: 'Pre-Engineered Steel Buildings', icon: 'factory',
    excerpt: 'Designed, fabricated and erected steel structures for warehouses, showrooms and rooftop extensions, with stamped drawings.',
    body: 'Pre-engineered steel goes up in a fraction of the time of RCC and can be extended later. We supply the structural design, fabrication and erection under one scope.',
    priceFrom: 1800, priceTo: 4200, priceUnit: 'sq.ft', sortOrder: 8,
  },
];

/** "Other civil work" — the nine plain links at the bottom of the original page. */
export const OTHER_CIVIL = [
  'Plastering & Wall Finishing', 'Tile & Marble Laying', 'Painting & Texture Work',
  'False Ceiling Installation', 'Aluminium & uPVC Windows', 'Grill & Railing Fabrication',
  'Boundary Wall & Gate Work', 'Septic Tank & Drainage', 'Demolition & Debris Removal',
].map((name, i) => ({
  category: 'construction', name, type: 'other_civil', sortOrder: i,
  excerpt: `${name} carried out by our own trained crews, measured and billed against a published rate so there is no surprise at the end.`,
}));

export const FEATURES = [
  { group: 'why_choose', icon: 'clock', title: '2 Hour Response', description: 'Call before 5pm and an engineer is at your door within two hours. Every enquiry is timed and tracked; if we are running late, you hear it from us first.', sortOrder: 0 },
  { group: 'why_choose', icon: 'gift', title: 'Free Consultation', description: 'Inspection, diagnosis and a written estimate cost nothing. There is no visiting charge, whether or not you go ahead.', sortOrder: 1 },
  { group: 'why_choose', icon: 'shield-check', title: '1 Month Warranty', description: 'Every technical solution carries a written one-month warranty. You receive a certificate with a claim link; a valid claim is fixed free.', sortOrder: 2 },
  { group: 'why_choose', icon: 'badge-check', title: 'Certified Engineers', description: 'Licensed civil and electrical engineers, using moisture meters and thermal cameras rather than guesswork.', sortOrder: 3 },

  { group: 'construction', icon: 'ruler', title: 'Stamped Structural Drawings', description: 'Every structural change is drawn and stamped before work starts.', sortOrder: 0 },
  { group: 'construction', icon: 'file-check', title: 'Municipality Coordination', description: 'We prepare and follow up the ward and municipality paperwork on your behalf.', sortOrder: 1 },
  { group: 'construction', icon: 'calendar-check', title: 'Sequenced Programme', description: 'One programme covering all trades, so nobody waits on anyone else.', sortOrder: 2 },
  { group: 'construction', icon: 'receipt', title: 'Line-Item Billing', description: 'Progress bills itemised against the approved rate card, never a lump sum.', sortOrder: 3 },
  { group: 'construction', icon: 'test-tube', title: 'Material Testing', description: 'Cube tests and steel certificates on file for every structural pour.', sortOrder: 4 },
  { group: 'construction', icon: 'hard-hat', title: 'Site Safety', description: 'Scaffolding, edge protection and PPE as standard, not as an extra.', sortOrder: 5 },

  { group: 'pre_engineered', icon: 'timer', title: 'PROPER SPEED', description: 'Fabrication runs in the shop while foundations cure on site — typically half the programme of an equivalent RCC frame.', sortOrder: 0 },
  { group: 'pre_engineered', icon: 'coins', title: 'PROPER COST', description: 'Steel tonnage is calculated from the design, so the quantity is known before you commit and cannot drift upward.', sortOrder: 1 },
  { group: 'pre_engineered', icon: 'expand', title: 'PROPER SPAN', description: 'Clear spans up to 30m with no intermediate columns, which is what makes a warehouse or showroom usable.', sortOrder: 2 },
  { group: 'pre_engineered', icon: 'recycle', title: 'PROPER REUSE', description: 'Bolted connections mean the structure can be extended, reconfigured or relocated later.', sortOrder: 3 },

  { group: 'kitchen', icon: 'chef-hat', title: 'Modular Base & Wall Units', description: 'Marine ply carcasses with soft-close hardware, sized to your appliances rather than a catalogue.', sortOrder: 0 },
  { group: 'kitchen', icon: 'flame', title: 'Chimney & Ventilation', description: 'Correctly sized extraction with a real duct run, not a recirculating filter over a gas hob.', sortOrder: 1 },
  { group: 'kitchen', icon: 'layout-grid', title: 'Counter & Splashback', description: 'Granite, quartz or solid surface with a properly sealed sink cut-out.', sortOrder: 2 },
];

export const LIST_ITEMS = [
  ...['Water stains spreading on interior walls after rain',
      'Paint bubbling, flaking or powdering near the skirting',
      'A musty smell that returns every monsoon',
      'Efflorescence — white salt deposits on plaster',
      'Cracks that widen along a diagonal line',
      'Damp patches on the ceiling directly below a terrace',
  ].map((text, i) => ({ group: 'seepage_checkpoints', position: i + 1, text })),

  ...['The layout no longer suits how the family actually lives',
      'Plumbing or wiring has reached the end of its service life',
      'Damp and seepage keep returning despite repainting',
      'An extra room or floor is needed rather than a new house',
      'Resale or rental value has fallen behind the neighbourhood',
      'Energy and water bills are higher than they should be',
      'The building needs seismic strengthening after 2015',
  ].map((text, i) => ({ group: 'renovation_reasons', position: i + 1, text })),

  ...['Measure the existing kitchen and record every service point',
      'Agree the work triangle — sink, hob and refrigerator',
      'Plan ventilation and the chimney duct route',
      'Select carcass material, finish and hardware',
      'Confirm counter material and sink cut-out details',
      'Approve the 3D layout and the itemised quotation',
      'Fabricate off site while the existing kitchen stays usable',
      'Install, test every drawer and hinge, and hand over',
  ].map((text, i) => ({ group: 'kitchen_steps', position: i + 1, text })),
];

export const CONTENT_BLOCKS = [
  {
    key: 'seepage_explainer',
    heading: 'Seepage and cracks are symptoms. We find the cause.',
    subheading: 'Repainting a damp wall hides the problem for one season. Tracing the water path fixes it.',
    body: 'Damp reaches a wall by rising through the foundation, moving laterally from an adjoining surface, or falling from a failed roof detail. On a painted wall these three look identical, which is why so many repairs fail within a year. Our engineers survey with moisture meters and thermal readings before quoting anything, so the treatment matches the actual defect.',
    cta: { label: 'Book a free inspection', url: '/contact' },
    sortOrder: 0,
  },
  {
    key: 'interior_design',
    heading: 'Interiors planned on paper before anything is ordered',
    subheading: 'Layout drawings, an itemised rate card, then execution.',
    body: 'Interior projects overrun because decisions are made on site. We settle the layout, the finishes and the price per line item first, so what you approve is what you pay.',
    bullets: [
      'Measured drawings of every room before design begins',
      'Itemised quotation by room and by trade',
      '3D visualisation of the main spaces before ordering',
      'Fixed rate card — variations are quoted, never assumed',
      'Single project manager as your only point of contact',
      'Snag list walked and signed off with you at handover',
    ],
    sortOrder: 1,
  },
];

export const PROCESS_STEPS = [
  { stepNo: 1, title: 'Call or submit the form', description: 'Reach us on 01-5407720 or send the free consultation form. Every enquiry is timestamped against a two-hour response clock.', icon: 'phone' },
  { stepNo: 2, title: 'Free site inspection', description: 'A certified engineer visits with moisture meters and measuring tools. There is no visiting charge.', icon: 'search' },
  { stepNo: 3, title: 'Transparent written quotation', description: 'You receive an itemised quotation against our published rate card, valid for 15 days, which you can approve online.', icon: 'file-text' },
  { stepNo: 4, title: 'Scheduled execution', description: 'Assigned technicians, a fixed date, and before/after photographs recorded at every stage.', icon: 'hammer' },
  { stepNo: 5, title: 'Handover and warranty', description: 'You sign off on site and receive a one-month warranty certificate with a link to raise a claim.', icon: 'shield-check' },
];

export const PRICING_PLANS = [
  {
    title: 'Seepage Treatment', badge: 'Popular', priceMin: 120, priceMax: 350, unit: '/sq.ft',
    description: 'Complete damp diagnosis and treatment, including surface preparation and finishing.',
    inclusions: ['Free moisture-meter survey', 'Cause identification report', 'Chemical treatment', 'Plaster repair and finish', 'Before/after photographs', '1-month warranty'],
    sortOrder: 0,
  },
  {
    title: 'Terrace Waterproofing', badge: 'Professional', priceMin: 150, priceMax: 400, unit: '/sq.ft',
    description: 'Slope correction, outlet rebuild and membrane application for a full terrace.',
    inclusions: ['Ponding and slope survey', 'Drainage outlet rebuild', 'Membrane system', 'Ponding test on completion', '1-month warranty'],
    sortOrder: 1,
  },
  {
    title: 'Modular Kitchen', priceMin: 1200, priceMax: 3500, unit: '/sq.ft',
    description: 'Design, fabrication and installation of a complete modular kitchen.',
    inclusions: ['Measured drawings', '3D visualisation', 'Marine ply carcass', 'Soft-close hardware', 'Counter and splashback', 'Installation and testing'],
    sortOrder: 2,
  },
  {
    title: 'Full House Renovation', priceMin: 900, priceMax: 2800, unit: '/sq.ft',
    description: 'Sequenced structural, services and finishing works under one project manager.',
    inclusions: ['Structural assessment', 'Stamped drawings', 'Plumbing and electrical renewal', 'Finishing works', 'Snag list and handover', '1-month warranty'],
    sortOrder: 3,
  },
];

export const RATE_CARD = [
  { code: 'SEEP-CHEM', name: 'Chemical damp treatment', category: 'Waterproofing', unit: 'sq.ft', rate: 220, sortOrder: 0 },
  { code: 'WP-TERRACE', name: 'Terrace membrane waterproofing', category: 'Waterproofing', unit: 'sq.ft', rate: 275, sortOrder: 1 },
  { code: 'CRACK-EPOXY', name: 'Epoxy crack injection with stitching', category: 'Repair', unit: 'rft', rate: 165, sortOrder: 2 },
  { code: 'PLASTER-INT', name: 'Internal plaster repair', category: 'Repair', unit: 'sq.ft', rate: 95, sortOrder: 3 },
  { code: 'PAINT-INT', name: 'Interior painting, two coats', category: 'Finishing', unit: 'sq.ft', rate: 45, sortOrder: 4 },
  { code: 'TILE-FLOOR', name: 'Floor tile laying', category: 'Finishing', unit: 'sq.ft', rate: 135, sortOrder: 5 },
  { code: 'KITCH-MOD', name: 'Modular kitchen unit', category: 'Interior', unit: 'sq.ft', rate: 2200, sortOrder: 6 },
  { code: 'CEIL-FALSE', name: 'Gypsum false ceiling', category: 'Interior', unit: 'sq.ft', rate: 185, sortOrder: 7 },
  { code: 'ELEC-POINT', name: 'Electrical point with wiring', category: 'Electrical', unit: 'nos', rate: 950, sortOrder: 8 },
  { code: 'PLUMB-POINT', name: 'CPVC plumbing point', category: 'Plumbing', unit: 'nos', rate: 1250, sortOrder: 9 },
  { code: 'LABOUR-SKILL', name: 'Skilled technician', category: 'Labour', unit: 'hour', rate: 450, sortOrder: 10 },
  { code: 'LABOUR-HELP', name: 'Helper', category: 'Labour', unit: 'hour', rate: 220, sortOrder: 11 },
  { code: 'INSPECT-FREE', name: 'Site inspection (free consultation)', category: 'Survey', unit: 'lump', rate: 0, sortOrder: 12 },
];

export const MATERIALS = [
  { code: 'CEM-OPC', name: 'OPC Cement 50kg', category: 'Cement & Aggregate', unit: 'bag', purchaseRate: 890, sellRate: 980, reorderLevel: 20, opening: 120 },
  { code: 'SAND-RIV', name: 'River sand', category: 'Cement & Aggregate', unit: 'kg', purchaseRate: 3, sellRate: 4, reorderLevel: 500, opening: 4000 },
  { code: 'WP-ACRYL', name: 'Acrylic waterproof coating', category: 'Waterproofing', unit: 'litre', purchaseRate: 620, sellRate: 780, reorderLevel: 15, opening: 60 },
  { code: 'WP-CRYST', name: 'Crystalline damp-proof compound', category: 'Waterproofing', unit: 'kg', purchaseRate: 450, sellRate: 590, reorderLevel: 20, opening: 80 },
  { code: 'EPOXY-INJ', name: 'Epoxy injection resin', category: 'Repair Chemicals', unit: 'litre', purchaseRate: 1850, sellRate: 2400, reorderLevel: 5, opening: 18 },
  { code: 'PAINT-EMUL', name: 'Interior emulsion paint', category: 'Paint', unit: 'litre', purchaseRate: 480, sellRate: 620, reorderLevel: 25, opening: 90 },
  { code: 'PUTTY-WALL', name: 'Wall putty', category: 'Paint', unit: 'kg', purchaseRate: 42, sellRate: 58, reorderLevel: 100, opening: 350 },
  { code: 'CPVC-20', name: 'CPVC pipe 20mm', category: 'Plumbing', unit: 'rft', purchaseRate: 78, sellRate: 105, reorderLevel: 100, opening: 400 },
  { code: 'WIRE-2.5', name: 'Copper wire 2.5 sq.mm', category: 'Electrical', unit: 'rft', purchaseRate: 32, sellRate: 45, reorderLevel: 200, opening: 900 },
  { code: 'PLY-MARINE', name: 'Marine plywood 19mm', category: 'Carpentry', unit: 'sq.ft', purchaseRate: 165, sellRate: 220, reorderLevel: 50, opening: 200 },
];

export const TESTIMONIALS = [
  { quote: 'Our bedroom wall was damp for three monsoons and two painters could not fix it. Ghar Jatan found the leak was coming from the neighbour\'s terrace outlet, not our wall at all. Fixed in two days and it stayed dry all season.', author: 'Sunita Shrestha', location: 'Jhamsikhel, Lalitpur', rating: 5, locale: 'en', sortOrder: 0 },
  { quote: 'हामीले घर मर्मत गर्नु परेको थियो। इन्जिनियर आएर राम्रोसँग हेरेर मात्र रेट भन्नुभयो। काम सकिएपछि पनि फोन गरेर सोध्नुभयो। धेरै राम्रो सेवा।', author: 'राजु महर्जन', location: 'कीर्तिपुर', rating: 5, locale: 'ne', sortOrder: 1 },
  { quote: 'The quotation arrived as a link I could open on my phone and approve. Every line item was priced. No hidden charges at the end, which is rare here.', author: 'Bibek Adhikari', location: 'Baluwatar, Kathmandu', rating: 5, locale: 'en', sortOrder: 2 },
  { quote: 'Terrace waterproofing done before monsoon. They did a ponding test in front of me before leaving. That confidence is worth paying for.', author: 'Anita Gurung', location: 'Bhaisepati, Lalitpur', rating: 5, locale: 'en', sortOrder: 3 },
  { quote: 'भान्साकोठा पूरै नयाँ बनायौं। नाप लिएर ३डी डिजाइन देखाएर मात्र काम सुरु गरे। समयमै सकियो।', author: 'सरिता तामाङ', location: 'ईमाडोल, ललितपुर', rating: 5, locale: 'ne', sortOrder: 4 },
  { quote: 'Called at 10am about a burst concealed pipe, engineer was here by 11:30. They found it with a listening device and opened only one tile.', author: 'Prakash Thapa', location: 'Ekantakuna, Lalitpur', rating: 5, locale: 'en', sortOrder: 5 },
];

export const OFFERS = [
  {
    title: 'मनसुन अघि छत वाटरप्रुफिङ — २०% छुट',
    description: 'Book a terrace waterproofing survey before the monsoon and get 20% off the treatment rate.',
    bullets: ['Free ponding and slope survey', 'Drainage outlet rebuild included', 'Ponding test before handover', '1-month warranty certificate'],
    badge: 'Limited Time', priceMin: 120, priceMax: 320, ctaLabel: 'Book free survey', ctaUrl: '/contact', sortOrder: 0,
  },
  {
    title: 'सिपेज उपचार प्याकेज',
    description: 'Complete damp diagnosis with a written cause report, then treatment at a fixed per-sq.ft rate.',
    bullets: ['Moisture-meter survey at no charge', 'Written cause identification report', 'Chemical treatment and replastering', 'Before and after photographs'],
    badge: 'Popular', priceMin: 120, priceMax: 350, ctaLabel: 'Get a free inspection', ctaUrl: '/contact', sortOrder: 1,
  },
];

export const PROJECTS = [
  {
    title: 'Terrace Waterproofing — Bhaisepati Residence', clientName: 'Private residence', location: 'Bhaisepati, Lalitpur',
    category: 'waterproofing', status: 'completed',
    summary: '1,850 sq.ft terrace with chronic ponding and three interior leak points, rebuilt and sealed in nine days.',
    body: 'The original terrace drained toward the middle rather than the outlets. We demolished the failed screed, rebuilt the slope toward two relocated outlets, applied an APP membrane with a protective screed, then ran a 48-hour ponding test before handover.',
    isFeatured: true, sortOrder: 0,
  },
  {
    title: 'Full Interior Fit-out — Baluwatar Apartment', clientName: 'Private client', location: 'Baluwatar, Kathmandu',
    category: 'interior', status: 'completed',
    summary: '2,400 sq.ft three-bedroom apartment taken from bare shell to fully furnished in eleven weeks.',
    body: 'Layout drawings, modular kitchen, wardrobes, false ceiling, lighting design and complete furnishing, delivered against a fixed itemised rate card with no variation claims at the end.',
    isFeatured: true, sortOrder: 1,
  },
  {
    title: 'Pre-Engineered Warehouse — Balkhu', clientName: 'Commercial client', location: 'Balkhu, Kathmandu',
    category: 'construction', status: 'ongoing',
    summary: '7,000 sq.ft clear-span steel warehouse with a 24m span and no intermediate columns.',
    body: 'Structural design, shop fabrication and site erection under a single scope. Foundations cured while the frame was fabricated off site, compressing the programme to fourteen weeks.',
    isFeatured: true, sortOrder: 2,
  },
];

export const FAQS = [
  { question: 'Is the site visit really free?', answer: 'Yes. Inspection, diagnosis and a written estimate cost nothing, and there is no visiting charge whether or not you proceed. We only charge once you approve a quotation.', group: 'general', sortOrder: 0 },
  { question: 'What does the 2-hour response actually mean?', answer: 'Every enquiry is timestamped when it arrives. Our team is required to make first contact within two hours, and the system escalates to management if that deadline passes. It is the response that is guaranteed within two hours, not the repair.', group: 'general', sortOrder: 1 },
  { question: 'What does the 1-month warranty cover?', answer: 'Workmanship on every technical solution. You receive a warranty certificate with a link to raise a claim. A valid claim is attended free of charge, and we schedule it at high priority.', group: 'warranty', sortOrder: 2 },
  { question: 'How much does seepage repair cost in Kathmandu?', answer: 'Chemical damp treatment runs Rs. 120 to Rs. 350 per sq.ft depending on the cause and the extent. We publish the full rate card, and the free survey tells you which band your wall falls into before you commit.', group: 'pricing', sortOrder: 3 },
  { question: 'Do you work outside Kathmandu Valley?', answer: 'Our core service area is Kathmandu, Lalitpur and Bhaktapur. We take projects outside the valley case by case; call us and we will tell you honestly whether we can service it well.', group: 'general', sortOrder: 4 },
  { question: 'Can I get an estimate before anyone visits?', answer: 'Yes — use the cost estimator on the pricing page. Enter the area and it returns an indicative range from our published rates. The exact figure is confirmed after the free inspection.', group: 'pricing', sortOrder: 5 },
];

export const HERO_SLIDES = [
  { title: 'Certified engineers, at your door in two hours', subtitle: 'Seepage, cracks, plumbing and electrical faults diagnosed properly — with instruments, not guesswork.', ctaLabel: 'Book a free inspection', ctaUrl: '/contact', sortOrder: 0 },
  { title: 'Transparent pricing, published openly', subtitle: 'Every service is quoted against a rate card you can read before you call. No hidden charges at handover.', ctaLabel: 'See our rates', ctaUrl: '/pricing', sortOrder: 1 },
  { title: 'One month warranty on every technical solution', subtitle: 'You receive a certificate and a claim link. A valid claim is attended free, at high priority.', ctaLabel: 'How it works', ctaUrl: '/about', sortOrder: 2 },
];

/** The blog: advice a homeowner searches for, which is what brings them to the service pages. */
export const POST_CATEGORIES = [
  { name: 'Damp & waterproofing', slug: 'damp-and-waterproofing', sortOrder: 0 },
  { name: 'Home care', slug: 'home-care', sortOrder: 1 },
];

export const POSTS = [
  {
    category: 'damp-and-waterproofing',
    title: 'Rising damp or a leaking terrace? How to tell before you repaint',
    slug: 'rising-damp-or-leaking-terrace',
    excerpt: 'Three kinds of damp look identical on a painted wall. Where the stain starts, and when it appears, tells you which one you have.',
    body: 'A damp patch low on a ground-floor wall, with white salt on the plaster, is almost always rising damp: water drawn up from the ground because the damp-proof course has failed or was never laid.\n\nA patch high on a top-floor wall or ceiling that appears a day after heavy rain is the roof. On a flat terrace the cause is usually ponding — water that does not drain toward the outlet and finds its way through a crack instead.\n\nA patch in the middle of a wall that shares a surface with a bathroom or a neighbour\'s house is lateral seepage, and the source is on the other side.\n\nRepainting treats none of these. Before you spend on paint, have the wall read with a moisture meter: the pattern of readings shows where the water is coming from, and that decides the repair.',
    publishedDaysAgo: 12,
    metaTitle: 'Rising damp or roof leak? How to tell | Kathmandu homes',
    metaDescription: 'Three kinds of damp look the same on a painted wall. How to tell rising damp, terrace leaks and lateral seepage apart before you repaint.',
  },
  {
    category: 'home-care',
    title: 'Five checks to make before the monsoon',
    slug: 'five-checks-before-the-monsoon',
    excerpt: 'An hour on the roof in May saves a ceiling in July. What to look at, and what each problem costs to fix early.',
    body: 'Clear every terrace outlet and pour a bucket of water toward it. If the water sits for more than a few minutes, the slope needs correcting.\n\nLook along the parapet for hairline cracks where the wall meets the slab. That joint moves, and it is where most terrace leaks begin.\n\nCheck the overhead tank lid and its overflow pipe. A blocked overflow soaks the slab beneath it all season.\n\nOpen the cupboard under the kitchen sink and feel the back wall. A cold, damp patch there is a concealed pipe, not rain.\n\nFinally, photograph any existing stains with a date. If one grows during the monsoon, you will know it is active.',
    publishedDaysAgo: 30,
  },
];

export const PAGES = [
  {
    // The seeded third hero slide links here.
    slug: 'about',
    title: 'About Ghar Jatan',
    body: 'Ghar Jatan is a team of certified civil and electrical engineers and our own trained crews, working across Kathmandu, Lalitpur and Bhaktapur.\n\nWe started because homeowners kept paying twice for the same repair: once for a quick fix that did not address the cause, and again when the problem came back. So we diagnose first, with instruments, and quote against a published rate card.\n\nEvery enquiry is answered within two hours, every inspection is free, and every technical solution carries a written one-month warranty.',
    metaTitle: 'About us — certified engineers for home repair in Kathmandu',
    metaDescription: 'Certified engineers and our own crews for seepage, waterproofing, renovation and interiors across Kathmandu Valley. Free inspection, two-hour response.',
  },
];

export const MESSAGE_TEMPLATES = [
  { key: 'lead_new', channel: 'sms', locale: 'en', body: 'NEW LEAD: {{leadName}}, {{phone}}. Service: {{service}}. Respond within the 2-hour window. {{link}}' },
  { key: 'lead_new', channel: 'email', locale: 'en', subject: 'New lead: {{leadName}} ({{phone}})',
    body: 'A new enquiry has arrived.\n\nName: {{leadName}}\nPhone: {{phone}}\nAddress: {{address}}\nService: {{service}}\n\nMessage:\n{{message}}\n\nOpen the lead: {{link}}' },
  { key: 'lead_ack', channel: 'sms', locale: 'en', body: 'Thank you {{leadName}}, we have received your request. Our engineer will call you within 2 hours. - {{appName}}' },
  { key: 'lead_ack', channel: 'sms', locale: 'ne', body: 'धन्यवाद {{leadName}}, तपाईंको अनुरोध प्राप्त भयो। हाम्रो इन्जिनियरले २ घण्टाभित्र फोन गर्नुहुनेछ। - {{appName}}' },
  { key: 'lead_sla_breach', channel: 'email', locale: 'en', subject: 'SLA BREACHED: {{leadName}}',
    body: 'Lead {{leadName}} ({{phone}}) has passed the promised response deadline with no contact logged.\n\nOpen it now: {{link}}' },
  { key: 'quotation_sent', channel: 'sms', locale: 'en', body: 'Quotation {{number}} for {{total}} is ready. View and approve: {{link}} - {{appName}}' },
  { key: 'quotation_sent', channel: 'email', locale: 'en', subject: 'Your quotation {{number}} from {{appName}}',
    body: 'Dear {{customerName}},\n\nYour quotation {{number}} totalling {{total}} is ready.\n\nReview and approve it here:\n{{link}}\n\nValid until {{validUntil}}.\n\n{{appName}}' },
  { key: 'quotation_accepted', channel: 'sms', locale: 'en', body: 'Thank you {{customerName}}. Quotation {{number}} ({{total}}) is accepted. We will call you to schedule the work. - {{appName}}' },
  { key: 'quotation_accepted', channel: 'sms', locale: 'ne', body: 'तपाईंको स्वीकृति प्राप्त भयो। कोटेसन {{number}} ({{total}}) अनुसारको काम मिलाउन हामी चाँडै फोन गर्नेछौं। - {{appName}}' },
  { key: 'quotation_accepted', channel: 'email', locale: 'en', subject: 'Quotation {{number}} accepted — thank you',
    body: 'Dear {{customerName}},\n\nThank you for accepting quotation {{number}} for {{total}}. Your job number is {{jobNumber}}.\nWe will call you shortly to agree a date for the work.\n\n{{appName}}' },
  { key: 'quotation_accepted', channel: 'email', locale: 'ne', subject: 'कोटेसन {{number}} स्वीकृत — धन्यवाद',
    body: 'आदरणीय {{customerName}},\n\nकोटेसन {{number}} ({{total}}) स्वीकार गर्नुभएकोमा धन्यवाद। तपाईंको कामको नम्बर {{jobNumber}} हो।\nकाम गर्ने मिति मिलाउन हामी चाँडै फोन गर्नेछौं।\n\n{{appName}}' },
  { key: 'quotation_changes_received', channel: 'sms', locale: 'en', body: 'Thank you {{customerName}}. We have your requested changes to quotation {{number}} and will send a revised quotation soon. - {{appName}}' },
  { key: 'quotation_changes_received', channel: 'sms', locale: 'ne', body: 'तपाईंले मागेका परिवर्तन प्राप्त भए। कोटेसन {{number}} को संशोधित प्रस्ताव चाँडै पठाउनेछौं। - {{appName}}' },
  { key: 'quotation_changes_requested_staff', channel: 'email', locale: 'en', subject: '{{customerName}} asked for changes to {{number}} v{{version}}',
    body: '{{customerName}} asked for changes to quotation {{number}} v{{version}}:\n\n"{{note}}"\n\nRevise it here: {{link}}' },
  { key: 'quotation_changes_requested_staff', channel: 'email', locale: 'ne', subject: '{{customerName}} ले {{number}} v{{version}} मा परिवर्तन मागे',
    body: '{{customerName}} ले कोटेसन {{number}} v{{version}} मा यस्तो परिवर्तन मागेका छन्:\n\n"{{note}}"\n\nसंशोधन गर्न: {{link}}' },
  { key: 'job_assigned', channel: 'sms', locale: 'en', body: 'Job {{number}}: {{title}}\nAt: {{address}}\nCustomer: {{customer}} {{phone}}\nWhen: {{when}}' },
  { key: 'survey_returned', channel: 'sms', locale: 'en', body: 'Survey {{number}} was sent back: {{note}} - {{appName}}' },
  { key: 'job_en_route', channel: 'sms', locale: 'en', body: 'Hi {{customerName}}, our technician is on the way for job {{number}}. - {{appName}}' },
  { key: 'job_completed', channel: 'sms', locale: 'en', body: 'Job {{number}} is complete. Your work carries a {{warrantyDays}}-day warranty: {{warrantyLink}} - {{appName}}' },
  { key: 'invoice_sent', channel: 'sms', locale: 'en', body: 'Invoice {{number}}: {{total}}, due {{dueDate}}. {{link}} - {{appName}}' },
  { key: 'invoice_overdue', channel: 'sms', locale: 'en', body: 'Reminder: invoice {{number}} ({{outstanding}}) is {{days}} day(s) overdue. - {{appName}}' },
  { key: 'warranty_claim_accepted', channel: 'sms', locale: 'en', body: 'Your warranty claim is accepted. Job {{number}} is scheduled {{when}} at no charge. - {{appName}}' },
  { key: 'warranty_claim_rejected', channel: 'sms', locale: 'en', body: 'Regarding your warranty claim: {{reason}}. Please call us to discuss. - {{appName}}' },
  { key: 'amc_visit_due', channel: 'sms', locale: 'en', body: 'Your {{planName}} maintenance visit is due on {{date}}. We will confirm the time. - {{appName}}' },
  { key: 'password_reset', channel: 'email', locale: 'en', subject: 'Reset your {{appName}} password',
    body: 'Hi {{name}},\n\nReset your password using this link (valid for 1 hour):\n{{link}}\n\nIf you did not request this, ignore this email.' },
];

export const JOB_TEMPLATES = [
  {
    service: 'seepage-and-damp-treatment', name: 'Seepage treatment — standard checklist',
    tasks: [
      { title: 'Photograph the affected area before starting' },
      { title: 'Take moisture-meter readings and record them' },
      { title: 'Identify the water path (rising / lateral / roof)' },
      { title: 'Remove loose plaster back to sound substrate' },
      { title: 'Apply chemical treatment per specification' },
      { title: 'Replaster and finish the surface' },
      { title: 'Photograph the completed work' },
      { title: 'Walk the work with the customer and get sign-off' },
    ],
  },
  {
    service: 'roof-and-terrace-waterproofing', name: 'Terrace waterproofing — standard checklist',
    tasks: [
      { title: 'Survey ponding areas and record slope readings' },
      { title: 'Photograph existing outlets and problem areas' },
      { title: 'Demolish failed screed and clear debris' },
      { title: 'Rebuild slope toward outlets' },
      { title: 'Rebuild drainage outlet details' },
      { title: 'Apply membrane system' },
      { title: 'Apply protective screed' },
      { title: 'Run 48-hour ponding test' },
      { title: 'Photograph completed terrace and hand over' },
    ],
  },
  {
    name: 'Free inspection visit',
    tasks: [
      { title: 'Call the customer 30 minutes before arriving' },
      { title: 'Photograph the reported problem' },
      { title: 'Take instrument readings where applicable' },
      { title: 'Measure the affected area' },
      { title: 'Explain the likely cause to the customer' },
      { title: 'Record the scope for quotation' },
    ],
  },
];
