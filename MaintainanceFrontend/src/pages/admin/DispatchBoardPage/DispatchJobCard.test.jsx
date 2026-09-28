import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { DispatchJobCard } from './DispatchJobCard';
import { renderWithProviders, signedInAs } from '@/test/renderWithProviders';

/** An inspection booked for Friday 18 Sept 2026, 10:00–12:00 in Kathmandu. */
const INSPECTION = {
  id: 'j1', number: 'JOB-2083-0004', title: 'Damp inspection', type: 'INSPECTION', status: 'ASSIGNED', priority: 'NORMAL',
  scheduledStart: '2026-09-18T04:15:00.000Z', scheduledEnd: '2026-09-18T06:15:00.000Z',
  customer: { id: 'c1', name: 'अञ्जली कार्की' }, site: { id: 's1', area: 'Baneshwor' },
  assignments: [{ technicianId: 't1', isLead: true }],
  visitAnswer: null, customerConfirmedAt: null, visitAnsweredAt: null,
};

const card = (job, { compact = false } = {}) => renderWithProviders(
  <DndContext>
    <DispatchJobCard job={job} laneId="t1" compact={compact} onSchedule={() => {}} />
  </DndContext>,
  { preloadedState: signedInAs('DISPATCHER') },
);

describe('the dispatch card — the customer’s answer to an inspection (Phase L5)', () => {
  it('says "Not confirmed" on a booked inspection the customer has not confirmed', () => {
    card(INSPECTION);
    const flag = screen.getByText('Not confirmed');
    expect(flag.closest('[data-visit-flag]')).toHaveAttribute('title', 'The customer has not confirmed this visit yet');
    expect(screen.queryByText('Wants another time')).not.toBeInTheDocument();
  });

  it('says "Wants another time" loudly, with the note on hover — on a compact card too', () => {
    const job = {
      ...INSPECTION, visitAnswer: 'RESCHEDULE_REQUESTED', visitAnsweredAt: '2026-09-16T03:45:00.000Z', visitAnswerNote: 'शनिबार बिहान',
    };
    card(job, { compact: true });
    const flag = screen.getByText('Wants another time').closest('[data-visit-flag]');
    expect(flag).toHaveAttribute('data-visit-flag', 'reschedule');
    expect(flag).toHaveAttribute('title', expect.stringContaining('16 Sept 2026, 09:30 — “शनिबार बिहान”'));
    expect(flag).toHaveClass('bg-destructive');
    // The card is ringed as well — but the flag's words are what say it.
    expect(flag.closest('article')).toHaveClass('ring-destructive/40');
    expect(screen.queryByText('Not confirmed')).not.toBeInTheDocument();
  });

  it('shows no warning on a confirmed inspection, only a quiet tick', () => {
    card({ ...INSPECTION, visitAnswer: 'CONFIRMED', customerConfirmedAt: '2026-09-16T05:15:00.000Z' }, { compact: true });
    expect(screen.queryByText('Not confirmed')).not.toBeInTheDocument();
    expect(screen.queryByText('Wants another time')).not.toBeInTheDocument();
    // In words for a screen reader, even where the compact card shows only the tick.
    expect(screen.getByText('Confirmed')).toHaveClass('sr-only');
  });

  it('shows nothing on a repair job, or on an inspection already under way', () => {
    const { unmount } = card({ ...INSPECTION, type: 'REPAIR' });
    expect(document.querySelector('[data-visit-flag]')).toBeNull();
    unmount();
    card({ ...INSPECTION, status: 'IN_PROGRESS', visitAnswer: 'RESCHEDULE_REQUESTED' });
    expect(document.querySelector('[data-visit-flag]')).toBeNull();
    expect(screen.queryByText('Wants another time')).not.toBeInTheDocument();
  });
});

describe('the dispatch card — the advance gate (Phase L6)', () => {
  const HELD = {
    ...INSPECTION, id: 'j9', number: 'JOB-2083-0090', type: 'RENOVATION', status: 'DRAFT', scheduledStart: null, scheduledEnd: null,
    assignments: [], awaitingAdvance: true, advanceInvoice: { id: 'inv-adv', number: 'INV-2083-0077', status: 'SENT' },
  };

  it('says "Awaiting advance" — on a compact card too — and offers the dialog, not a drag', () => {
    card(HELD, { compact: true });
    const chip = screen.getByTestId('awaiting-advance');
    expect(chip).toHaveTextContent('Awaiting advance');
    expect(chip.closest('[title]')).toHaveAttribute('title', 'Scheduling is locked until the advance (INV-2083-0077) is paid');
    expect(screen.queryByRole('button', { name: 'Drag JOB-2083-0090' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Schedule JOB-2083-0090' })).toBeEnabled();
  });

  it('shows nothing once the advance is paid or overridden', () => {
    card({ ...HELD, awaitingAdvance: false, advanceInvoice: { ...HELD.advanceInvoice, status: 'PAID' } });
    expect(screen.queryByTestId('awaiting-advance')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Drag JOB-2083-0090' })).toBeInTheDocument();
  });
});
