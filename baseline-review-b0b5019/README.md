# POLIRE

Next.js-Website für POLIRE mit zentral gepflegten DE-/EN-Inhalten.

Bearbeitung, Projektstruktur, Tests und Veröffentlichung: [EDITING.md](./EDITING.md).

## Entwicklung

```sh
pnpm install --frozen-lockfile
pnpm dev
```

## Produktionsprüfung

```sh
pnpm build
pnpm test
```

Die fehlenden Betreiberangaben werden in `app/content.js` unter `legalIdentity` ergänzt.
