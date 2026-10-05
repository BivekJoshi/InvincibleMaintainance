import { CloudUpload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { openTasks } from '@/helpers/fieldJob';
import { cn } from '@/helpers/utils';
import { FIELD } from '@/config/i18n/field';
import { useT } from '@/hooks/useT';

/**
 * The checklist — the centre of the job, since the API refuses completion while an item is open. Each row
 * is one big target; a tick is queued and shows at once, marked until it reaches the office.
 */
export function ChecklistSection({ job, readOnly, onToggle }) {
  const t = useT(FIELD);
  const tasks = job.tasks ?? [];
  if (!tasks.length) return null;
  const open = openTasks(job).length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {t('job.checklist.title')}
          <span className="ml-2 text-xs font-normal text-muted-foreground">{t('job.checklist.done', { done: tasks.length - open, total: tasks.length })}</span>
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
              aria-label={t('job.checklist.tick', { title: task.title })}
              className="mt-0.5 h-6 w-6 rounded"
            />
            <span className={cn('min-w-0 flex-1 text-sm', task.isDone || task.isSkipped ? 'text-muted-foreground line-through' : '')}>
              {task.title}
              {task.note ? <span className="block text-xs text-muted-foreground no-underline">{task.note}</span> : null}
              {task.isSkipped ? <span className="block text-xs">{t('job.checklist.skipped')}</span> : null}
            </span>
            {task.pending ? (
              <CloudUpload className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-label={t('job.pending')} />
            ) : null}
          </label>
        ))}
      </CardContent>
    </Card>
  );
}
