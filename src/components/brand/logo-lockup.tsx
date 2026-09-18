import { LogoMark, sohne } from "@/components/brand/logo-mark";
import { lojjFont } from "@/components/brand/fonts";

/** "Kn⬡how™ by LOJJ.io" lockup. `as` lets pages that own their own <h1>
 *  (e.g. the legal pages) render the wordmark without a second heading. */
function LogoLockup({
  fontSize,
  as: Heading = "h1",
  byTop = "0.60em",
}: {
  fontSize: string;
  as?: "h1" | "div";
  /** Offset of the "by LOJJ.io" line from the lockup's top. */
  byTop?: string;
}) {
  return (
    <div
      className="relative inline-block -translate-y-[10%] text-[#1c1917]"
      style={{ fontSize }}
    >
      <Heading
        className={`${sohne.className} m-0 inline-flex items-start leading-none tracking-tight`}
      >
        <span className="inline-flex items-center">
          Kn
          <LogoMark className="mx-[0.04em] h-[0.71em] w-[0.62em] shrink-0 translate-x-[5%] translate-y-[10%]" />
          how
        </span>
        <span
          className="ml-[0.02em] mt-[0.08em] text-[0.22em] leading-none"
          aria-hidden
        >
          ™
        </span>
      </Heading>
      <p
        className="absolute right-[0.28em] m-0 whitespace-nowrap leading-none"
        style={{ top: byTop }}
      >
        <span className={`${sohne.className} text-[0.26em] tracking-tight`}>
          by{" "}
        </span>
        <span className={`${lojjFont.className} text-[0.26em]`}>LOJJ.io</span>
      </p>
    </div>
  );
}

export { LogoLockup };
