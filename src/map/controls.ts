/**
 * Egna OpenLayers-kontroller. Alla knappar är ≥ 44×44 px (NFK-10) och ligger i
 * skärmens nedre tredjedel på mobil (UX-02) — placeringen styrs i style.css.
 */
import Control from 'ol/control/Control';
import { t } from '../i18n/index.ts';
import type { BasemapId, Basemaps } from './basemaps.ts';

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

/** FK-04: "Återställ vy" tar tillbaka kartan till startextent. */
export class ResetViewControl extends Control {
  constructor(onReset: () => void) {
    const element = document.createElement('div');
    element.className = 'ol-reset-view ol-unselectable ol-control';
    const b = button('⌂', onReset);
    b.title = t('map.resetView');
    b.setAttribute('aria-label', t('map.resetView'));
    element.appendChild(b);
    super({ element });
  }
}

/** FK-02: växlare mellan karta, flygbild och mörk bakgrund. */
export class BasemapSwitcherControl extends Control {
  private readonly buttons = new Map<BasemapId, HTMLButtonElement>();

  constructor(basemaps: Basemaps) {
    const element = document.createElement('div');
    element.className = 'ol-basemap-switcher ol-unselectable ol-control';
    element.setAttribute('role', 'group');
    element.setAttribute('aria-label', t('map.basemap.groupLabel'));
    super({ element });

    const entries: Array<[BasemapId, string]> = [
      ['topo', t('map.basemap.topo')],
      ['orto', t('map.basemap.orto')],
      ['dark', t('map.basemap.dark')],
    ];
    for (const [id, label] of entries) {
      const b = button(label, () => basemaps.setActive(id));
      this.buttons.set(id, b);
      element.appendChild(b);
    }

    const sync = (): void => {
      const active = basemaps.getActive();
      for (const [id, b] of this.buttons) {
        b.setAttribute('aria-pressed', String(id === active));
        // Flygbild finns bara hos Lantmäteriet — utan LM saknar knappen mening.
        if (id === 'orto') b.disabled = !basemaps.isLmAvailable();
      }
    };
    basemaps.onChange(sync);
    basemaps.onLmFailure(sync);
    sync();
  }
}
