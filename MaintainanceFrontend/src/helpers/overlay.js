/**
 * Radix closes a dialog or sheet on a pointer-down outside it, and a toast is outside
 * it — a toast can sit right on top of a sheet's Save button. Pressing or dismissing a
 * toast must not throw away the form underneath.
 *
 * @param {(event: Event) => void} [handler] the caller's own onInteractOutside
 * @returns {(event: CustomEvent) => void}
 */
export function ignoreToastInteraction(handler) {
  return (event) => {
    const target = event.detail?.originalEvent?.target ?? event.target;
    if (target instanceof Element && target.closest('[data-toaster]')) {
      event.preventDefault();
      return;
    }
    handler?.(event);
  };
}
