import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useConfirm } from '@/hooks/useConfirm';

function Harness({ onAnswer }) {
  const [confirm, confirmDialog] = useConfirm();
  const ask = async () => onAnswer(await confirm({
    title: 'Delete this FAQ?',
    description: 'It moves to the trash.',
    confirmLabel: 'Delete',
    destructive: true,
  }));
  return (
    <>
      <button type="button" onClick={ask}>Ask</button>
      {confirmDialog}
    </>
  );
}

const setup = () => {
  const onAnswer = vi.fn();
  const user = userEvent.setup();
  render(<Harness onAnswer={onAnswer} />);
  return { onAnswer, user };
};

describe('useConfirm', () => {
  it('resolves true when confirmed', async () => {
    const { onAnswer, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete this FAQ?' });
    expect(dialog).toHaveAccessibleDescription('It moves to the trash.');
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(true));
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });

  it('resolves false when cancelled', async () => {
    const { onAnswer, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    await screen.findByRole('alertdialog');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(false));
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });

  it('resolves false on Escape', async () => {
    const { onAnswer, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    await screen.findByRole('alertdialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith(false));
  });
});
