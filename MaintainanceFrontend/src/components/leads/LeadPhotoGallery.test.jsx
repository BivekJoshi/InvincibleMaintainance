import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LeadPhotoGallery } from '@/components/leads/LeadPhotoGallery';
import { renderWithProviders } from '@/test/renderWithProviders';

const photos = [
  { id: 'p1', url: '/uploads/one.webp', thumb: '/uploads/one-400.webp', caption: 'Damp patch by the window' },
  { id: 'p2', url: '/uploads/two.webp', thumb: '/uploads/two-400.webp' },
  { id: 'p3', url: '/uploads/three.webp', thumb: '/uploads/three-400.webp' },
];

describe('the photos a customer sent', () => {
  it('shows nothing at all when there are none', () => {
    const { container } = renderWithProviders(<LeadPhotoGallery photos={[]} leadName="Sita Rai" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('opens the one that was chosen, and walks the rest with the arrow keys', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LeadPhotoGallery photos={photos} leadName="Sita Rai" />);
    expect(screen.getAllByRole('button', { name: /Open photo/ })).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: 'Open photo 2 of 3' }));
    const dialog = await screen.findByRole('dialog', { name: 'Photo 2 of 3 from Sita Rai' });
    expect(within(dialog).getByText('2 of 3')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /Full size/ })).toHaveAttribute('href', '/uploads/two.webp');

    await user.keyboard('{ArrowRight}');
    expect(within(dialog).getByText('3 of 3')).toBeInTheDocument();
    // Past the end it comes back to the first, which is the one with a caption.
    await user.keyboard('{ArrowRight}');
    expect(within(dialog).getByText('Damp patch by the window')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Previous photo' }));
    expect(within(dialog).getByText('3 of 3')).toBeInTheDocument();
  });

  it('names a photo for a screen reader, falling back to who sent it', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LeadPhotoGallery photos={photos} leadName="Sita Rai" />);
    expect(screen.getByAltText('Damp patch by the window')).toBeInTheDocument();
    expect(screen.getByAltText('Photo 2 sent by Sita Rai')).toBeInTheDocument();

    // A single photo needs no counter and no way to move.
    await user.click(screen.getByRole('button', { name: 'Open photo 1 of 3' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Next photo' })).toBeInTheDocument();
  });
});
