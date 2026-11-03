# The book is a SQLite file on the Docker volume

One person runs one container, and the EODHD key stays in that container. The master record is a SQLite file on a Docker volume: listings, trades, closes, and cash. The Node API is the only writer. The browser does not keep a copy.

IndexedDB was the alternative. It is the database a browser still offers, and it belongs to one browser profile: clearing site data, or opening the app in another browser, would drop a trade while the container kept running. Web SQL is gone from Chrome and Safari and was never in Firefox. Postgres would be a second service for a single writer. Moving the book later means migrating every trade.
