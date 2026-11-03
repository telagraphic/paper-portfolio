# Paper portfolio

A simulated book for holding stocks and ETFs and reading them at each session's official close.

## The book

**Paper portfolio**:
A simulated book of cash and positions.
_Avoid_: Model portfolio, account, brokerage account

**Position**:
The shares of one listing currently held in the paper portfolio.
_Avoid_: Holding, line

**Listing**:
A common stock or ETF on one exchange, named by its symbol together with that exchange.
_Avoid_: Ticker, stock

**Trade**:
A buy or a sell of a whole number of shares of one listing at a fill.
_Avoid_: Purchase, order

**Buy**:
A trade that spends cash and increases the shares of a listing.

**Sell**:
A trade that returns cash and reduces the shares of a listing.
_Avoid_: Deletion

**Deletion**:
The removal of a mistaken trade so the book reads as if that trade was never recorded.
_Avoid_: Sell, reversal

**Fill**:
The price locked in when a trade is recorded. It is the latest close already stored for that listing, or the manual mark when no close exists. A close stored later does not change it.
_Avoid_: Purchase price, execution

**Average cost**:
The share-weighted fill of the shares still held. A sell leaves it unchanged.
_Avoid_: Cost basis

**Realized gain**:
The reporting-currency gain a sell locks in, using the FX closes on the buy dates and the sell date. It remains after those shares are gone.
_Avoid_: Official profit, booked P&L

**Cash**:
The uninvested US dollars in the paper portfolio.
_Avoid_: Balance, buying power

**Equity**:
Cash plus every position at its mark, in the reporting currency.
_Avoid_: Master value, portfolio value

**Weight**:
A position's value at its mark as a share of equity.

## Prices

**Session**:
One exchange's trading day for a listing.

**Close**:
The official end-of-day price of a listing for one session, in its trading currency.

**Manual mark**:
A price typed for a listing, in its trading currency, when that listing has no close.

**Mark**:
The price that values a position: its latest close, or its manual mark when no close exists.

**Trading currency**:
The currency in which a listing's close is quoted.

**Reporting currency**:
The currency in which portfolio totals are shown. For this book, US dollars.

**Day gain**:
The money a position has made or lost since the prior session's close, on the shares still held.
_Avoid_: Day profit, daily P&L

**Total gain**:
The money a position has made or lost since its fills, on the shares still held.
_Avoid_: Profit, P&L, unrealized gain

**Day return**:
Day gain as a rate of the prior session's value of the shares still held.

**Total return**:
Total gain as a rate of what was paid for the shares still held, measured in the trading currency. A move in that currency against the dollar does not change it.
