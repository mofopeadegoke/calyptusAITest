# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + TypeScript + Vite, tested with Vitest, React Testing Library and vitest-axe. Single page, no backend. Data is loaded with `fetch` from a static `orders.json`.

## Users

The ops team of a small online shop that sells to customers in the UK, Europe and the US. The team is based in London. They work at office desktops in daylight, keep the dashboard open all day, and check it many times a day. They currently read a raw admin export.

## Product Purpose

An orders dashboard that replaces the raw export. Ops can scan orders, find a customer by name or email, filter by status, sort by date or total, and see the value of paid orders at a glance. Success means ops trust every number and time on screen without cross-checking the export.

## Positioning

It treats the export as untrustworthy input. Every repair to the data is visible on the row it affects, and every converted figure says that it is converted.

## Operating Context

- Orders arrive in GBP, EUR and USD with timestamps in many UTC offsets.
- Times are shown in the viewer's local time with the zone name (BST/GMT), en-GB format.
- The paid summary shows an approximate GBP total converted at fixed, dated rates, with exact per-currency subtotals beneath it.
- `?error=1` forces a real fetch failure. `?delay=<ms>` holds the loading state.

## Capabilities and Constraints

- Table columns: order ID, customer name and email, total, status, date and time, item count.
- Search by name or email, ignoring case and accents. Filter by status. Sort by date and total.
- Statuses seen: paid, pending, refunded, failed, chargeback. Unknown statuses pass through.
- Known data defects: null customer, empty name, string total, null total, zero paid total, very long name/email.
- Summary covers all paid orders regardless of filters.
- Filter state is not kept in the URL.

## Brand Commitments

None. The shop is unnamed. The design may create an identity but must not present an invented company name as fact.

## Evidence on Hand

`orders.json`, 24 orders from a real export. No logo, imagery or brand assets exist.

## Product Principles

1. Never show a number more precise than the data supports.
2. Show the repair, never hide it.
3. Reading speed beats decoration. Ops scan this many times a day.
4. Distinctive, not generic. It must not look like a stock SaaS admin template, and it must not feel cramped.

## Accessibility & Inclusion

WCAG 2.2 AA. Fully usable with keyboard and screen reader. Status never conveyed by colour alone.
