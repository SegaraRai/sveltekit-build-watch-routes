# SvelteKit: routes added or removed during `vite build --watch`

A minimal SvelteKit app (one page, `@sveltejs/adapter-node`) that shows what
happens when a route is added or removed while `vite build --watch` runs:

- **Added route:** no build starts. The next rebuild, after any edit, stops
  after the server environment with no error and no `✔ done`, and `build/`
  keeps the previous output.
- **Removed route:** every rebuild fails with
  `[UNRESOLVED_ENTRY] Cannot resolve entry module src/routes/about/+page.svelte.`

Both last until the watcher restarts.

## Run

```sh
npm install
node reproduce.js control   # only edit the home page: works
node reproduce.js           # add src/routes/about, then edit the home page
node reproduce.js remove    # start with src/routes/about, delete it, then edit the home page
```

`reproduce.js` resets the routes, runs `vite build --watch`, makes the
changes, prints what the watcher built and writes its output to `watch.log`.

Output with `@sveltejs/kit` 3.4.0 and Vite 8.3.8:

```
$ node reproduce.js control
1. first build finished, /about listed: false
3. edited src/routes/+page.svelte: server environment rebuilt, build finished (✔ done)
4. build/server/manifest.js lists /about: false

$ node reproduce.js
1. first build finished, /about listed: false
2. added src/routes/about/+page.svelte: no build started
3. edited src/routes/+page.svelte: server environment rebuilt, no "✔ done" and no error
4. build/server/manifest.js lists /about: false

$ node reproduce.js remove
1. first build finished, /about listed: true
2. deleted src/routes/about/+page.svelte: build failed: [UNRESOLVED_ENTRY] Cannot resolve entry module src/routes/about/+page.svelte.
3. edited src/routes/+page.svelte: build failed: [UNRESOLVED_ENTRY] Cannot resolve entry module src/routes/about/+page.svelte.
4. build/server/manifest.js lists /about: true
```

## By hand

1. `npx vite build --watch` and wait for `✔ done`.
2. Create `src/routes/about/+page.svelte`. Nothing rebuilds.
3. Edit `src/routes/+page.svelte`. The server environment rebuilds
   (`built in …ms`), then nothing: no client build, no adapter, no error.
   `build/` still has the first build.
