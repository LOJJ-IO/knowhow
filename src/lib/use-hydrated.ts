import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

function getSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

/** True once hydration has completed. Unlike `useEffect(() => setState(true), [])`,
 * `useSyncExternalStore` is React's built-in mechanism for values that
 * legitimately differ between server and client — it re-renders after
 * hydration without treating the initial mismatch as an error, and doesn't
 * trip the "setState in an effect" compiler rule. */
function useHydrated() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export { useHydrated };
