import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { ok, created, noContent } from '../../utils/response.js';
import { idParam } from '../../shared/schemas/common.js';
import {
  noteCreateSchema, noteUpdateSchema, shortcutCreateSchema, shortcutOrderSchema, shortcutUpdateSchema,
} from '../../shared/schemas/me.js';
import * as me from '../../services/me.service.js';

/** The caller's own admin-shell shortcuts and notes. Every role; own rows only. */
const router = Router();

// ── shortcuts
router.get('/me/shortcuts', asyncHandler(async (req, res) => {
  const { items, meta } = await me.listShortcuts(req.user.id);
  ok(res, items, meta);
}));

router.post('/me/shortcuts', validate({ body: shortcutCreateSchema }),
  asyncHandler(async (req, res) => created(res, await me.createShortcut(req.user.id, req.body))));

// Before /:id, so "order" is never read as an id.
router.put('/me/shortcuts/order', validate({ body: shortcutOrderSchema }), asyncHandler(async (req, res) => {
  await me.reorderShortcuts(req.user.id, req.body.ids);
  noContent(res);
}));

router.patch('/me/shortcuts/:id', validate({ params: idParam, body: shortcutUpdateSchema }),
  asyncHandler(async (req, res) => ok(res, await me.updateShortcut(req.user.id, req.params.id, req.body))));

router.delete('/me/shortcuts/:id', validate({ params: idParam }), asyncHandler(async (req, res) => {
  await me.deleteShortcut(req.user.id, req.params.id);
  noContent(res);
}));

// ── notes
router.get('/me/notes', asyncHandler(async (req, res) => {
  const { items, meta } = await me.listNotes(req.user.id);
  ok(res, items, meta);
}));

router.post('/me/notes', validate({ body: noteCreateSchema }),
  asyncHandler(async (req, res) => created(res, await me.createNote(req.user.id, req.body))));

router.patch('/me/notes/:id', validate({ params: idParam, body: noteUpdateSchema }),
  asyncHandler(async (req, res) => ok(res, await me.updateNote(req.user.id, req.params.id, req.body))));

router.delete('/me/notes/:id', validate({ params: idParam }), asyncHandler(async (req, res) => {
  await me.deleteNote(req.user.id, req.params.id);
  noContent(res);
}));

export default router;
