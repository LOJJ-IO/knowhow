/** Google's letter colours, shared by the landing's "Google Workspace" mark
 *  and anywhere else "Google" is written in colour. */
export const GOOGLE_LETTERS = [
  { char: "G", color: "#4285F4" },
  { char: "o", color: "#EA4335" },
  { char: "o", color: "#FBBC05" },
  { char: "g", color: "#4285F4" },
  { char: "l", color: "#34A853" },
  { char: "e", color: "#EA4335" },
] as const;

/** "Google" in its letter colours, in whatever type it sits in. */
export function GoogleWord() {
  return (
    <span aria-label="Google">
      {GOOGLE_LETTERS.map(({ char, color }, i) => (
        <span key={i} aria-hidden style={{ color }}>
          {char}
        </span>
      ))}
    </span>
  );
}
