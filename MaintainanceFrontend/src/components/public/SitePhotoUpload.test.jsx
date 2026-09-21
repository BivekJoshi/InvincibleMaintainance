import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SitePhotoUpload } from '@/components/public/SitePhotoUpload';
import { renderWithProviders } from '@/test/renderWithProviders';
import { json, mockApi } from '@/test/mockApi';

afterEach(() => vi.unstubAllGlobals());

const photo = (name = 'leak.png', bytes = 1024) =>
  new File([new Uint8Array(bytes)], name, { type: 'image/png' });

const uploaded = (ids) => json({ data: ids.map((id) => ({ id, url: `/uploads/${id}.webp`, thumb: `/uploads/${id}-400.webp` })) }, 201);

describe('sending photos with an enquiry', () => {
  it('uploads what was chosen and hands up the ids', async () => {
    const user = userEvent.setup();
    const calls = mockApi(({ method, path }) =>
      (method === 'POST' && path === '/public/lead-photos' ? uploaded(['m1', 'm2']) : undefined));
    const onChange = vi.fn();
    renderWithProviders(<SitePhotoUpload onChange={onChange} />);

    await user.upload(screen.getByLabelText('Photos of the problem'), [photo('leak.png'), photo('crack.png')]);

    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(['m1', 'm2']));
    expect(calls.filter((c) => c.path === '/public/lead-photos')).toHaveLength(1);
    expect(screen.getByAltText('leak.png')).toBeInTheDocument();
  });

  it('refuses a photo over 10 MB before it is uploaded', async () => {
    const user = userEvent.setup();
    const calls = mockApi(() => undefined);
    const onChange = vi.fn();
    renderWithProviders(<SitePhotoUpload onChange={onChange} />);

    await user.upload(screen.getByLabelText('Photos of the problem'), photo('huge.png', 11 * 1024 * 1024));

    expect(await screen.findByText(/huge.png is over 10 MB/)).toBeInTheDocument();
    expect(calls.some((c) => c.path === '/public/lead-photos')).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps the enquiry going when an upload fails, and leaves the photo out', async () => {
    const user = userEvent.setup();
    mockApi(({ path }) => (path === '/public/lead-photos'
      ? json({ error: { code: 'RATE_LIMITED', message: 'Too many photos uploaded from here.' } }, 429)
      : undefined));
    const onChange = vi.fn();
    renderWithProviders(<SitePhotoUpload onChange={onChange} />);

    await user.upload(screen.getByLabelText('Photos of the problem'), photo());

    expect(await screen.findByText(/Too many photos uploaded from here/)).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('takes no more than five, and lets one be removed to make room', async () => {
    const user = userEvent.setup();
    mockApi(({ method, path }) =>
      (method === 'POST' && path === '/public/lead-photos' ? uploaded(['a', 'b', 'c', 'd', 'e']) : undefined));
    const onChange = vi.fn();
    renderWithProviders(<SitePhotoUpload onChange={onChange} />);

    const six = ['1', '2', '3', '4', '5', '6'].map((n) => photo(`p${n}.png`));
    await user.upload(screen.getByLabelText('Photos of the problem'), six);

    expect(await screen.findByText(/Only 5 photos, so the rest were left out/)).toBeInTheDocument();
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(['a', 'b', 'c', 'd', 'e']));

    await user.click(screen.getByRole('button', { name: 'Remove p1.png' }));
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(['b', 'c', 'd', 'e']));
    // The thumbnail animates out, so it leaves the DOM a tick after the ids change.
    await waitFor(() => expect(screen.queryByAltText('p1.png')).not.toBeInTheDocument());
  });
});
