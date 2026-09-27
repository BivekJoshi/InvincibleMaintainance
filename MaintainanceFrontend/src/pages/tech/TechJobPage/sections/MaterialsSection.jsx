import { useState } from 'react';
import { CloudUpload, PackagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MaterialsSheet } from '@/components/tech/MaterialsSheet';

/**
 * What was used on the job — the server's lines and the ones still on the phone — and "Log material".
 * Quantities and units only: nothing under /tech shows a rate.
 */
export function MaterialsSection({ job, copy, readOnly, onLog }) {
  const [open, setOpen] = useState(false);
  const words = copy.materials;
  const lines = job.materials ?? [];
  if (readOnly && !lines.length) return null;

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{words.title}</CardTitle></CardHeader>
      <CardContent className="space-y-3 pb-4">
        {lines.length ? (
          <ul className="divide-y rounded-lg border" aria-label={words.title}>
            {lines.map((line) => (
              <li key={line.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{line.material?.name ?? line.material?.code ?? '—'}</span>
                  {line.material?.code ? <span className="block font-mono text-xs text-muted-foreground">{line.material.code}</span> : null}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{Number(line.qty)} {line.material?.unit ?? ''}</span>
                {line.pending ? <CloudUpload className="h-4 w-4 shrink-0 text-muted-foreground" aria-label={copy.job.pending} /> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{words.none}</p>
        )}
        {!readOnly ? (
          <Button variant="outline" size="xl" className="w-full" onClick={() => setOpen(true)}>
            <PackagePlus /> {words.log}
          </Button>
        ) : null}
        {!readOnly ? <MaterialsSheet open={open} onOpenChange={setOpen} onLog={onLog} words={words} /> : null}
      </CardContent>
    </Card>
  );
}
