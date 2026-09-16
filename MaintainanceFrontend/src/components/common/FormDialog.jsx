import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/**
 * A short `<ResourceForm>` in a dialog — a reason, an owner, one line — where a sheet
 * would be too much. Cancel and a successful save close it; the page's own guard stays
 * the only leave-guard (`guard={false}`), since a dialog this small is closed on purpose.
 *
 * @param {object} props  `open`, `onOpenChange`, `title`, `description`, and ResourceForm's props
 */
export function FormDialog({ open, onOpenChange, title, description, onSubmit, children, ...form }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" {...(description ? {} : { 'aria-describedby': undefined })}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
        {open ? (
          <ResourceForm
            {...form}
            guard={false}
            onCancel={() => onOpenChange(false)}
            onSubmit={async (body, helpers) => {
              const result = await onSubmit(body, helpers);
              onOpenChange(false);
              return result;
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
