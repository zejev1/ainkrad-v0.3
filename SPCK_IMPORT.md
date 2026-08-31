# Ainkrad v0.3.18: import and commit in SPCK

The final release ZIP is a complete SPCK project. Its verified v15-derived
world code is overlaid as ordinary working-tree changes on the read-only
verified `main` parent
`dad1dc0f72bd0883f801b93e3da4cae1587b6270` from:

`https://github.com/zejev1/ainkrad-v0.3.git`

No credential, commit or push is included.

1. Download the single `Ainkrad_v0.3.18_SPCK_READY_FINAL_*.zip` file. Do not
   unpack it manually and do not combine it with another Ainkrad archive.
2. In SPCK open **Projects → + → Import ZIP**, select the ZIP and create a new
   project named `Ainkrad`.
3. Open **Git**. The archive already contains `.git`; do not initialize another
   repository and do not clone GitHub. SPCK must show uncommitted v0.3.18
   changes on branch `main`.
4. If SPCK asks for Git identity, use
   `zejev1@users.noreply.github.com`.
5. Use one commit message:
   `feat(v0.3.18): deepen autonomous livelihoods and Underworld foundations`
6. Tap **Commit**, then **Push**. Those actions remain yours.
7. After Vercel succeeds, open the existing world first. Confirm that schema
   repair preserves its people and Cardinal experience, catch-up finishes,
   residents visibly travel, the resident picker selects the intended person,
   text size can be changed and audible Russian conversations appear.
8. Only then create a fresh world and confirm its Cardinal panel starts with
   current-epoch counters instead of interventions from the previous world.

The assistant performed no GitHub/Vercel write. `node_modules`, `dist`, CPU
profiles and generated acceptance artifacts are intentionally excluded.

Do **not** connect Ainkrad v0.3 to Convex. This project intentionally has no
Convex adapter or credential.
