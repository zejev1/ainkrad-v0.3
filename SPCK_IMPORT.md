# Ainkrad v0.3.19: import and commit in SPCK

The final ZIP is a complete, flat SPCK project. Repository files and `.git`
are located directly at the archive root, not inside a second project folder.
The working-tree changes are based on the verified GitHub `main` parent:

`66538c03ff8dfcea0bccb2e493c6af1666facfad`

Remote:

`https://github.com/zejev1/ainkrad-v0.3.git`

No credential, commit or push is included.

1. Download the single `Ainkrad-v0.3.19-SPCK-READY-FINAL-*.zip` file.
2. In SPCK choose **Projects → + → Import ZIP** and select that ZIP. Do not
   first create an empty project and extract the archive into it; that produces
   the unwanted project-inside-project layout.
3. Open **Git**. Do not initialize another repository and do not clone GitHub.
   SPCK must show branch `main` and the uncommitted v0.3.19 changes immediately.
4. If SPCK asks for Git identity, use
   `zejev1@users.noreply.github.com`.
5. Suggested commit message:
   `feat(v0.3.19): add lived prayers, gifts and adventure economy`
6. Tap **Commit**, then **Push**. Those actions remain yours. Never enable a
   force push for this archive.
7. After Vercel succeeds, open the existing world first. Confirm that catch-up
   completes, the Secret Library remains fixed beside Ainkrad, Cardinal keeps
   its experience, prayers appear in their inbox, and dungeon entrances and
   adventure evidence appear without a world-error badge.
8. Then create a fresh world and confirm that births, cultural names,
   conversations, distant settlements, voluntary professions and adventure
   ranks develop from the new epoch rather than old cached counters.

The assistant performed no GitHub or Vercel write. `node_modules`, `dist`,
`tsconfig.tsbuildinfo`, CPU profiles and generated audit caches are excluded.

Do **not** connect Ainkrad v0.3 to Convex. This project intentionally has no
Convex adapter or credential.
