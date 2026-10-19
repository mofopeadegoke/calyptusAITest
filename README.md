# Orders dashboard

## What it is

A single-page dashboard for the ops team of a small online shop. It replaces reading the raw admin export. You can scan every order, find a customer by name or email, filter by status, sort by date or total, and see the value of paid orders at a glance.

The app treats the export as untrustworthy input. Every repair it makes to the data is shown on the row it affects, and every converted figure says that it is converted.

It is built with Vite, React 18 and TypeScript, and tested with Vitest, React Testing Library and vitest-axe. There is no backend. The app fetches `public/orders.json` at `/orders.json`.

## Running it

Use Node 20.19 or later (Vite 7 needs it).

```sh
npm install
npm run dev      # start the dev server, then open the URL it prints
npm test         # run the test suite (in the Europe/London time zone)
npm run build    # type-check and build to dist/
npm run preview  # serve the built app
```

Two URL switches help you see the other states:

- `?error=1` fetches `/orders.does-not-exist.json`, so the request really fails with a 404 and the error state appears.
- `?delay=2000` waits 2000 ms before fetching, so you can see the loading state. The value is clamped to 0 to 10000.

The dev and preview servers run with Vite's SPA fallback turned off (`appType: 'mpa'`). Without that, a missing file would return `index.html` with status 200 and `?error=1` would show a JSON error instead of a 404.

## Data issues found

| Order | What was wrong | What the dashboard does |
| --- | --- | --- |
| ORD-1004 | `customer` is `null`. | Shows "Unknown customer". The row has a "No customer record" data issue. The order is still counted in the paid total. |
| ORD-1005 | Very long name and email. | Shows them in full and wraps them. This is not a data issue. |
| ORD-1006 | `total` is the text `"149.50"`. | Reads it as €149.50 and counts it. The row says "Total was text in the export; read as 149.50". |
| ORD-1007 | `total` is `null`. | Shows "Total unavailable" and sorts it last. The order is pending, so the paid summary is not affected. If a paid order had no total, the summary would count it apart and say so. |
| ORD-1014 | `name` is an empty string. | Shows "(no name)" above the email. The row has a "Name blank in export" data issue. |
| ORD-1016 | A paid order with a total of 0. | Treats £0.00 as a real amount and includes it. The row has an informational "Paid order with a zero total" issue. |
| ORD-1019, ORD-1020 | Order IDs are not in time order. ORD-1019 was placed after ORD-1020. | Sorts by the timestamp, never by the ID. |
| All | Timestamps use many UTC offsets (Z, +01:00, +02:00, +03:00, +05:30, -04:00, -05:00, -07:00, -08:00). | Converts each to an instant and shows it in your time zone. The customer's own time is on hover and in the screen reader text. |

The parser also handles defects that are not in this file: unknown statuses, unreadable or offset-free timestamps, missing currency, non-numeric totals, and non-integer or negative item counts. Each becomes a stated absence plus a data issue on the row. A file that is not shaped like `{"orders": [...]}`, or a row with no order ID, is rejected with an error message.

## Decisions

**Currency conversion.** The headline is an approximate GBP total of all paid orders. EUR and USD are converted at fixed, illustrative rates dated 19 Oct 2026 (EUR 0.87, USD 0.79). These rates are not live and are not fetched from anywhere. They live in `RATES_TO_GBP` in `src/domain/money.ts`. Beneath the headline, each currency shows its exact subtotal, so nobody has to trust the conversion to read the real numbers. A currency with no rate is never treated as 1. It is listed as unconverted and left out of the headline.

**Rounding once per currency.** Amounts are integer minor units (pence, cents). Each currency's subtotal is summed exactly, then converted once with `Math.round`. Converting each order and adding the results would drift by pennies. On this file the headline is £4,410.36 (GBP £1,542.00, EUR €1,663.40 to £1,447.16, USD US$1,798.99 to £1,421.20).

**The summary ignores filters.** It always covers every paid order. A total that changes with the search box would be easy to misread as the business total.

**Times.** Times are shown in the viewer's time zone with the zone name, for example "13 Oct 2026, 05:10 BST", and switch to GMT after the clocks go back on 25 Oct 2026. The time in the customer's own offset, for example "12 Oct 2026, 21:10 (UTC−07:00)", is in the hover title and in visually hidden text for screen readers.

**Money formatting.** All money uses `Intl.NumberFormat('en-GB')`, which gives £, € and US$. US$ keeps dollars distinct from other dollar currencies.

**Sorting.** Sorting by total compares the plain number and ignores currency, so €1,099 sorts below £1,200. This is a scanning aid, not a value comparison. Missing totals and missing dates always sort last in both directions. Ties break by order ID so the order is stable. The default sort is date, newest first.

**Search.** Search matches the customer's name and email. It ignores case and accents, so "zoe" finds Zoë Müller. Surrounding spaces are ignored.

**Statuses.** Each known status has one entry in a registry (label and line colour) in `src/domain/status.ts`. A status that is not in the registry passes through with its raw text, a grey line bar, its own filter chip, and a data issue on the row.

**Light theme only.** The users work at office desktops in daylight and keep the dashboard open all day. A light theme suits that scene, and one well-checked theme is better than two half-checked ones.

**Accessibility.** The target is WCAG 2.2 AA:

- Status is always a text label plus a coloured line bar, never colour alone.
- The status filter is a real radio group (fieldset and legend), so arrow keys work.
- The result count is a polite live region.
- Sortable headers use `aria-sort` with a button inside. The table caption says how the table is sorted.
- Data issues are a `<details>` disclosure that you can reach with the keyboard.
- The error state uses `role="alert"` and moves focus to "Try again".
- The loading state sets `aria-busy` and announces "Loading orders…".
- The table scrolls inside a focusable, labelled region on narrow screens, so the page itself never scrolls sideways.
- vitest-axe checks the ready, loading, error and empty states. jsdom cannot measure colour contrast, so the colour tokens were checked against WCAG ratios separately.

## Limitations and next steps

- Search, filter and sort are not kept in the URL. A shared link always opens the default view.
- Rates are fixed. A real version would fetch dated rates and show their source.
- Money assumes two decimal places. Currencies such as JPY (0 decimals) or KWD (3 decimals) would need per-currency minor units.
- There is no pagination or virtualisation. That is fine for 24 orders, but a full export would need it.
