# Paper Portfolio

A paper stock portfolio that runs on your own machine. The page and its server ship as one Docker image, and your book (trades, cash, closes, and a saved quote key) lives on a Docker volume named `paper-portfolio`. Updating the image keeps the book. Deleting the volume starts over at $100,000.

There are no accounts. The app listens on `127.0.0.1:3000` only, so other machines cannot reach it. Anyone who can use this computer can trade and can read the quote key.

## Run it

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and start it.
2. Make a folder for the app and save the Compose file into it:

   ```sh
   mkdir paper-portfolio && cd paper-portfolio
   curl -fsSLO https://raw.githubusercontent.com/telagraphic/paper-portfolio/main/deploy/compose.yaml
   ```

3. Start it:

   ```sh
   docker compose up -d
   ```

4. Open <http://127.0.0.1:3000>.

Prices come from [EODHD](https://eodhd.com). The app starts without a key, but search and trades stay off until you add one. Sign up at <https://eodhd.com/>, copy the API key from your account, and save it in **Admin → API key**. The free plan is enough.

Docker Desktop or [lazydocker](https://github.com/jesseduffield/lazydocker) can start, stop, and show logs for the `paper-portfolio` container.

## Update it

Run these in the folder that holds `compose.yaml`. The second command saves a copy of your book in that folder before anything changes.

```sh
docker compose stop
docker run --rm -v paper-portfolio:/data -v "$PWD":/backup alpine cp /data/book.sqlite "/backup/book-$(date +%F).sqlite"
docker compose pull
docker compose up -d
```

If the new version will not start, its log says so (`docker compose logs`). To go back, restore the copy and run the version you had before:

```sh
docker compose stop
docker run --rm -v paper-portfolio:/data -v "$PWD":/backup alpine sh -c 'cp /backup/book-YYYY-MM-DD.sqlite /data/book.sqlite && chown 1000:1000 /data/book.sqlite'
```

Then set `image:` in `compose.yaml` to the earlier version tag, for example `ghcr.io/telagraphic/paper-portfolio:1.2.0`, and run `docker compose up -d`.

## Start over

This deletes every trade, and there is no undo. Take a backup first if you might want it.

```sh
docker compose down
docker volume rm paper-portfolio
docker compose up -d
```

---

## Developer notes

> **⚑ Review when testing.** Everything below is for working on the app, not running it. Each ⚑ marks a step or decision to check by hand. [ADR 0010](docs/adr/0010-distributable-docker-image.md) records the reasons.

### Local development

```sh
npm install
npm run dev        # Vite on 5173, API on 3000, book at data/book.sqlite
npm test
npm run typecheck
```

### Run the image from source

```sh
docker compose up -d --build
```

`docker-compose.yml` at the root builds `paper-portfolio:dev` and runs it with the same container name, port, and volume as `deploy/compose.yaml`.

> **⚑ Same book.** The developer stack and the operator stack open the same `paper-portfolio` volume. A build from source uses your real book, migrations included. Take the backup above before running a branch that changes the schema.

> **⚑ Port 3000.** Something else on this machine already listens on 3000 (a `bun` process). Stop it, or the container cannot publish its port.

### Schema changes

The book file carries its version in `PRAGMA user_version`. `MIGRATIONS` in `src/store/book-store.ts` lists the steps. On open, the store runs every step above the file's version in one transaction. To change the schema, append a step. Never edit a step that has already shipped. A file from a newer build is refused, and the server exits with a message naming both versions.

> **⚑ Restart loop.** Both Compose files use `restart: unless-stopped`. A book that is too new makes the container exit, and Docker restarts it again and again. The log line says why. Restoring the backup or pulling the newer image ends the loop.

### Releasing

`.github/workflows/release.yml` runs typecheck and tests, then builds `linux/amd64` and `linux/arm64` and pushes to `ghcr.io/telagraphic/paper-portfolio`.

```sh
git tag v1.0.0 && git push origin v1.0.0       # publishes 1.0.0, 1.0, latest
git tag v1.1.0-rc.1 && git push origin v1.1.0-rc.1   # publishes 1.1.0-rc.1 only
```

> **⚑ First publish is private.** GHCR creates the package as private. After the first release, open the package settings on GitHub (Your profile → Packages → paper-portfolio → Package settings), set visibility to **Public**, and link it to the repository. Until then, `docker compose pull` fails for operators.

> **⚑ Workflow is untested.** The release workflow has not run yet. Try a pre-release tag first and check the Actions log and the published tags before tagging a real version.

> **⚑ Private repository.** `telagraphic/paper-portfolio` is private. The `curl` line above downloads `deploy/compose.yaml` from `main`, so it fails for operators until this branch is merged and the repository is public. Otherwise, send operators the file directly. A public GHCR package can be pulled even while the repository stays private.

### Image notes

- The base is `node:24.22.3-bookworm-slim`, pinned by digest in the `Dockerfile`. Bump the tag and digest together (`docker buildx imagetools inspect node:24-bookworm-slim`).
- The run stage has no `node_modules`. The server imports only `node:` modules, so `dist/` and `package.json` are enough. A server change that adds a runtime npm package must also copy production dependencies into the run stage.
- `GET /api/health` backs the image's `HEALTHCHECK`. It never calls the quote feed. `GET /api/book` does, so it is not the health check.
- The server closes the HTTP server and the SQLite store on SIGTERM, so `docker stop` returns at once.
- `next` is installed in the build stage only because `geist` lists it as a peer. It is not in the image.

> **⚑ npm version.** `package-lock.json` was regenerated with npm 11.19.1, the version in the Node 24.22.3 image. The npm 11.5.1 lock left out `next`'s optional native packages, and `npm ci` in the image refused it. If you change dependencies with an older npm, run `npx npm@11.19.1 install` so the Docker build still passes.
