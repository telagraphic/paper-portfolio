# Official daily closes come from EODHD

The book needs one official close per listing per session, including exchanges outside the US, and the listing's identity has to carry its exchange. EODHD is the only quote source. A listing is stored with EODHD's symbol form, `TICKER.EXCHANGE` (for example `GSK.LSE`, `7203.TSE`). After a session finishes, the app requests that listing's end-of-day history once, and only when that close is not already stored. Opening the app is the catch-up. The live quote endpoint is unused.

Yahoo Finance covers more exchanges through undocumented endpoints intended for personal use, and those endpoints break without notice. Twelve Data's free plan does not include a real international book. Finnhub's real-time coverage is mainly the US. EODHD's free key allows 20 calls a day, which covers one daily pass over a small book plus a few currency closes.

Changing vendors later means remapping every stored listing. Some London closes arrive in pence (GBX); the listing's trading currency is the unit of the close, and portfolio totals convert that unit into US dollars.
