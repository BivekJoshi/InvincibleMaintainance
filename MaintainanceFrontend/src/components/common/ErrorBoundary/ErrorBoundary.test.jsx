import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '@/test/renderWithProviders';
import { ErrorBoundary } from './ErrorBoundary';
import { isChunkLoadError, sourceFrame } from '@/helpers/errorDetails';
import { RouteErrorBoundary } from './RouteErrorBoundary';

function Bomb({ explode = true }) {
  if (explode) throw new Error('Kaboom in Bomb');
  return <p>Safe</p>;
}

describe('ErrorBoundary', () => {
  // React logs every caught render error; keep the test output readable.
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('shows the fallback with developer details instead of crashing', () => {
    const onError = vi.fn();
    render(<ErrorBoundary onError={onError}><Bomb /></ErrorBoundary>);

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByText('Error: Kaboom in Bomb', { selector: 'code' })).toBeInTheDocument();
    expect(screen.getByText('Component stack')).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Kaboom in Bomb' }), expect.anything());
  });

  it('renders the tree again after Try again', async () => {
    let explode = true;
    const Flaky = () => <Bomb explode={explode} />;
    render(<ErrorBoundary><Flaky /></ErrorBoundary>);

    explode = false;
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByText('Safe')).toBeInTheDocument();
  });

  it('uses a custom fallback when given one', () => {
    render(<ErrorBoundary fallback={({ error }) => <p>Custom: {error.message}</p>}><Bomb /></ErrorBoundary>);
    expect(screen.getByText('Custom: Kaboom in Bomb')).toBeInTheDocument();
  });
});

describe('RouteErrorBoundary in a shell', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('recovers when the user follows a link', async () => {
    const Shell = () => (
      <div>
        <Link to="/fine">Go fine</Link>
        <RouteErrorBoundary>
          <Routes>
            <Route path="/broken" element={<Bomb />} />
            <Route path="/fine" element={<p>Fine page</p>} />
          </Routes>
        </RouteErrorBoundary>
      </div>
    );
    renderWithProviders(<Shell />, { path: '*', initialPath: '/broken' });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Go fine' }));
    expect(screen.getByText('Fine page')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('fallback helpers', () => {
  it('recognises a stale lazy chunk', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/JobsPage-abc.js'))).toBe(true);
    expect(isChunkLoadError(new Error('x is undefined'))).toBe(false);
  });

  it('finds the first frame from our own source', () => {
    const stack = [
      'Error: boom',
      '    at renderWithHooks (http://localhost:5400/node_modules/.vite/deps/chunk-X.js?v=1:11:22)',
      '    at JobsPage (http://localhost:5400/src/pages/admin/JobsPage.jsx?t=1726:45:12)',
    ].join('\n');
    expect(sourceFrame(stack)).toEqual({ file: '/src/pages/admin/JobsPage.jsx', line: 45, column: 12 });
    expect(sourceFrame('Error: nothing here')).toBeNull();
  });
});
