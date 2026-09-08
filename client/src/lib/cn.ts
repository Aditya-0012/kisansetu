// Tiny classnames combinator — no dependency on clsx/tailwind-merge (both
// unavailable in this sandbox's package mirror; this covers our actual usage
// patterns: conditional strings, falsy skips, no need for Tailwind class
// de-duplication since we never emit conflicting utilities for the same
// property in one call site).
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
