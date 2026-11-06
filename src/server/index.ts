import { createApp } from "./app.js";
import { openBookStore } from "../store/book-store.js";

const port = Number(process.env.PORT ?? 3000);
const databasePath = process.env.DATABASE_PATH ?? "data/book.sqlite";
const clientDir = process.env.CLIENT_DIR ?? "dist/client";
const store = openBookStore(databasePath);

createApp(store, clientDir).listen(port, () => {
  process.stdout.write(`Paper portfolio listening on ${port}\n`);
});
