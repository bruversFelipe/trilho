/** Time-of-day greeting, based on the viewer's actual wall clock (unlike the
 * rest of the app's date handling, this is intentionally local time, not UTC -
 * it's about what time it really is for the person looking at the screen). */
export function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 6) return 'Boa noite';
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function firstName(fullName) {
  return (fullName || '').trim().split(/\s+/)[0] || '';
}
