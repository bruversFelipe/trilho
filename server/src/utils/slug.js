/** Turns a display name into a URL/username-safe slug: lowercase, no accents,
 * no spaces or symbols - just [a-z0-9-]. Used to derive a login username from
 * the name someone types at signup, so nobody has to think one up themselves. */
export function slugify(input) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents (e.g. "a" + combining acute -> "a")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
