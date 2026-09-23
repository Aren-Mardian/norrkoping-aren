/**
 * Minimala typer för det vi använder av Origos globala API (window.Origo).
 * Origo distribueras som ett klassiskt script utan typdefinitioner; vi typar bara ytan vi rör.
 */

/** Det vi behöver av en OpenLayers-tile-källa i Origos OL-instans. */
interface OrigoTileSource {
  setTileUrlFunction(fn: (coord: readonly number[]) => string): void;
  setTileLoadFunction(fn: (tile: unknown, src: string) => void): void;
  setAttributions(attributions: string): void;
  on(type: string, listener: () => void): unknown;
  refresh(): void;
  /** Bumpar revisionen så att lagret ritas om även om inget annat ändrats. */
  changed(): void;
}

interface OrigoLayer {
  getSource(): OrigoTileSource;
  get(key: string): unknown;
}

interface OrigoMap {
  render(): void;
}

/** Origo exponerar sin egen OpenLayers under `Origo.ol` — höjdverktyget använder den (ADR-14). */
interface OrigoOl {
  geom: Record<string, unknown>;
  interaction: Record<string, unknown>;
  layer: Record<string, unknown>;
  source: Record<string, unknown>;
  style: Record<string, unknown>;
  Feature: unknown;
  Overlay: unknown;
}

interface OrigoViewer {
  getLayer(name: string): OrigoLayer | undefined;
  getMap(): OrigoMap;
  getProjectionCode(): string;
}

interface OrigoInstance {
  on(type: 'load', listener: (viewer: OrigoViewer) => void): void;
  api(): OrigoViewer;
}

interface OrigoStatic {
  (config: Record<string, unknown> | string, options?: Record<string, unknown>): OrigoInstance;
  readonly ol?: OrigoOl;
}

interface Window {
  Origo?: OrigoStatic;
}
