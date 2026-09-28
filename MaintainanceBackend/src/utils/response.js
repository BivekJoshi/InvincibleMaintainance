export function ok(res, data, meta) {
  return res.json(meta ? { data, meta } : { data });
}

export function created(res, data, meta) {
  return res.status(201).json(meta ? { data, meta } : { data });
}

export function noContent(res) {
  return res.status(204).end();
}
