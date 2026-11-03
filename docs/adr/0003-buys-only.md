---
status: superseded by ADR-0004
---

# The book records buys only

Shares leave the book when a buy is deleted. Deleting a buy restores the US dollars that buy spent and rewrites history as if that purchase had not happened. The book does not record sells.

A sell was the alternative: keep the buy and append a reversing trade, so the past would still show the shares until the sale. That preserves a brokerage-style ledger and blocks deleting a single purchase out of the middle of the book. This book is a list of buys you can remove. A smaller position is possible only when those shares were recorded as their own buy.
