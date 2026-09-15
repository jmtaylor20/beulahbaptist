# Site performance and accessibility

Measured on the production build (`npm run build:netlify`, served with
`next start`), before and after the September 2026 pass.

## Results

| | Before | After |
| --- | --- | --- |
| Marketing pages statically generated | 0 of 9 | **9 of 9** |
| Home page weight (fully scrolled) | 3,873 KB | **1,549 KB** |
| Five representative pages, combined | 13,455 KB | **5,111 KB** |
| axe-core WCAG 2.1 AA violations (9 pages) | 37 | **0** |

## What was wrong, and why

### Every route rendered on demand

`app/layout.tsx` called `headers()` inside `generateMetadata()` to build the
canonical origin from the request host. Because that is the *root* layout, it
opted the entire app out of static generation — all nine marketing pages were
served by a function on every request.

The origin now resolves once at build time in `lib/site.ts`, from
`PUBLIC_BASE_URL`, falling back to Netlify's `URL` or Cloudflare's
`CF_PAGES_URL`. It is pinned to `https://beulahbaptistchurch.com` in
`netlify.toml`; without it Netlify would supply its own `*.netlify.app`
deploy address and search engines would be told the wrong canonical host.
The messaging app reads the same variable, so the two cannot drift.

### Images were camera-resolution

Photos were up to 1800px wide and ~490KB while being displayed in 416px cards.
`scripts/optimize-images.mjs` re-encodes them to roughly 2x their measured
display width. The logo was worse: `logo-wide.png` is 731KB, and 42% of its
height is white padding, which is why the old header CSS scaled it 18% past
its box and clipped it. It is now trimmed and served as a 21KB WebP.

The favicon was the single worst offender: `icon`, `shortcut`, and `apple`
all pointed at the full 192KB seal, downloaded twice on every page load.
`scripts/make-icons.mjs` generates a 3KB favicon and a 68KB touch icon.

### Text failed contrast

`--blue` (`#4b94cb`) is 2.9:1 on the cream background — below the 4.5:1 WCAG AA
threshold for body-size text — and it coloured every `.eyebrow` label on the
site. A `--blue-ink` token (`#2f6a93`, 5.2:1 on cream) now covers the text
uses. `--blue` is unchanged for focus rings and borders, which only need 3:1.

## Re-running the tooling

Both scripts read the images over HTTP from a running build, so start one
first:

```bash
npm run build:netlify
npx next start -p 4321 &

node scripts/optimize-images.mjs   # photos
node scripts/make-icons.mjs        # favicon + apple touch icon
```

`optimize-images.mjs` is lossy and writes in place. Re-running it re-compresses
already-compressed files, so restore the originals first
(`git checkout -- public/images`) if you need to redo it.

## Checking the work

There is no automated accessibility or weight gate in CI. To re-measure:

```bash
npm install -D axe-core    # playwright is already a devDependency
```

then drive the pages with Playwright and run `axe.run()` against each, or use
Lighthouse against the running server.

`npm test` covers the parts that are cheap to assert: that the home page
renders with its title and structured data, that the signup page survives a
missing database, and that admin routes reject anonymous callers.

## Known leftovers

- `public/images/vbs.jpg`, `worship.jpg`, and `logo-white-v2.png` are not
  referenced anywhere (633KB). They are deployed but never downloaded by a
  visitor, so they cost nothing at runtime — left in place in case the church
  wants them.
- `logo-wide.png` is likewise now unreferenced, but it is the source the
  trimmed WebP is derived from, so it is worth keeping.
- The footer's copyright year is evaluated at build time now that pages are
  static. It updates on the next deploy.
