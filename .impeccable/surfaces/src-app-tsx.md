---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

# Orders dashboard

Scope: the single-page orders dashboard (whole app). Mode: Operate.

Audience and job: London ops staff, office desktops in daylight, open all day. Scan orders, find a customer, filter by status, sort by date or total, read the paid value. Constraints: WCAG 2.2 AA, keyboard and screen reader, no invented brand name shown as fact, never borrow a protected transport identity (no roundel, no Johnston, no TfL line names).

Chosen direction: Station Wayfinding. Memorable moment: statuses read as line-colour bars, and the paid summary reads like a departures panel.

## Direction contract

THESIS: Order status is wayfinding. Each status owns one line colour used everywhere it appears (bar in the table, filter chip, summary). Refuses the grey stat-card row with a sidebar and pastel pills.

OWN-WORLD: White and cool-grey enamel ground, navy enamel header and summary panel, solid line bars (green paid, blue pending, amber refunded, red failed, purple chargeback, grey unknown), Hanken Grotesk at sign weights, tabular figures everywhere, 4-6px radii like enamel plates.

STORY: Ops see the approximate GBP paid value and its exact per-currency lines first, then narrow the table by status chip or search, and trust every repaired value because the row says what was repaired.

FIRST VIEWPORT: Navy header rail 72px with plain line-bar mark and "Orders". Below it a full-width navy summary panel: left third, "All paid orders", ≈ £ headline at ~64px, rate note; right two-thirds, three departures rows (currency, count, exact subtotal, converted). Then toolbar: labelled search left, status chip radio group right, result count. Then the table on white, line bar + text per status, local time with zone.

FORM: Station Wayfinding, my rank 1 of 7 grounded candidates, chosen as IMPECCABLE'S PICK; seed key 4280dd3a. Signature move: status as line-colour bars shared across filter, table and counts. Kept disciplines: nothing labelled twice; fixed slots per row with stated absences; one shared column module; poster-scale headline without card chrome; decimal-aligned tabular numerics.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

None.
