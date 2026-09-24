# Bidra till Norrköpingskartan

Tack för att du tittar. Projektet är ett oberoende portfolio- och samhällsnytteprojekt av
Aren Mardian — **inte** en officiell tjänst från Norrköpings kommun. Kravbilden styr allt som
byggs och står i [docs/kravspecifikation.md](docs/kravspecifikation.md) (KRAV-NKPG-001).

## Vad som gäller innan du börjar

Kräver Node ≥ 22.12 (se `.nvmrc`).

```bash
npm install
npm run dev
```

Bakgrundskartan laddas inte ned automatiskt i dev. Saknas `data/derived/topowebb-farg.pmtiles`
faller appen tillbaka på OpenStreetMap med en synlig utvecklingsbanner — det är avsiktligt (FK-33),
och betyder att du kan bygga och testa allt utom kartografin utan Lantmäteriet-konto.

Innan du öppnar en pull request:

```bash
npm run check
```

Det kör typkontroll, tester, bygge och bundlebudget — samma sak som CI. Grön lokalt = grön i CI.

## Fyra regler som inte är förhandlingsbara

**1. Hemligheter når aldrig repot.** `LM_USER`, `LM_PASSWORD` och allt liknande finns bara i den
git-ignorerade `.env` och i hostingens miljövariabler. Allt med prefixet `VITE_` hamnar i
klientbundlen och är därmed publikt. `npm run scan:secrets` kör gitleaks på både historiken och
byggutdatan, och CI gör samma sak på varje push.

**2. Ny datakälla dokumenteras före den används.** Licens, attributionskrav, aktualitet och
eventuella begränsningar in i [data/SOURCES.md](data/SOURCES.md) *först* (JK-01). Attributionen ska
sedan synas i kartan och gå att härleda till rätt upphovsman — att kreditera fel källa är ett fel av
samma dignitet som att inte kreditera alls.

**3. Mätning sker aldrig planärt i Web Mercator.** I Norrköping ger det ~91 % längdfel.
`measureLength()` kastar hellre `ProjectionNotMeasurableError` än svarar fel (NFK-12). Sajten har ett
enda referenssystem, SWEREF 99 TM (EPSG:3006) — se
[docs/referenssystem.md](docs/referenssystem.md) och ADR-18. WGS 84 förekommer bara som dataformat.

**4. Kritiska vägen har en budget.** `npm run check:budget` bryter bygget om landningsvyns JavaScript
passerar 180 kB gzip eller om Origo hamnar i den (NFK-02, TK-05). Nya beroenden i startvägen behöver
en motivering som väger tyngre än sin storlek.

## Arkitekturbeslut

Större vägval dokumenteras som ADR i [docs/adr/](docs/adr/) — kontext, beslut, konsekvenser, och vad
som verifierades. Gamla ADR:er skrivs inte om när de blir inaktuella; de märks som ersatta och den
nya får ett eget nummer. Ändrar ett beslut något i kravspecen antecknas avsteget direkt vid kravet.

## Commit och pull request

Commit-meddelanden på svenska, i imperativ, med kravnummer eller ADR när det finns ett:
`Rätt attribution på kommungränsen (JK-01/JK-02)`. En pull request beskriver vad som ändrats, vilka
krav den rör och hur den verifierats.

## Licenser i repot

| Vad | Licens |
|---|---|
| Koden | MIT, se [LICENSE](LICENSE) |
| Data | Egen licens per källa, se [data/SOURCES.md](data/SOURCES.md) — mestadels CC BY 4.0 (Lantmäteriet) och CC0 |
| `public/vendor/origo-2.10.0/` | Origo, BSD 2-clause |
| Kuraterat innehåll och rankningar | © Aren Mardian |

Bidrag licensieras under MIT. Lägger du till data ansvarar du för att licensen tillåter användningen
och att den är dokumenterad enligt regel 2.
