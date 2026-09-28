/** One email check for every email field in Knohow (user 2026-09-27): the
 *  invite dialog, setup's invite screens and Book a Demo.
 *
 *  Stricter than `type="email"`, which accepts `name@company` with no dot.
 *  Format only: whether the address exists is only ever proven by Google
 *  when that person signs in. */
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/;

/** Null when the address is fine; otherwise what to tell the person. */
export function emailError(value: string): string | null {
  const email = value.trim();
  if (!email) return "Enter an email address.";
  if (!EMAIL.test(email))
    return "Enter a valid email address, like name@company.com.";
  return null;
}
