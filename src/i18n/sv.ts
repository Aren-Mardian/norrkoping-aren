/** Svenska — källspråk. Nycklarna här definierar typen för alla språk (FK-34). */
export const sv = {
  'site.name': 'Norrköpingskartan',
  'a11y.skipToContent': 'Hoppa till innehåll',
  'nav.label': 'Huvudmeny',
  'nav.beaches': 'Badplatser',
  'nav.tools': 'Verktyg',
  'nav.about': 'Om',
  'map.heading': 'Karta över Norrköpings kommun',
  'map.ariaLabel':
    'Interaktiv karta över Norrköpings kommun. Panorera med piltangenterna, zooma med plus och minus.',
  'map.basemap.topo': 'Karta',
  'map.basemap.orto': 'Flygbild',
  'map.basemap.dark': 'Mörk',
  'map.basemap.groupLabel': 'Bakgrundskarta',
  'map.resetView': 'Återställ vy',
  'map.layer.kommungrans': 'Kommungräns',
  'map.status.fallback':
    'Lantmäteriets bakgrundskarta kunde inte hämtas just nu. Visar OpenStreetMap i stället.',
  'dev.noToken':
    'Utvecklingsläge: Lantmäteriets tjänster är inte konfigurerade (ingen .env) — flygbild saknas.',
  'dev.noTiles':
    'Utvecklingsläge: bakgrundskartan (data/derived/topowebb-farg.pmtiles) saknas — kör tools/extract_topowebb.py. Visar OpenStreetMap som fallback.',
  'intro.heading': 'Sevärdheter och badplatser i Norrköping',
  'intro.body':
    'Här växer en öppen kartportal fram: de tio mest sevärda platserna i kommunen och alla badplatser med aktuell badvattenstatus. Kartan bygger på Lantmäteriets bakgrundskartor i SWEREF 99 TM.',
  'footer.curated': 'Kuraterat innehåll och rankning © Aren Mardian.',
  'footer.sources': 'Datakällor och licenser',
  'footer.privacy': 'Integritet',
  'attribution.lantmateriet': '© Lantmäteriet',
  'attribution.osm': '© OpenStreetMap-bidragsgivare',
} as const;

export type MessageKey = keyof typeof sv;
