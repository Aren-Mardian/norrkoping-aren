/** Banners och statusrader — synliga indikatorer i stället för tysta fel (A5, FK-33). */

export function showDevBanner(message: string): void {
  const el = document.getElementById('dev-banner');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
}

export function showMapStatus(message: string): void {
  const el = document.getElementById('map-status');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
}

export function clearMapStatus(): void {
  const el = document.getElementById('map-status');
  if (!el) return;
  el.textContent = '';
  el.hidden = true;
}
