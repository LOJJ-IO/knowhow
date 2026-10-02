/** Book a Demo's company website check (user 2026-09-27), alongside
 *  `emailError`. Accepts what people actually type: `acme.com`,
 *  `www.acme.com`, `https://acme.com/about`. Needs a domain with a dot and a
 *  two-letter-or-longer ending, no spaces. Format only; nothing is fetched. */
const WEBSITE =
  /^(https?:\/\/)?([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(:\d+)?(\/\S*)?$/i;

/** Null when the address is fine; otherwise what to tell the person. */
export function websiteError(value: string): string | null {
  const site = value.trim();
  if (!site) return "Enter your company website.";
  if (!WEBSITE.test(site))
    return "Enter a valid website, like company.com.";
  return null;
}
