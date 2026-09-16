import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';

function Harness({ onOutside }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button">Elsewhere</button>
      <ul data-toaster=""><li><button type="button">Dismiss toast</button></li></ul>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent onInteractOutside={onOutside}>
          <SheetTitle>Sheet</SheetTitle>
          <SheetDescription>Body</SheetDescription>
        </SheetContent>
      </Sheet>
    </>
  );
}

describe('ignoreToastInteraction', () => {
  it('keeps a sheet open when a toast is pressed, and still closes it on any other outside press', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onOutside = vi.fn();
    render(<Harness onOutside={onOutside} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByText('Dismiss toast'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onOutside).not.toHaveBeenCalled();

    await user.click(screen.getByText('Elsewhere'));
    expect(onOutside).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
