import { createApp } from "./app.js";
import { openBookStore, SchemaTooNewError } from "../store/book-store.js";

const port = Number(process.env.PORT ?? 3000);
const databasePath = process.env.DATABASE_PATH ?? "data/book.sqlite";
const clientDir = process.env.CLIENT_DIR ?? "dist/client";

let store: ReturnType<typeof openBookStore>;
try {
  store = openBookStore(databasePath);
} catch (error) {
  if (!(error instanceof SchemaTooNewError)) throw error;
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}

const server = createApp(store, clientDir).listen(port, () => {
  process.stdout.write(`Paper portfolio listening on ${port}\n`);
});

// As PID 1 in the container, Node ignores SIGTERM unless it is handled here.
let stopping = false;
function stop(signal: NodeJS.Signals) {
  if (stopping) return;
  stopping = true;
  process.stdout.write(`Paper portfolio stopping on ${signal}\n`);
  server.close(() => {
    store.close();
    process.exit(0);
  });
  server.closeIdleConnections();
  setTimeout(() => {
    server.closeAllConnections();
  }, 5_000).unref();
}

process.on("SIGTERM", stop);
process.on("SIGINT", stop);
