# History is a tab, and both charts are areas

ADR 0006 kept the activity list at the bottom of Totals and Tickers, and left it off Buy/Sell. It also told search to reuse the listing list's columns, and set the page title in a serif. The product spec drew the selected listing as candlesticks and volume, and the equity chart shipped as a line. Layout 4 replaces those.

History is only the label. The thing on that tab is the activity list. Totals, Tickers, and Buy/Sell do not show it. A search hit is not a position, so its row shows the name, the listing, and the close. It uses the listing list's row, not a second table design, and it does not show shares or gains.

The equity chart and the listing chart are both an area of closes. They share one slot width. The listing chart has no volume. The series stays still. The page title is "Paper Portfolio", small and bold, in Geist, and it stays secondary to the book.

Motion on the four tabs stays the five moments in ADR 0007.

Keeping the activity list on Totals, giving search the holding columns, drawing candlesticks, and setting the title in a serif were the other options.
