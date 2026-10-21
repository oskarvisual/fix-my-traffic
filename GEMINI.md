# Fix My Traffic — Project Guidelines & Rules

## 1. User Interface & Display Language
- **MANDATORY**: All user-facing text, user interface elements, labels, buttons, modals, tooltips, dialogs, news headlines, articles, chyron tickers, reports, and notification messages on the website MUST be written in **English**.
- No Spanish in user-facing UI text, even when simulating Latin American cities (Lima, Buenos Aires, Santiago, Mexico City). The game interface, news broadcasts, opinion barometer, and inspection panels are exclusively in English.
- Real geographical names (e.g., *Av. Javier Prado*, *Av. 9 de Julio*, *Av. Providencia*, *Paseo de la Reforma*) and official names of transit systems (e.g. *Metropolitano*, *Línea 1 Metro*, *Metrobús*) retain their proper names, but descriptive labels, status texts, metrics, and journalistic coverage must be in English.

## 2. Code Quality & Consistency
- Strictly preserve TypeScript type safety (`npx tsc --noEmit` must pass with 0 errors).
- All tests in `tests/` must pass cleanly (`npm test`).
