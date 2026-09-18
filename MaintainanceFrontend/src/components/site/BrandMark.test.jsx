import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BrandMark } from '@/components/site/BrandMark';

describe('BrandMark', () => {
  it('draws the uploaded logo when there is one', () => {
    const { container } = render(<BrandMark logoUrl="/uploads/logo.png" initial="G" />);
    expect(container.querySelector('img')).toHaveAttribute('src', '/uploads/logo.png');
    expect(screen.queryByText('G')).not.toBeInTheDocument();
  });

  it('falls back to the initial without a logo, or when the logo fails to load', () => {
    const { container, rerender } = render(<BrandMark initial="घ" />);
    expect(screen.getByText('घ')).toBeInTheDocument();
    rerender(<BrandMark logoUrl="/uploads/missing.png" initial="घ" />);
    fireEvent.error(container.querySelector('img'));
    expect(screen.getByText('घ')).toBeInTheDocument();
  });
});
