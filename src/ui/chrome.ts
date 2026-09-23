/**
 * Sidans ram: sidfotens placering och de uppgifter som bara är kända vid bygge (ADR-13).
 * Språkväxlaren togs bort 2026-09-23 — sajten är enspråkigt svensk (ADR-15).
 */
import { LM_ENABLED } from '../config/site.ts';
import { t } from '../i18n/index.ts';

const DESKTOP = '(min-width: 900px)';

/**
 * Sidfoten (#site-footer) är en list under kartan på desktop och sista blocket i panelens
 * scrollyta på mobil — ett DOM-element, flyttat vid brytpunkten. Källförteckningen är hopfälld
 * på desktop (listen ska vara låg) och utfälld i sheeten.
 */
export function placeFooter(panelBody: HTMLElement | null): void {
  const footer = document.getElementById('site-footer');
  if (!footer) return;
  const sources = footer.querySelector<HTMLDetailsElement>('#sources');
  const mq = window.matchMedia(DESKTOP);

  const place = (): void => {
    if (mq.matches) {
      if (footer.parentElement !== document.body) document.body.appendChild(footer);
      if (sources) sources.open = false;
    } else if (panelBody) {
      if (footer.parentElement !== panelBody) panelBody.appendChild(footer);
      if (sources) sources.open = true;
    }
  };
  mq.addEventListener('change', place);
  place();
}

/**
 * Fyller i det som bara är känt vid bygge: kartutsnittets datum, ortnamnsindexets hämtdatum och
 * antal namn, samt om flygbilden är aktiv. Siffrorna kommer ur datafilerna själva (vite define),
 * så sidfoten kan aldrig påstå något annat än vad som faktiskt levereras (JK-01).
 */
export function fillFooterFacts(): void {
  const topo = document.getElementById('source-topo');
  if (topo) {
    topo.textContent = t('footer.src.topo.body').replace('{date}', __TOPO_FACTS__.date).replace('{size}', __TOPO_FACTS__.size);
  }

  const ortnamn = document.getElementById('source-ortnamn');
  if (ortnamn) {
    ortnamn.textContent = t('footer.src.ortnamn.body')
      .replace('{date}', __ORTNAMN_FACTS__.date)
      .replace('{count}', __ORTNAMN_FACTS__.count);
  }

  const kommun = document.getElementById('source-kommun');
  if (kommun) kommun.textContent = t('footer.src.kommun.body').replace('{date}', __KOMMUN_RETRIEVED__);

  const orto = document.getElementById('source-orto');
  if (orto && !LM_ENABLED) orto.textContent = `${t('footer.src.orto.body')} ${t('footer.src.orto.pending')}`;
}
