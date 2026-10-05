import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { BsCalendar } from '@/components/common/BsCalendar';
import { DateCalendar } from '@/components/common/DateCalendar';
import { ResourceForm } from '@/components/common/ResourceForm/ResourceForm';
import { setDisplayCalendar } from '@/helpers/displayCalendar';
import { fromKathmanduParts } from '@/helpers/format';
import { renderWithProviders } from '@/test/renderWithProviders';

afterEach(() => setDisplayCalendar('ad'));

/** A day's button, by the AD date its label ends with ("Mon, 5 Oct 2026"). */
const dayButton = (ad) => screen.getByRole('button', { name: new RegExp(`— ${ad}$`) });

describe('BsCalendar — the Nepali calendar to pick from', () => {
  it('opens on the BS month of the picked day, in Nepali script, and gives back the AD day', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithProviders(<BsCalendar selected="2026-10-04" onSelect={onSelect} />);

    expect(screen.getByRole('grid', { name: 'असोज २०८३' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Month' })).toHaveDisplayValue('असोज');
    expect(screen.getByRole('combobox', { name: 'Year' })).toHaveDisplayValue('२०८३');
    expect(screen.getByText('Sept – Oct 2026 AD')).toBeInTheDocument();
    // The picked day: १८ असोज, with its AD date under it.
    const picked = dayButton('Sun, 4 Oct 2026');
    expect(picked).toHaveAttribute('aria-pressed', 'true');
    expect(picked).toHaveTextContent('१८4');

    await user.click(dayButton('Mon, 5 Oct 2026'));
    expect(onSelect).toHaveBeenCalledWith('2026-10-05');
  });

  it('steps BS months — by the arrows, the lists and the keyboard', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BsCalendar selected="2026-10-04" onSelect={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('grid', { name: 'कात्तिक २०८३' })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Month' }), 'बैशाख');
    expect(screen.getByRole('grid', { name: 'बैशाख २०८३' })).toBeInTheDocument();
    // BS new year 2083 is 14 April 2026.
    expect(dayButton('Tue, 14 Apr 2026')).toHaveTextContent('१14');

    // Page Down from a day is the same day a BS month on.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Month' }), 'असोज');
    dayButton('Sun, 4 Oct 2026').focus();
    await user.keyboard('{ArrowRight}');
    expect(dayButton('Mon, 5 Oct 2026')).toHaveFocus();
    await user.keyboard('{PageDown}');
    await waitFor(() => expect(screen.getByRole('grid', { name: 'कात्तिक २०८३' })).toBeInTheDocument());
  });

  it('picks a range, and keeps days outside the limits shut', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { rerender } = renderWithProviders(<BsCalendar mode="range" selected={{}} onSelect={onSelect} defaultMonth="2026-10-04" />);
    await user.click(dayButton('Sun, 4 Oct 2026'));
    expect(onSelect).toHaveBeenLastCalledWith({ from: '2026-10-04', to: undefined });
    rerender(<BsCalendar mode="range" selected={{ from: '2026-10-04' }} onSelect={onSelect} />);
    await user.click(dayButton('Fri, 9 Oct 2026'));
    expect(onSelect).toHaveBeenLastCalledWith({ from: '2026-10-04', to: '2026-10-09' });

    rerender(<BsCalendar selected="2026-10-04" onSelect={onSelect} disabled={{ before: '2026-10-04' }} />);
    expect(dayButton('Sat, 3 Oct 2026')).toBeDisabled();
    expect(dayButton('Sun, 4 Oct 2026')).toBeEnabled();
  });
});

describe('DateCalendar — AD or BS, as the account menu says', () => {
  it('shows the Gregorian picker in English and the Nepali one in Nepali, with the same days in and out', () => {
    const { unmount } = renderWithProviders(<DateCalendar selected="2026-10-04" onSelect={() => {}} />);
    expect(document.querySelector('[data-calendar="bs"]')).toBeNull();
    unmount();

    setDisplayCalendar('bs');
    renderWithProviders(<DateCalendar selected="2026-10-04" onSelect={() => {}} />);
    expect(document.querySelector('[data-calendar="bs"]')).not.toBeNull();
  });

  it('a form’s date field picks in BS and stores the same Kathmandu instant', async () => {
    setDisplayCalendar('bs');
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({});
    const schema = z.object({ validUntil: z.string().optional() });
    renderWithProviders(
      <ResourceForm
        schema={schema}
        fields={[{ name: 'validUntil', type: 'date', label: 'Valid until', time: '23:59' }]}
        defaultValues={{ validUntil: fromKathmanduParts('2026-10-04', '23:59') }}
        onSubmit={onSubmit}
      />,
    );
    // The button says the BS date, with the AD one beside it.
    const button = screen.getByRole('button', { name: /^Valid until/ });
    expect(button).toHaveTextContent('१८ असोज २०८३');
    expect(button).toHaveTextContent('04 Oct');

    await user.click(button);
    await user.click(dayButton('Mon, 5 Oct 2026'));
    expect(button).toHaveTextContent('१९ असोज २०८३');
    await user.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].validUntil).toBe(fromKathmanduParts('2026-10-05', '23:59'));
  });
});
