# Paper portfolio

## Problem Statement

The operator wants one local place to practice a book of stock and ETF listings, including listings outside the US, and to see whether each listing and the whole book made or lost money. Brokerage apps require a real account. Browser tools either declare holdings with no cash, or paper-trade without a durable book. Public trackers also keep positions on someone else's server.

The operator wants to buy and sell at each session's official close, see day gain and total gain while shares are held, and see realized gain after a sell. Mistakes should be removable. The book should still be there after a browser reset.

## Solution

A single-page web app, run locally in Docker for one operator, with no accounts. The operator searches for a listing, buys and sells whole shares against cash that starts at $100,000, and reads equity, day gain, total gain, and realized gain for the book and for each listing. Closes and FX closes come from EODHD once a finished session is missing. The book is a SQLite file on a Docker volume. The page shows an equity chart, the listing list, the selected listing's daily bars, and the activity list.

## User Stories

1. As the operator, I want the app to open on one page, so that I can search, trade, and read the book without changing screens.
2. As the operator, I want the book to start at $100,000 cash and no listings, so that I begin from a known paper portfolio.
3. As the operator, I want cash to change only when I buy, sell, or delete a trade, so that I cannot deposit or withdraw after the book exists.
4. As the operator, I want no control that wipes every trade and returns cash to $100,000, so that leaving the book is a sell or a deletion of one trade.
5. As the operator, I want to submit a search once, so that a name or symbol resolves to a listing without a call on every keystroke.
6. As the operator, I want to pick `7203.TSE` from the search results, so that Toyota on Tokyo is a different listing from any other symbol.
7. As the operator, I want `BHP.US` and `BHP.AU` to be different listings, so that the same symbol on two exchanges is not one position.
8. As the operator, I want to buy and sell only common stocks and ETFs, so that options, crypto, forex, funds, and bonds stay out of the book.
9. As the operator, I want symbol, exchange, trading currency, and a manual mark when search returns nothing, so that I can still record a listing the feed does not know.
10. As the operator, I want a manual mark to be in the listing's trading currency, so that a London price stays in pence when the feed quotes pence.
11. As the operator, I want the mark to become the close once a later fetch succeeds, so that a typed price is only the fallback.
12. As the operator, I want to buy a whole number of shares, so that a fractional share is refused.
13. As the operator, I want the fill to be the latest close already stored, so that a buy at 10:00 ET uses the prior session's close.
14. As the operator, I want a close fetched later to update the mark and leave the fill unchanged, so that Tuesday's close does not rewrite Monday's trade.
15. As the operator, I want the fill to be the manual mark when the listing has no close, so that I can still buy that listing.
16. As the operator, I want cash to fall by shares times the fill, converted at that day's FX close, so that the buy spends the reporting currency.
17. As the operator, I want no commission on a fill, so that cash moves by the trade amount alone.
18. As the operator, I want a buy refused when cash would go negative, so that I cannot hold shares I did not pay for.
19. As the operator, I want to sell part of a position, so that 4 of 10 shares can leave the book.
20. As the operator, I want a sell refused when it exceeds the shares held, so that the book stays long only.
21. As the operator, I want a sell to return cash at the fill and that day's FX close, so that the exit is paid in the reporting currency.
22. As the operator, I want average cost to stay the same when I sell, so that the shares I still hold keep their share-weighted fill.
23. As the operator, I want realized gain to lock in on the sell, so that the gain remains after those shares are gone.
24. As the operator, I want realized gain in USD to use the FX close on the sell date for proceeds and the FX closes on the buy dates for cost, so that a later move in the yen does not rewrite it.
25. As the operator, I want a yen price gain and a USD realized loss to both be visible, so that I can see that the official result is the reporting-currency one.
26. As the operator, I want day gain on the shares still held, so that a same-day sell does not keep those sold shares in the day's open gain.
27. As the operator, I want total gain on the shares still held, so that it is the open gain and not the realized gain.
28. As the operator, I want day return and total return as rates, so that I can read the gain as a percent.
29. As the operator, I want total return measured in the trading currency, so that a move against the dollar does not change that percent.
30. As the operator, I want the book to sum day gain and total gain across open positions in USD, so that the columns add up to the book figures.
31. As the operator, I want the book to sum realized gain across every sell, including listings I no longer hold, so that closed exits stay in the official total.
32. As the operator, I want cash left out of those gain sums, so that uninvested dollars are not a gain.
33. As the operator, I want a sold-out listing to stay on the list with 0 shares, day gain $0, and total gain $0, so that its realized gain still has a row.
34. As the operator, I want weight as the position's USD market value over equity, so that I can see how much of the book each open listing is.
35. As the operator, I want equity to be cash plus every open position at its mark, in USD, so that the master chart is the whole book.
36. As the operator, I want the equity series to start the day the book is created, at $100,000, so that the chart has a beginning before the first trade.
37. As the operator, I want each equity point to use the shares held that day, that session's close, and that date's FX close, so that history is not repriced with today's yen.
38. As the operator, I want a listing with no newer close to keep its previous close in that equity point, so that a US holiday still includes Friday's US listing next to Monday's Tokyo listing.
39. As the operator, I want a missing FX close to leave that listing out of that equity point, so that yen and pence are never added raw.
40. As the operator, I want the equity chart to be a USD line, so that I can see the book over sessions.
41. As the operator, I want the selected listing's chart to stay beside that line, so that choosing a row does not replace the book chart.
42. As the operator, I want the listing chart to be daily candlesticks of the traded open, high, low, and close, plus volume, in the trading currency, so that I can read the session the fill came from.
43. As the operator, I want one year of daily bars the first time I trade a listing, so that the chart has history on the free data window.
44. As the operator, I want the detail of a listing to show shares, average cost, mark, market value, weight, day gain, total gain, realized gain, day return, and total return, so that the row and the detail agree.
45. As the operator, I want total gain repeated in the trading currency when that currency is not USD, so that I can read the yen or pence gain beside the USD gain.
46. As the operator, I want the activity list to show every buy and sell, so that I can see the fills that built the book.
47. As the operator, I want delete to ask me to confirm, so that a mis-click does not rebuild the book.
48. As the operator, I want a confirmed deletion to remove that trade and rebuild cash, shares, average cost, gains, and equity as if it was never recorded, so that a typo is not a sell.
49. As the operator, I want deletion of a buy refused while a later sell still depends on those shares, so that I delete the sell first.
50. As the operator, I want a split to change share count and average cost and leave the position's value unchanged, so that a 2-for-1 does not look like a crash in the book.
51. As the operator, I want the candlesticks to stay the traded prices across a split, so that the chart shows the gap the session actually printed.
52. As the operator, I want a manual-mark listing to keep the share count I traded when there is no split feed, so that an unknown listing is not adjusted by guesswork.
53. As the operator, I want a cash dividend to leave cash unchanged, so that v1 does not invent income the book does not record.
54. As the operator, I want opens of the app to fetch a listing only after its session has finished and only when that close is missing, so that one listing costs one call per session.
55. As the operator, I want a closed exchange's published bar to count as the close on a holiday or half-day, so that I do not keep a separate holiday calendar.
56. As the operator, I want the EODHD key to stay in the container, so that the page never sees it.
57. As the operator, I want the book in a SQLite file on a Docker volume, so that clearing site data does not drop a trade.
58. As the operator, I want the browser to keep no second copy of the book, so that one container is the only writer.
59. As the operator, I want the page set in Geist Serif Regular with round dots, so that the UI uses the chosen face.
60. As the operator, I want numeric columns at a fixed width, so that a longer price does not shove the row.

## Implementation Decisions

- Four modules. The book is the deep one: no database and no HTTP. It opens at $100,000 cash. It records a buy or a sell at a fill, refuses a sell larger than the shares held, and refuses a deletion that would leave a later sell without shares. A deletion rebuilds the book from the trades that remain. It applies closes, FX closes, and splits. Its view returns cash, equity, the equity series, and for each listing the shares, average cost, mark, market value, weight, day gain, total gain, realized gain, day return, and total return. Sold-out listings stay in that view with zero shares. Each buy stores the reporting-currency amount it spent, at the FX close on the buy date, so a later sell can subtract that cost. Realized gain uses the FX close on the sell date for proceeds.
- The quote source is the only EODHD client. It searches, returns one year of daily bars the first time a listing is traded, and returns an FX close. It requests a listing's end-of-day history only when that finished session's close is not already stored. It does not call the live quote endpoint. An unknown listing comes back empty so the page can ask for a manual mark. London prices keep the trading currency the feed reports, including pence.
- The book store is the SQLite file on the Docker volume and the only writer. It loads the book, appends a trade, deletes a trade, and stores closes and FX closes. The Node API is the only caller.
- The page is one React view. It searches, buys, sells, and asks before it deletes. It shows equity, day gain, total gain, and realized gain for the book, with cash on the trade form. The equity chart is a USD line. The selected listing keeps that chart on the page and adds daily candlesticks, volume, and the listing figures. Gains are displayed from the book view. The page does not compute them. Each region is its own component: book figures, trade form, equity chart, listing list, listing detail, and activity list.
- Page styles are component CSS, organized with cascade layers. The layers, from lowest priority to highest, are reset, tokens, then components. Reset holds the baseline. Tokens hold the shared type, color, and spacing, including Geist Serif Regular with round dots. Each component's rules live in the components layer and read those tokens. Every author rule belongs to one of these layers, so the order stays the one declared above. A component styles its own elements. It does not restyle another component's markup.
- One container builds the page with Vite and serves it with the Node API. The EODHD key is container configuration. TypeScript throughout. Listing charts and the equity chart use Lightweight Charts. Words use Geist Serif Regular with round dots. Numeric columns use a fixed width.
- A listing is stored with the vendor symbol form, symbol plus exchange. The reporting currency is US dollars. Fills have no commission. Share counts are whole numbers. Average cost is the share-weighted fill of the shares still held. The mark is the latest close, or the manual mark when no close exists. A newly stored close does not change an existing fill.
- Catch-up runs when the app opens. A session is that listing's exchange trading day. The close is whatever end-of-day bar the vendor published for that session.

## Testing Decisions

A good test exercises the module's external behavior. It does not assert private tables, private functions, or the order of internal steps.

- The book is tested as a pure module. The tests cover a buy that spends cash, a buy refused for insufficient cash, a partial sell, a sell refused when it exceeds shares, average cost unchanged by a sell, realized gain that survives a later full exit, realized USD that uses the FX closes on the trade dates and does not change when a later FX close arrives, day gain and total gain on the shares still held, a sold-out listing that remains at zero shares, a deletion that rebuilds the book, a deletion refused while a later sell depends on the buy, an equity point that forward-fills a missing close and omits a listing with no FX close, and a split that changes shares and average cost without changing value.
- The quote source is tested against saved responses. The tests cover search, a year of daily bars, an FX close, a missing listing, a London price whose trading currency is pence, and no request when the close for that session is already stored.
- The book store is tested against a temporary SQLite file. The tests cover loading an empty book at $100,000, appending a trade, deleting a trade, and reading the closes back. They do not share a file with the running app.
- The page is not tested in v1. Its behavior is the book view rendered. There is no existing test suite to copy.

## Out of Scope

- Dividends and other cash distributions.
- Intraday bars, live quotes, and a poll during the session.
- Commissions, deposits, withdrawals, and a control that wipes the book.
- Editing a trade in place. A mistake is a deletion. A new trade is recorded at the fill available then.
- Fractional shares, short sales, options, crypto, forex as a holding, funds, and bonds.
- Accounts, share codes, and a second copy of the book in the browser.
- Drawing tools, an indicator library, a watchlist, and a benchmark overlay.
- A quote vendor other than EODHD.
- More than one operator.

## Further Notes

The glossary at the repo root is the vocabulary for listings, trades, fills, gains, and equity. ADR 0001 records EODHD as the only quote source. ADR 0002 records the SQLite file on the Docker volume. ADR 0003, buys only, is superseded by ADR 0004, which records sells as the way a gain is realized and deletion as the way a mistaken trade is erased. ADR 0005 records trade-date FX for realized gain. ADR 0006 records the tabbed page. ADR 0008 records that the activity list is its own tab, that both charts are an area of closes, and that the page title is Geist. ADR 0009 records that a listing remembers the name search returned. Where a user story below still describes the long column, candlesticks, volume, or Geist Serif, ADR 0006 and ADR 0008 win.

The approved page is one column: book figures, the trade form with cash and the manual-mark fields, the equity chart, the listing list beside the selected listing, then the activity list with a confirmation before delete. The sample figures on that layout are not the book. An empty book is $100,000 and no listings.

Geist Serif ships as one Regular weight in this release, with round, square, triangle, and heart dot shapes. The UI uses Regular with round dots. A light or dark page was not chosen. The layout has to work in either.

EODHD's free key allows 20 calls a day and one year of history. A small book plus a few FX closes fits that budget when a stored close is not fetched again. A paid end-of-day plan is what makes a larger book comfortable. Intraday data is a higher plan and is out of scope.
