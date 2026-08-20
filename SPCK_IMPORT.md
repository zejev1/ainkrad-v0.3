# Import into SPCK

Ainkrad v0.3 audit packages are full Git-aware project archives.

1. In SPCK choose **Projects → Create → Import from ZIP**.
2. Select the newest `ainkrad-v0.3-auditN-git.zip` directly. Do not manually extract it first.
3. Use External storage.
4. Open the imported project and verify the root contains `README.md`, `package.json`, `tsconfig.json`, `src`, `tests` and `.git`.
5. Open Git and push the prepared commit to `origin/main`.
6. Keep the previous audit only until the new commit is confirmed on GitHub.
7. After remote verification, delete the previous audit project and the downloaded ZIP from the phone.

Phone-storage rule: normally keep only the current v0.3 working audit plus the old `ainkrad` donor/archive. GitHub is the version history; the phone does not need a chain of old audit copies.

Do **not** connect Ainkrad v0.3 to the old production Convex deployment. v0.3 intentionally has no Convex adapter or blind age-based retention layer.
