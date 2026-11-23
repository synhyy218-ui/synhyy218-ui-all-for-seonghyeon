# Event administration and JSON import

This importer runs in the browser using Firebase Web SDK. It does NOT need Node.js or a service-account key.

## Source
Use `firebase/firestore-seed.json` from this repository. It contains 330 source-content documents across seven collection paths, including 300 MAMA captions. Demo counters and member records are excluded. If a legacy event already exists, the importer skips it. Set its `status`, `startsAt` and `endsAt` in Firestore before expecting it to appear on the site.

Use the event form to create a draft, edit an existing event, add caption lines, or change its visibility. Times are in Vietnam time. Use **Ẩn sự kiện** to hide it and keep participation history.
The **Caption**, **Bình luận** and **Caption sự kiện** tabs let you create, edit, publish and hide individual entries. Use the platform filter for comments and the event selector for event captions. Hiding preserves the record and allows it to be published again.

For bulk import, give each event a stable ID, title, start and end times, `requiredCopies`, and `xpReward`. Place approved captions under `events/<id>/captions` with unique IDs, `text`, numeric `order`, and `status: "approved"`.

Apply the repository's Firestore rules and composite index separately before using the event view against a Firebase project.

## Setup
1. Firebase Console: create Firestore Database in **Production mode**.
2. Enable Email/Password in Firebase Authentication. Create the account for `synhy@admin.silcosudo.github.io` and grant its `eventAdmin` custom claim through a trusted Firebase admin environment.
3. Publish `WebUI/` from `main` using the GitHub Actions Pages workflow. Set Pages Source to GitHub Actions and allow `main` in the `github-pages` environment deployment rules.
4. Apply `firebase/firestore.rules` to the intended Firebase project. Admin access requires a password session and the `eventAdmin` custom claim.
5. Open `/admin/import.html` from the published site and sign in as `synhy`. Firebase Authentication manages the password.
7. On the importer page choose `firestore-seed.json`; review the counts; enter `all-for-eom-seonghyeon-651f9`; confirm and import. The importer first reads existing docs, then commits only missing docs in batches. Do not run multiple imports concurrently.
8. Verify results under Firestore Database -> Data. After import, consider removing the importer page and tightening/removing temporary create permission, then separately design read rules for your public website.

## Important
- The admin session is separate from the Google sign-in session on the public site. Firestore Security Rules enforce admin permissions.
- Never share private service-account keys or weaken rules to `allow write: if true`.
- Import uses a best-effort read-before-write check to avoid overwriting records. Concurrent third-party changes between checking and writing require extra precautions.
- The repository rules allow public reads of published records. Event progress and submissions use their own access rules.
- This importer does not change the existing website's localStorage UI or auto-import data until you explicitly choose the file and click Import.
