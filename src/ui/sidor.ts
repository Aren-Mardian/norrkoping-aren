/**
 * Kopplar länkarna märkta `data-sida` till informationssidorna (ADR-15).
 *
 * Det här är den ivriga delen och ska förbli liten: den vet bara vilka länkar som finns och
 * hämtar `sidor/dialog.ts` med `import()` först när någon visar avsikt. Texterna, renderaren
 * och stilarna ligger i den hämtade delen och når aldrig landningsvyns kritiska väg (NFK-02).
 *
 * Samma förhämtning som verktygsknappen använder: vid `pointerenter`, `focus` eller
 * `touchstart` börjar hämtningen, så klicket oftast möter en redan laddad modul.
 */
import { sidaFromHash, type SidaId } from '../sidor/ids.ts';

type Dialog = typeof import('../sidor/dialog.ts');

let pending: Promise<Dialog> | null = null;

function load(): Promise<Dialog> {
  pending ??= import('../sidor/dialog.ts');
  return pending;
}

async function open(id: SidaId): Promise<void> {
  const mod = await load();
  mod.openSida(id);
}

export function initSidor(): void {
  const links = document.querySelectorAll<HTMLElement>('[data-sida]');
  if (links.length === 0) return;

  for (const link of links) {
    const id = sidaFromHash(`#${link.dataset['sida'] ?? ''}`);
    if (!id) continue;

    const prefetch = (): void => void load();
    link.addEventListener('pointerenter', prefetch, { once: true });
    link.addEventListener('focus', prefetch, { once: true });
    link.addEventListener('touchstart', prefetch, { once: true, passive: true });

    link.addEventListener('click', (e) => {
      // Låt modifierade klick bli vanliga länkklick — den som vill öppna i ny flik ska få det.
      const me = e as MouseEvent;
      if (me.metaKey || me.ctrlKey || me.shiftKey || me.altKey || me.button !== 0) return;
      e.preventDefault();
      void open(id);
    });
  }

  // Delad adress: /projekt/norrkoping/#integritet öppnar sidan direkt. Ingen requestAnimationFrame
  // här — den körs inte i en flik som öppnats i bakgrunden, och då hade sidan förblivit stängd
  // tills fliken visades. `import()` är ändå asynkron, så kartans uppsättning hinner före.
  const fromHash = sidaFromHash(location.hash);
  if (fromHash) void open(fromHash);

  // Bakåtknappen efter ett internt hopp ska också fungera.
  window.addEventListener('hashchange', () => {
    const id = sidaFromHash(location.hash);
    if (id) void open(id);
  });
}
