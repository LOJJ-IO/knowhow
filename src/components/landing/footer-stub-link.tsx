"use client";

import Link from "next/link";

/** Footer links that look like links but don't navigate yet. */

export const FOOTER_LINK_CLASS =
  "cursor-pointer underline underline-offset-2 transition-transform duration-150 active:scale-95";

/** Footer destinations. With `href` it's a real route (`next/link`); without,
 *  a button stub until the route exists (avoids App Router soft-nav on
 *  `<a href="#…">` during Fast Refresh). */
export function FooterStubLink({
  href,
  children,
}: {
  href?: string;
  children: React.ReactNode;
}) {
  if (href)
    return (
      <Link href={href} className={`inline-block ${FOOTER_LINK_CLASS}`}>
        {children}
      </Link>
    );
  return (
    <button type="button" className={FOOTER_LINK_CLASS}>
      {children}
    </button>
  );
}
