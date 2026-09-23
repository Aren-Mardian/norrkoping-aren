# ADR-17 — Omdirigeringar och headers levereras som filer, inte som byggkonfiguration

**Status:** Beslutad 2026-09-23. Ersätter den del av [ADR-12](ADR-12-csp-per-sida-och-dev-funktioner.md)
som beskriver *hur* reglerna levereras. Beslutet om CSP per sida (meta) står kvar.

## Kontext

Sajtens omdirigeringar och HTTP-headers låg i `netlify.toml`. Under tre veckor gav det beteenden
vi felaktigt tolkade som egenheter i Netlifys regelmatchning ("den generella regeln vinner oavsett
ordning", ADR-12). Den 2026-09-23 kunde orsaken mätas exakt:

- Deploy-sammanfattningen för commit `f7a1965` rapporterade **2 redirect-regler och 3 headerregler**.
- Repots `netlify.toml` innehöll då **8 respektive 4**, och samma fil på GitHubs `main` likaså.
- 2 och 3 är precis vad repots **allra första commit** (`1dd5944`) hade, och de headers sajten
  faktiskt skickade — full strikt CSP på `/*` och `Cache-Control: no-cache` på `/projekt/norrkoping/*` —
  motsvarade den filen rad för rad.
- Samtidigt uppdaterades **koden** normalt: den nya kartan, verktygsknappen och sökrutan var live.

Netlify byggde alltså rätt commit och publicerade rätt filer, men tillämpade en gammal version av
byggkonfigurationen. Konsekvenserna var reella: Origos paneler blev ostylade (headerns `style-src`
saknade `'unsafe-inline'` och webbläsaren tillämpar snittet av header och meta), cachning slogs ut,
och SPA-fallbacken gjorde att saknade filer svarade **200 med index.html** i stället för 404 — vilket
i sin tur dolde att Origos sidrelativa bilder låg på fel sökväg efter ADR-15.

## Beslut

1. **`netlify/rules.ts` är enda källan** till omdirigeringar och headers. Modulen exporterar
   listorna och renderar dem som `_redirects` och `_headers`.
2. **Vite skriver filerna i publiceringsroten** (`dist/`) i `closeBundle`. De laddas därmed upp som
   vilka filer som helst i deployen och kan inte bli gamla på vägen — till skillnad från
   byggkonfiguration, som läses ur en kanal vi inte kan inspektera.
3. **`netlify.toml` behåller bara det som måste läsas innan bygget startar:** byggkommando,
   publiceringsmapp, nodeversion och funktionskatalog. Inget som rör runtime-beteende ligger kvar.
4. **Fångstregeln ger 404, inte index.html.** Saknad fil under `data/`, `vendor/`, `img/`, `assets/`
   eller någon okänd adress svarar `404.html` med status 404. Statiska filer som finns serveras före
   omdirigeringar, så regeln träffar bara det som verkligen saknas. Ett fel ska synas som ett fel.

## Konsekvenser

- **Omdirigeringarna slår igenom direkt**, även om Netlify fortfarande använder den gamla
  konfigurationen: `_redirects` utvärderas före `netlify.toml`-omdirigeringar.
- **Headerna gör det inte nödvändigtvis.** Vid konflikt om samma header och sökväg vinner
  `netlify.toml` över `_headers`. Så länge den gamla konfigurationen sitter kvar fortsätter dess
  `/*`-CSP att gälla. Det måste lösas på Netlify-sidan — se driftnotisen i README. Sajten är
  konstruerad för att fungera ändå (ADR-16): spritarna döljs av en klass, kartan ritas, och
  flygbilden avgörs vid körning. Det som återstår under den gamla headern är att Origos paneler
  ritas ostylade.
- **Reglerna går att testa lokalt**: `netlify/rules.ts` är vanlig TypeScript och typkontrolleras
  med resten av koden. `dist/_redirects` och `dist/_headers` kan läsas efter varje bygge.
- **Verifierat 2026-09-23:** bygget skriver båda filerna i `dist/`, 10 omdirigeringar och
  4 headerblock, 67 tester gröna, budgetarna oförändrade (160,0 kB kritisk väg).
