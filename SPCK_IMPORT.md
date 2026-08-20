# Import into SPCK

1. Keep your current hand-made `Ainkrad - v0.3` project as a backup.
2. Extract `ainkrad-v0.3-clean-foundation.zip` on the phone.
3. In SPCK choose **Open project / Import project** and select the extracted `ainkrad-v0.3` folder.
4. Do not overwrite your current project until the imported copy opens correctly.
5. The root must contain:
   - `README.md`
   - `package.json`
   - `tsconfig.json`
   - `src`
   - `tests`
6. Do **not** connect this clean foundation to the old production Convex deployment yet.

This package intentionally has no Convex adapter and no automatic retention.
Those are later infrastructure layers, after the domain architecture is stable.
