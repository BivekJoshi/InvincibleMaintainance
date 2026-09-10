import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useReducedMotion } from '@/three/motion/motionKit';
import { useLoginMutation } from '@/api/authApi';
import { useAuth } from '@/hooks/useAuth';
import { useZodForm, loginSchema, loginDefaults } from '@/form/formKit';
import { FIELD_ROLES } from '@/config/constants';
import { DEMO_PASSWORD } from './loginContent';

/** How long the "Access granted" wipe is allowed to hold the redirect. */
const CONFIRM_MS = 700;

/**
 * Everything signing in involves, kept out of the markup: the form, the
 * request, the one error message, and where the user lands afterwards.
 *
 * The page below it is then only a layout — which is what made it possible to
 * split the stage and the card into files of their own without threading a
 * dozen props through both.
 */
export function useLoginFlow() {
  const [login, { isLoading, isSuccess, error }] = useLoginMutation();
  const { isAuthenticated, isReady, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const reduced = useReducedMotion();

  const [capsLock, setCapsLock] = useState(false);
  const [focused, setFocused] = useState(null);
  const shake = useRef(0);

  const form = useZodForm(loginSchema, { mode: 'onTouched', defaultValues: loginDefaults });
  const { setValue, setFocus, watch } = form;

  // Drives the two-segment progress rail under the form. Cheap to compute and
  // it only ever reflects what is already on screen, so it leaks nothing.
  const values = watch();
  const ready = [
    loginSchema.shape.email.safeParse(values.email).success,
    values.password.length > 0,
  ];

  // The API answers every failure with one message, so this never reveals
  // whether the address exists.
  const serverError = error?.data?.error?.message
    ?? (error ? 'Could not reach the server. Check your connection and try again.' : null);

  // A new error must restart the shake even when the message is identical, so
  // the animation is keyed on a counter rather than on the text.
  useEffect(() => { if (error) shake.current += 1; }, [error]);

  const destination = useMemo(() => {
    // Keep the query string: a deep link into a filtered list is worth returning to.
    const from = location.state?.from;
    if (from) return `${from.pathname}${from.search ?? ''}`;
    return FIELD_ROLES.includes(role) ? '/tech' : '/admin';
  }, [location.state, role]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    // Let the confirmation read before the route changes — but only when motion
    // is welcome, and never long enough to feel like latency.
    if (reduced) {
      navigate(destination, { replace: true });
      return undefined;
    }
    const id = setTimeout(() => navigate(destination, { replace: true }), CONFIRM_MS);
    return () => clearTimeout(id);
  }, [isAuthenticated, destination, navigate, reduced]);

  return {
    form,
    ready,
    isLoading,
    isSuccess,
    isReady,
    serverError,
    shakeKey: shake.current,
    capsLock,
    focused,
    setFocused,
    onSubmit: form.handleSubmit((v) => { login(v); }),
    /** Caps Lock is reported by the event, not by any state we can poll. */
    onPasswordKey: (e) => setCapsLock(e.getModifierState?.('CapsLock') ?? false),
    clearCapsLock: () => setCapsLock(false),
    fillDemo: (email) => {
      setValue('email', email, { shouldValidate: true });
      setValue('password', DEMO_PASSWORD, { shouldValidate: true });
      setFocus('password');
    },
  };
}
