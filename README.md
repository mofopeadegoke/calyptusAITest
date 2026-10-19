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
| All | Timestamps use many UTC offsets (Z, +01:00, +02:00, +03:00, +05:30, -04:00, -05:00, -07:00, -08:00). | Converts each to an instant and shows it in your time zone. The customer's own time is printed under it. |

The parser also handles defects that are not in this file: unknown statuses, unreadable or offset-free timestamps, missing currency, non-numeric totals, and non-integer or negative item counts. Each becomes a stated absence plus a data issue on the row. A file that is not shaped like `{"orders": [...]}`, or a row with no order ID, is rejected with an error message.

## Decisions and tradeoffs

Each row is a choice made while planning or building, what else was on the table, and what the choice costs.

### Data and money

| Decision | Alternatives considered | Why | Cost |
| --- | --- | --- | --- |
| All validation happens in one place, `src/domain/parseOrders.ts`. The rest of the app trusts the typed `Order`. | Checking fields where each component uses them. | One file owns every repair, so each repair is listed and tested once. | The parser is the one place that must change when the export format changes. |
| Money is stored as integer minor units (pence, cents). | Keeping the floats from the export (`89.9`, `99.99`). | Adding floats drifts by fractions of a penny. Integers add exactly. | Assumes two decimal places. JPY or KWD would need per-currency minor units. |
| A text total like `"149.50"` is read as a number, with a visible note. | Treating it as invalid and dropping it from sums. | The value is unambiguous, and dropping it would understate paid revenue by €149.50. | A malformed export could pass a wrong value through. The note makes that visible. |
| A missing total shows "Total unavailable", sorts last, and is left out of sums. If a paid order has no total, the summary says so. | Treating it as 0. | 0 is a real amount (see ORD-1016). Using it for "unknown" would hide the gap. | The paid total is a lower bound when any paid total is missing. The summary says this. |
| A £0.00 paid order counts as real, with a quieter "note" rather than a defect. | Flagging it as an error. | Vouchers and free replacements are plausible. Ops should see it, not be alarmed by it. | A genuine export bug that writes 0 only gets a note. |
| A row with no order ID rejects the whole file, with an error message. | Skipping that row silently. | An order you cannot identify cannot be checked against anything. A silent skip would understate totals. | One bad row blocks the whole dashboard until the export is fixed. |
| A timestamp with no UTC offset is treated as unknown. | Reading it as the viewer's local time. | Guessing the zone would put the order on the wrong day for some customers. | Such an order sorts last by date. |

### The paid summary

| Decision | Alternatives considered | Why | Cost |
| --- | --- | --- | --- |
| The headline is an approximate GBP total, converted at fixed, dated rates (EUR 0.87, USD 0.79, as of 19 Oct 2026). | (a) Per-currency subtotals only, with no single total. (b) Live rates from a public API. (c) The rate on each order's own date. | The product owner wanted one GBP figure. (a) was the original recommendation. It was overruled in favour of a single figure. (b) adds a second way for the page to fail. (c) needs data we don't have. | The rates are illustrative, not real. A converted total can't be reconciled against a bank statement. So the headline is marked "≈" and the exact subtotals stay next to it. |
| Each currency's subtotal is converted once and rounded once. | Converting and rounding each order, then adding. | Fewer roundings means less error. | None found. |
| A currency with no rate is listed but left out of the GBP headline. | Treating a missing rate as 1:1. | 1:1 would be a silent, wrong number. | The headline can leave out a currency. The summary names it when it does. |
| The summary always covers all paid orders, whatever the filters. | Making it follow the search and status filter. | Picking "Refunded" would turn the paid total into £0, which reads like a business fact. | You can't read a paid subtotal for a filtered subset. |
| The headline shows pence (≈ £4,410.36). | Rounding converted figures to whole pounds. | The product owner approved the format with pence. The design review challenged it. | Pence suggest more precision than fixed rates give. "≈" and the rate note carry that warning. |

### Time, money display, search and sorting

| Decision | Alternatives considered | Why | Cost |
| --- | --- | --- | --- |
| Times are in the viewer's zone with the zone name, for example "13 Oct 2026, 05:10 BST". | Without the zone name, or relative ("3 days ago"). | The clocks change on 25 Oct. BST or GMT removes doubt, and relative times hide the actual day. | A longer cell. |
| The customer's own time is printed under the local time. | A hover tooltip (the first build). | The design review pointed out that a tooltip can't be reached by keyboard or touch. | One more line per row. |
| Money uses en-GB formatting: £, €, US$. | Plain `$`, or ISO codes (`USD 99.99`). | US$ can't be mistaken for another dollar, and reads naturally to a London team. | None found. |
| Sorting by total compares the plain number, ignoring currency. Missing values always sort last. | Grouping by currency, then sorting by amount within each group. | Grouping hides what "sort by total" means. It's a scanning aid, not a value comparison. | €1,099 and £1,200 sort side by side even though their GBP values differ. |
| Sorting by date uses the timestamp, never the order ID. | Order ID as a proxy for date. | IDs are not in time order in this export (ORD-1019 came after ORD-1020). | None found. |
| Search covers name and email, ignores case and accents, and updates as you type with no delay. | Adding order ID. Waiting for Enter. Waiting between keystrokes. | The brief asked for name or email. Filtering 24 rows is instant. "zoe" should find Zoë. | Order ID isn't searchable. A full export would need a delay between keystrokes. |
| Search, filter and sort are not kept in the URL. | Storing them in the query string. | Not in the brief, and the URL already carries `?error` and `?delay`. | A shared link always opens the default view. |

### States, layout and accessibility

| Decision | Alternatives considered | Why | Cost |
| --- | --- | --- | --- |
| `?error=1` fetches a file that doesn't exist, so the request really fails with a 404. | Throwing a pretend error in code. | It exercises the real failure path. | Vite's dev server returns `index.html` for unknown paths, so it needed `appType: 'mpa'`. A production host with the same fallback would need the same fix. |
| "No orders match" and "the export has no orders" are separate screens. | One shared empty message. | Each needs a different fix: clear the filters, or check the export. | One more state to test. |
| Data repairs are printed under the value they affect. | A collapsed "Data issue" disclosure under the order ID (the first build). | The review pointed out it hid the repair away from the value it repaired. Ops shouldn't have to open anything to see that a number was changed. | Taller rows on defective orders. |
| Long names and emails wrap. The table scrolls sideways inside its own region on narrow screens. | Cutting text off with "…" and a tooltip. | Tooltips fail keyboard and screen-reader users, and ops need the full email. | Taller rows for ORD-1005. On phones you scroll the table sideways. |
| The status filter is a native radio group styled as chips. | A `<select>`, or custom toggle buttons. | Arrow keys and screen-reader announcements come built in. Counts are visible at a glance. | It takes more width than a select. It wraps on phones. |
| Light theme only. | Light and dark. | Office desktops in daylight, open all day. One theme checked properly beats two half-checked. | No dark mode for people who prefer it. |
| WCAG 2.2 AA. Status is always text plus a colour bar. Results are announced in a live region. Sort headers are buttons with `aria-sort`. Error focus moves to "Try again". | | | Contrast can't be checked in jsdom. The axe tests skip that rule, and the colours were checked separately with a script. |

### Stack and design

| Decision | Alternatives considered | Why | Cost |
| --- | --- | --- | --- |
| React 18 + TypeScript + Vite. | Plain HTML/JS. Svelte or Vue. | Strict types let the parser hand the app a clean `Order`. Vite brings Vitest. | A build step and a `node_modules` folder for a one-page tool. |
| Unit and component tests (Vitest, Testing Library, vitest-axe). The finished page was checked by hand in a real browser. | A Playwright end-to-end test suite. | Reviewers can run `npm test` with nothing else installed. | There are no automated tests in a real browser. |
| The "Station Wayfinding" look. Each status has one line colour used in the filter, the table and the counts, and the paid summary reads like a departures board. | A parcel-label look, a dark transit-map look, and a standard admin template. All four were sketched as throwaway HTML, which is not committed. | The team works in London. The colour coding is functional, not decoration. | Its colours must not drift into copying a real transport brand. The build has no roundel, no Johnston typeface and no line names. |

## How AI was used, and how its output was checked

The whole project was built with Claude Code. Here's what the AI did at each stage, and what checked it.

1. **Planning by interview.** Before any code, the AI audited `orders.json` and listed every oddity it found. It then asked 23 design questions in rounds, each with a recommended answer. A person decided every one. One recommendation was overruled: the GBP conversion. The AI said why it disagreed, then built what was decided.
2. **Design options, not one design.** The AI proposed four visual directions as HTML sketches with written tradeoffs. A person picked one. The brief was written down before any UI code.
3. **A subagent wrote the code** from a written brief: the data types, the exact paid figures the tests must produce (£4,410.36), and the accessibility requirements. It did its work in a separate git worktree.
4. **Checks on the subagent's work:**
   - `npm test` (80 tests) and `npm run build` were re-run independently rather than taken from the subagent's report.
   - The builder broke the code on purpose to prove the tests catch it. Removing the focus call, hard-coding `aria-sort`, and running the time tests outside London each made tests fail.
   - The page was driven in a real browser at 1440px and 390px: `?error=1` gives a real 404 and focus lands on "Try again"; `?delay` shows the loading state; "zoe" finds Zoë Müller; the empty search state appears; arrow keys move the status filter; Enter on the Total header sorts and updates `aria-sort` and the caption; the page never scrolls sideways on mobile.
   - The README was checked against the code. For example, the parser does reject a row with no ID, and the summary does report paid orders with no total.
5. **Independent design review.** A separate reviewer agent, which hadn't written the code, compared screenshots against the brief and returned "fix" with 8 findings:
   - **Fixed:** issue notes no longer use the Failed colour, repairs are shown in their cells, the customer's time is visible, the logo no longer looks like a menu button, the loading placeholder matches the summary height, and the page scrollbar is themed.
   - **Dismissed:** one finding was a false alarm (the reviewer couldn't see a log that existed). Another reopened a format the product owner had already approved (pence in the headline).

   Each fix was re-tested in the browser.
6. **Not done:** a second review round to score the fixes, and a written design-system file.

Commit `d090b69` is larger than the rest. It holds the hook, the components, the CSS and their tests together, because they were written as one piece.

## Limitations and next steps

- Rates are fixed and illustrative. A real version would fetch dated rates and name their source.
- Money assumes two decimal places.
- No pagination or virtualisation. That's fine for 24 orders, but a full export would need both.
- Search, filter and sort are not kept in the URL.
- One row with no ID blocks the whole file. A real version might show the valid rows with a banner instead.
