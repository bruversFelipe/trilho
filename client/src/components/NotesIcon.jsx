/** Small "has a description" indicator - three lines, like a note/paragraph.
 * Shown next to a task's title whenever `description` is non-empty, so you
 * know there's more to read without having to open every task to check. */
export default function NotesIcon({ className }) {
  return (
    <svg
      viewBox="0 0 12 12"
      width="9"
      height="9"
      className={className}
      aria-hidden="true"
    >
      <line x1="1" y1="2.5" x2="11" y2="2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="1" y1="9.5" x2="7.5" y2="9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
