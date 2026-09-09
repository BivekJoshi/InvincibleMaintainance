# Homeplex Nepal — Site Study & Dynamic System Blueprint

Source studied: `https://homeplexnepal.com/` (home page, full text content captured 2026-09-01)
Goal: rebuild the same page, but **content-driven from a database + admin panel** instead of hardcoded HTML.

---

## 1. What the site is

A Kathmandu-based home construction / repair / interior services company. The single long home page is a marketing funnel: hero → services → proof (projects, gallery, testimonials, stats) → offers → pricing → process → lead form.

**Business promises repeated across the page (these are content, not code — must be editable):**
- 2-hour response time
- Free consultation, no visiting charge
- 1-month warranty on technical solutions
- Transparent / no hidden pricing
- Certified engineers, inspection with devices

**Contact data (single source of truth in settings table):**
- Phone: `01-5407720` / `9808338255`
- Email: `support@homeplexnepal.com`
- Address: Bhanimandal, Ekantakuna, Lalitpur
- Stats: `2.5k+` satisfied clients, `500+` major projects

**Language:** Mixed English + Nepali (Devanagari). Offers and several testimonials are pure Nepali. → **The system must be i18n-ready (en/ne) or at minimum store raw unicode text safely (UTF-8 / utf8mb4).**

---

## 2. Page anatomy (section by section)

Every one of these becomes a **dynamic, orderable, toggleable block**.

| # | Section | Content type | Dynamic fields |
|---|---------|--------------|----------------|
| 1 | Hero slider (3 slides) | `hero_slides` | title, subtitle, CTA label, CTA link, background image, order, active |
| 2 | Quick-inquiry strip + badges | `settings` | "Free Consultation / 2 Hour Response / 100% Secure" badges |
| 3 | Services grid (9 items) | `services` | name, slug, short desc, icon/image, category, featured, order |
| 4 | Projects / portfolio (3 shown) | `projects` | title, client name, location, status badge, description, cover + gallery, "Inquire Details" link |
| 5 | Special offers | `offers` | title (Nepali), bullet list of inclusions, badge ("Limited Time"), price range, start/end date, CTA |
| 6 | Visual portfolio gallery | `gallery_images` | image, caption, project ref, order |
| 7 | Why Choose Us (4 cards) | `features` (group=`why_choose`) | icon, title, description, order |
| 8 | Counters / stats | `settings` or `stats` | label, value, order |
| 9 | Seepage & crack explainer + 6 checkpoints | `content_blocks` | heading, body, bullet list, image, CTAs |
| 10 | Interior design block (6 bullets) | `content_blocks` | same |
| 11 | Why construction (6 cards) | `features` (group=`construction`) | icon, title, desc |
| 12 | Renovation reasons (7 numbered) | `list_items` (group=`renovation`) | number, text |
| 13 | Pre-engineered buildings (4 "PROPER *" cards) | `features` (group=`pre_engineered`) | |
| 14 | Kitchen modernization (8 numbered + 3 kitchen cards) | `list_items` + `features` | |
| 15 | Popular work / pricing | `pricing_plans` | name, badge (Popular/Professional), description, price_min, price_max, unit (`/sq.ft`), inclusions, order |
| 16 | Other civil work (9 links) | `services` where `type=other_civil` | |
| 17 | Working process (5 steps) | `process_steps` | step no, title, description, icon |
| 18 | Testimonials (6) | `testimonials` | quote (en/ne), author, location/site, rating, photo, approved, order |
| 19 | Free consultation form | `leads` | name, phone, address, problem description |
| 20 | Footer / contact | `settings` | phone, email, address, socials, map embed |

---

## 3. Key finding: the content is templated already

Service descriptions follow a literal template: *"Professional {service} with expert tools and results."* — i.e. the current site already generates them from a list. That confirms a DB-driven service model is the right shape, and the description field should be **per-service editable** so these placeholder lines can be replaced with real copy (also an SEO weakness today: 9 near-duplicate descriptions).

---

## 4. Data model (proposed schema)

```
settings(key, value, group)                      -- phones, email, address, badges, stats, socials, SEO defaults
users(id, name, email, password, role)           -- admin / editor
media(id, path, alt, mime, size, folder)

hero_slides(id, title, subtitle, cta_label, cta_url, image_id, sort, is_active)
service_categories(id, name, slug, sort)
services(id, category_id, name, slug, excerpt, body, icon, image_id,
         price_from, price_to, price_unit, is_featured, sort, is_active,
         meta_title, meta_description)

projects(id, title, client_name, location, category_id, status,
         description, body, cover_id, completed_at, is_featured, sort, is_active)
project_images(id, project_id, media_id, sort)

offers(id, title, description, bullets(json), badge, price_min, price_max,
       starts_at, ends_at, cta_label, cta_url, is_active)

pricing_plans(id, title, badge, description, price_min, price_max, unit,
              inclusions(json), sort, is_active)

features(id, group, icon, title, description, sort)      -- reusable card blocks
list_items(id, group, position, text)                    -- numbered lists
content_blocks(id, key, heading, subheading, body,
               bullets(json), image_id, cta(json), is_active)

process_steps(id, step_no, title, description, icon, sort)
testimonials(id, quote, author, location, rating, photo_id, lang,
             is_approved, sort)
gallery_images(id, media_id, caption, project_id, sort)

leads(id, name, phone, address, message, service_id, source_page,
      status[new|contacted|quoted|won|lost], assigned_to, notes,
      ip, user_agent, created_at)
lead_notes(id, lead_id, user_id, note, created_at)

pages(id, slug, title, body, meta_title, meta_description, is_active)
posts(id, ...)                                   -- optional blog for SEO
```

**Translations:** either JSON columns (`{"en": "...", "ne": "..."}`) or a `translations(model, model_id, field, locale, value)` table. Given the Nepali content already present, plan for this from day one.

---

## 5. Admin panel requirements

- **Dashboard:** new leads today/week, leads by status, top requested services, recent projects.
- **CRUD for every table above**, with drag-and-drop `sort`, active/inactive toggle, and image picker from `media`.
- **Section ordering & visibility** for the home page (a `home_sections` table: `key, sort, is_visible`) so marketing can rearrange the page without a developer.
- **Lead management (the highest-value feature):** list/filter/search, status pipeline, assign to staff, notes, export CSV, and the 2-hour SLA timer visible per lead — the site publicly promises a 2-hour response, so the admin should highlight leads approaching that deadline.
- **Notifications on new lead:** email + SMS (Sparrow SMS / Aakash SMS are the common Nepal gateways) + optional Viber/WhatsApp link.
- **Media library** with automatic resizing + WebP conversion (the page is image-heavy: hero, projects, gallery, kitchen cards).
- **SEO fields** per service/project/page + sitemap.xml auto-generation + schema.org `LocalBusiness` / `Service` / `Review` JSON-LD.
- **Roles:** admin (all), editor (content only), sales (leads only).

---

## 6. Public site requirements

- Home page assembled from the ordered dynamic sections above.
- `/services`, `/services/{slug}` detail pages (currently missing → SEO opportunity).
- `/projects`, `/projects/{slug}` with image gallery.
- `/offers`, `/contact`, `/about`.
- Lead form: server-side validation, honeypot + rate limit + reCAPTCHA/Turnstile (spam is guaranteed on a phone-collecting form), Nepali phone regex `^(97|98)\d{8}$|^0\d{1,2}-\d{6,7}$`.
- Sticky call button + "Call now" / Viber floating action on mobile — most traffic will be mobile Kathmandu users.
- Performance: lazy-load gallery, cache rendered sections, CDN for images.

---

## 7. Suggested stack

| Option | Why |
|---|---|
| **Laravel 11 + Filament 3 + MySQL + Blade/Livewire** (recommended) | Fastest path to a full admin panel; Filament gives CRUD, media, ordering, roles almost free. Cheap shared/VPS hosting common in Nepal. |
| Next.js + Payload/Strapi + Postgres | Better if you want a headless API and a very fast marketing front end. |
| WordPress + ACF + CPTs | Fastest to launch, weakest for lead pipeline/SLA logic. |

---

## 8. Gaps / improvements over the current site

1. Duplicate boilerplate service descriptions → hurts SEO; write unique copy per service.
2. No individual service or project detail pages → lost long-tail search traffic ("waterproofing Kathmandu", "modular kitchen Lalitpur").
3. Pricing shown only for 2 items; make all services optionally priced with a range.
4. No visible blog / FAQ → add for SEO and to answer "seepage repair cost" queries.
5. No cost estimator — a "sq.ft × rate" calculator using `pricing_plans` would capture far more leads.
6. Testimonials should be moderated (`is_approved`) and support both languages.
7. Add analytics + conversion tracking (GA4 / Meta Pixel) with events on form submit and call-button click.

---

## 9. Build order

1. Schema + auth + media library
2. Settings, hero, services, projects, gallery (core content)
3. Home page renderer with orderable sections
4. Lead form → leads module + notifications + SLA
5. Offers, pricing, process, testimonials, features/lists
6. Detail pages + SEO + sitemap + JSON-LD
7. i18n (en/ne), analytics, performance pass, deploy
