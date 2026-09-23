/**
 * Egna OpenLayers-kontroller. Alla knappar är ≥ 44×44 px (NFK-10) och ligger i
 * skärmens nedre tredjedel på mobil (UX-02) — placeringen styrs i style.css.
 */
import Control from 'ol/control/Control';
import type BaseLayer from 'ol/layer/Base';
import { t } from '../i18n/index.ts';
import { ORTO_YEARS, type BasemapId, type Basemaps, type OrtoYear } from './basemaps.ts';

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

/**
 * FK-02: växlare mellan karta, flygbild och mörk bakgrund. När flygbilden är vald fälls en
 * årtalsrad ut (Lantmäteriets referensårsmosaiker 1960/1975) — den tar ingen plats annars.
 */
export class BasemapSwitcherControl extends Control {
  private readonly buttons = new Map<BasemapId, HTMLButtonElement>();
  private readonly years = new Map<OrtoYear, HTMLButtonElement>();

  constructor(basemaps: Basemaps) {
    const element = document.createElement('div');
    element.className = 'ol-basemap-switcher ol-unselectable ol-control';
    super({ element });

    const row = document.createElement('div');
    row.className = 'ol-basemap-switcher__row';
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', t('map.basemap.groupLabel'));
    const entries: Array<[BasemapId, string]> = [
      ['topo', t('map.basemap.topo')],
      ['orto', t('map.basemap.orto')],
      ['dark', t('map.basemap.dark')],
    ];
    for (const [id, label] of entries) {
      const b = button(label, () => basemaps.setActive(id));
      this.buttons.set(id, b);
      row.appendChild(b);
    }

    const yearRow = document.createElement('div');
    yearRow.className = 'ol-basemap-switcher__years';
    yearRow.setAttribute('role', 'group');
    yearRow.setAttribute('aria-label', t('map.basemap.yearLabel'));
    yearRow.hidden = true;
    for (const year of ORTO_YEARS) {
      const b = button(String(year), () => basemaps.setOrtoYear(year));
      b.title = t('map.basemap.yearTitle').replace('{year}', String(year));
      this.years.set(year, b);
      yearRow.appendChild(b);
    }
    element.append(row, yearRow);

    const sync = (): void => {
      const active = basemaps.getActive();
      for (const [id, b] of this.buttons) {
        b.setAttribute('aria-pressed', String(id === active));
        // Flygbilden stängs av först om Lantmäteriet faktiskt vägrar leverera (ADR-16).
        if (id === 'orto') {
          b.disabled = !basemaps.isLmAvailable();
          b.title = b.disabled ? t('map.basemap.ortoUnavailable') : t('map.basemap.ortoTitle');
        }
      }
      yearRow.hidden = active !== 'orto' || !basemaps.isLmAvailable();
      const year = basemaps.getOrtoYear();
      for (const [y, b] of this.years) b.setAttribute('aria-pressed', String(y === year));
    };
    basemaps.onChange(sync);
    basemaps.onTopoFailure(sync);
    basemaps.onOrtoFailure(sync);
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
