import { useSyncExternalStore } from "react";
import { auth, signOutNow } from "../lib/auth";

// External store: the Robel auth client holds a referentially stable snapshot
// in an Effect Ref. `useSyncExternalStore` is the idiomatic React primitive for
// subscribing to it (see react-effect-decision skill, rule 7) and avoids a raw
// useEffect + useState mirror.
const subscribe = (notify: () => void): (() => void) =>
  auth.onChange(() => notify());

const getSnapshot = () => auth.state;

export function useAuth() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    phase: state.phase,
    isLoading: state.isLoading,
    isAuthenticated: state.isAuthenticated,
    token: state.token,
    signIn: auth.signIn,
    signOut: signOutNow,
  };
}
