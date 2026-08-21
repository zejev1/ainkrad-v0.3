# World Entry Gateway

External entry is a boundary capability, not a Cardinal feature.

`IndependentWorldEntryGateway` has no reference from Cardinal Core. It compares the complete expected world snapshot with the current committed snapshot before allowing entry, then the world commit checks the exact revision again.

## Resident entry

Entering as a resident creates a new `external_resident` identity, home, body/life state, personality, mind state, skills and goals. It never takes over an existing native resident and never copies or overwrites a native mind.

The new resident becomes subject to the same aging, mortality, relationships, plans and world rules as everyone born inside the world.

## Deity entry

Entering as a deity creates a bounded external presence in the cosmology. The gateway limits deity count and accepts only stable external IDs. A deity can request one of a small set of perceptible omens with magnitude at most `0.35`.

An omen is not a belief write. Each living resident independently perceives or misses it according to curiosity, prior belief and the event magnitude. Witnesses receive awe/fear changes and an append-only memory; society decides whether shared experience becomes tradition.

Residents can also experience rare endogenous unexplained phenomena. Over time, prayer, memories and shared interpretation can produce an emergent belief-deity. An external account may not impersonate that emergent belief.

## Current integration state

The gateway, world mutations and tests are implemented in v0.3.10. The browser remains a read-only world view in this package; a later authenticated control surface can call this gateway without exposing Cardinal or world internals directly.

