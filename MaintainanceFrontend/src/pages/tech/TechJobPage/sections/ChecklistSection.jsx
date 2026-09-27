import { CloudUpload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { openTasks } from '@/helpers/fieldJob';
import { cn } from '@/helpers/utils';

/**
 * The checklist — the centre of the job, since the API refuses completion while an item is open. Each row
 * is one big target; a tick is queued and shows at once, marked until it reaches the office.
 */
export function ChecklistSection({ job, copy, readOnly, onToggle }) {
  const tasks = job.tasks ?? [];
  if (!tasks.length) return null;
  const words = copy.job.checklist;
  const open = openTasks(job).length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {words.title}
          <span className="ml-2 text-xs font-normal text-muted-foreground">{words.done(tasks.length - open, tasks.length)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 pb-4">
        {tasks.map((task) => (
          <label
            key={task.id}
            className={cn('flex min-h-12 items-start gap-3 rounded-md px-2 py-2.5', readOnly ? '' : 'cursor-pointer active:bg-muted')}
          >
            <Checkbox
              checked={Boolean(task.isDone)}
              disabled={readOnly || task.isSkipped}
              onCheckedChange={(v) => onToggle(task, Boolean(v))}
              aria-label={words.tick(task.title)}
              className="mt-0.5 h-6 w-6 rounded"
            />
            <span className={cn('min-w-0 flex-1 text-sm', task.isDone || task.isSkipped ? 'text-muted-foreground line-through' : '')}>
              {task.title}
              {task.note ? <span className="block text-xs text-muted-foreground no-underline">{task.note}</span> : null}
              {task.isSkipped ? <span className="block text-xs">{words.skipped}</span> : null}
            </span>
            {task.pending ? (
              <CloudUpload className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-label={copy.job.pending} />
            ) : null}
          </label>
        ))}
      </CardContent>
    </Card>
  );
}
