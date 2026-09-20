/**
 * Egna OpenLayers-kontroller. Alla knappar är ≥ 44×44 px (NFK-10) och ligger i
 * skärmens nedre tredjedel på mobil (UX-02) — placeringen styrs i style.css.
 */
import Control from 'ol/control/Control';
import type BaseLayer from 'ol/layer/Base';
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
        // Flygbild finns bara hos Lantmäteriet — utan appkonto är knappen avstängd, med förklaring.
        if (id === 'orto') {
          b.disabled = !basemaps.isLmAvailable();
          b.title = b.disabled ? t('map.basemap.ortoUnavailable') : '';
        }
      }
    };
    basemaps.onChange(sync);
    basemaps.onTopoFailure(sync);
    sync();
  }
}

/** FK-05: tänd/släck ett enskilt lager, t.ex. kommungränsen. */
export class LayerToggleControl extends Control {
  constructor(layer: BaseLayer, label: string) {
    const element = document.createElement('div');
    element.className = 'ol-layer-toggle ol-unselectable ol-control';
    const b = button(label, () => layer.setVisible(!layer.getVisible()));
    const sync = (): void => b.setAttribute('aria-pressed', String(layer.getVisible()));
    layer.on('change:visible', sync);
    sync();
    element.appendChild(b);
    super({ element });
  }
}
