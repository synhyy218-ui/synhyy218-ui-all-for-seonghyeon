# ALL FOR EOM SEONGHYEON WebUI

Run the static site from the repository root.

```sh
yarn install
yarn start
```

Open [the home page](http://127.0.0.1:8080/) or [the Firestore importer](http://127.0.0.1:8080/admin/import.html).

- `WebUI/` contains the HTML, CSS, JavaScript modules and browser importer. GitHub Actions publishes it directly from `main`. In GitHub Pages settings, use GitHub Actions as the source and allow `main` to deploy to the `github-pages` environment.
- `firebase/` contains the rules, indexes and seed. Apply rules and indexes separately from the Pages workflow. See the [import guide](WebUI/admin/README.md) for Google sign-in and import setup.
- `reference/` contains the original HTML for design and feature comparisons.

Firestore provides published content, caption submissions, event progress and private user profiles. Signed-in users can import browser data when their account has no profile. The browser retains guest data and pending profile edits. Profile XP is client-reported and community totals are illustrative. Apply the current rules to enable account sync.
