import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import authRoutes from './auth.routes.js';
import publicRoutes from './public.routes.js';
import techRoutes from './tech.routes.js';
import cmsRoutes from './admin/cms.routes.js';
import crmRoutes from './admin/crm.routes.js';
import opsRoutes from './admin/ops.routes.js';
import financeRoutes from './admin/finance.routes.js';
import aftercareRoutes from './admin/aftercare.routes.js';
import platformRoutes from './admin/platform.routes.js';
import * as pub from '../services/public.service.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/public', publicRoutes);

// SEO artifacts live at the API root so a reverse proxy can map them to /sitemap.xml.
router.get('/sitemap.xml', asyncHandler(async (req, res) => {
  const origin = req.query.origin || req.headers.origin || 'https://example.com';
  res.type('application/xml').send(await pub.sitemap(String(origin).replace(/\/$/, '')));
}));

router.get('/json-ld', asyncHandler(async (req, res) => {
  const origin = req.query.origin || req.headers.origin || 'https://example.com';
  res.json(await pub.jsonLd(String(origin).replace(/\/$/, '')));
}));

router.get('/robots.txt', (req, res) => {
  const origin = req.query.origin || req.headers.origin || '';
  res.type('text/plain').send(`User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`);
});

// Everything below requires a valid access token.
router.use('/tech', authenticate, techRoutes);
router.use('/admin', authenticate, cmsRoutes);
router.use('/admin', authenticate, crmRoutes);
router.use('/admin', authenticate, opsRoutes);
router.use('/admin', authenticate, financeRoutes);
router.use('/admin', authenticate, aftercareRoutes);
router.use('/admin', authenticate, platformRoutes);

export default router;
