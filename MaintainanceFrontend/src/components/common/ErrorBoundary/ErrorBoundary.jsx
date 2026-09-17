import { Component } from 'react';
import { ErrorFallback } from './ErrorFallback';

/** True when any key moved since the last render. Compared by identity, like a hook's deps. */
const keysChanged = (prev = [], next = []) =>
  prev.length !== next.length || prev.some((key, i) => !Object.is(key, next[i]));

/**
 * Catches a render error below it and shows `<ErrorFallback>` instead of a white screen.
 *
 * React only offers this as a class, so this is the one class component in the app.
 * Everything a caller tunes is a prop:
 *
 *   - `variant` — `'app'` fills the viewport (nothing else is left on screen);
 *     `'page'` fills a shell's content area, so the header and sidebar stay usable.
 *   - `resetKeys` — clear the error when any of these change. The route boundaries pass
 *     the pathname, so navigating away from a broken page is enough to recover.
 *   - `onError(error, info)` — where a crash reporter would hook in.
 *   - `fallback({ error, componentStack, reset })` — replaces the default screen.
 *
 * It does not catch errors in event handlers, effects' async work or RTK Query —
 * those never reach render. A query error is `ErrorState`'s job.
 *
 * @param {{
 *   children: import('react').ReactNode,
 *   variant?: 'app' | 'page',
 *   resetKeys?: unknown[],
 *   onError?: (error: Error, info: { componentStack: string }) => void,
 *   onReset?: () => void,
 *   fallback?: (props: { error: Error, componentStack: string, reset: () => void }) => import('react').ReactNode,
 * }} props
 */
export class ErrorBoundary extends Component {
  state = { error: null, componentStack: '' };

  static getDerivedStateFromError(error) {
    // A thrown non-Error (`throw 'x'`) still needs a message and a name to show.
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error, info) {
    this.setState({ componentStack: info?.componentStack ?? '' });
    this.props.onError?.(error, info);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && keysChanged(prevProps.resetKeys, this.props.resetKeys)) this.reset();
  }

  reset = () => {
    this.props.onReset?.();
    this.setState({ error: null, componentStack: '' });
  };

  render() {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;

    const { fallback, variant = 'page' } = this.props;
    if (fallback) return fallback({ error, componentStack, reset: this.reset });
    return <ErrorFallback error={error} componentStack={componentStack} onReset={this.reset} variant={variant} />;
  }
}
