# Ainkrad v0.3.19

v0.3.19 is an additive repair and agency release built on the complete
v0.3.18 world. It preserves existing residents, history, professions,
Cardinal experience and deterministic RNG future. The one intentional map
repair moves only the incorrectly close canonical non-human homelands.

## Population, knowledge and continuity repairs

- Humans, elves, dwarves, goblins, orcs and ogres are mechanically distinct
  peoples rather than labels: they have separate cultural names, life stages,
  longevity, physiology, founder aptitudes, preferred terrain and material
  traditions.
- Every pair of canonical founding homelands is physically 100-200 km apart.
  Each non-human homeland begins with 12 adults of mixed ages. Existing saves
  created with the old 11-23 km layout receive one idempotent relocation of
  the homeland, its homes, residents and routes; identity and history remain.
- Elves and dwarves begin with a friendly cultural memory of humans. Goblins
  and orcs begin hostile, while ogres begin wary. These are first-contact
  diplomatic priors, not compulsory individual morality: lived contact,
  trade, harm, peace and war continue changing every relationship.
- Birth opportunity scales with the living population and has no hidden global
  ceiling. Food, housing, health and voluntary family choice still produce
  consequences; overpopulation is observable pressure for inhabitants and
  Cardinal, not a reason for the engine to silently stop births.
- Warriors, guards, scouts, cartographers and adventurers arise from aptitude
  and lived practice. Childhood gathering no longer fixes a resident's adult
  profession before other experience becomes possible.
- Long journeys retain a destination and physical return route. Residents can
  explore, map, found settlements, turn back or fail without being teleported.
- Cardinal resource relief is rejected when more than ten humans remain
  concentrated in one settlement. Crowded land must recover through fallow
  time and stewardship, or residents must trade and expand.
- The Genesis mentors remain outside the ordinary population and teach for the
  expanded initial period from a bounded real-world medieval knowledge base.
- Cultural naming is generated from parents, people and phonetic history.
  Technical sequence numbers are not displayed as children's names.
- Conversation wording combines current place, work, family, danger,
  resources, relationship, personality and learned knowledge. The observer
  shows only persisted audible speech and actively avoids duplicate rendered
  lines when truthful alternatives exist.
- The Secret Library keeps a stable physical anchor beside Ainkrad instead of
  following the expanding map corner. Its records remain bounded and are
  applied only through reading, matching practice and witnessed teaching.
- Closed-tab catch-up and speed multipliers batch persistence and rendering
  while preserving every semantic quantum. A failed catch-up rolls back to the
  last durable world instead of clearing Cardinal experience or freezing at
  zero percent.

## Independent divine gifts and contextual prayers

- A divine gift is a capability, not a class, profession or destiny. Any
  ordinary resident may keep their livelihood, family, character, beliefs and
  freedom after receiving longevity, might, inventive intelligence, crowd
  charisma, healing touch or the level-100 hero capability preset.
- Messages, revelations, commands, requests, warnings, visions and signs are
  independent from gifts. The resident interprets the contact and decides what
  to do with it. Priesthood and public religion can emerge only through repeated
  voluntary prayer, testimony and recognition.
- Prayers are composed from the resident's actual evidence: relatives, grief,
  health, satiety, harvest, danger, travel, war, resources, belief, doubt and
  desperation. They are not selected as complete lines from a phrase list.
- A filterable prayer inbox shows the speaker, reason, desired outcome,
  emotional state, belief and desperation, and opens the exact resident.
  Prayer never grants an automatic reward.
- Direct divine actions pass through the independent player gateway. The world
  and selected resident's aging pause during a private audience; Cardinal and
  bystanders receive no direct secret event.
- Detailed recent prayers and per-person histories have explicit bounds while
  cumulative counts preserve evidence of older prayers.

## Physical dungeons, earned ranks and carried economy

- Dungeons are generated only beneath discovered physical land entrances:
  ruins, mountain caves, dangerous forests and marshes. Residents must choose
  an expedition and walk to the entrance.
- Ranks `F` through `S` are evidence of completed expeditions. They are not
  assigned by Cardinal, a settlement quota or the player. The adventurer
  livelihood emerges through repeated voluntary practice.
- A run can end in success, retreat or defeat and consumes real energy,
  supplies and health. Successful runs provide fast earned experience and may
  recover finite old coin, equipment, relics or skill books.
- Recovered skill books and artifacts can teach specific abilities. The
  powerful hero gift improves capability but does not force the resident to
  become benevolent or to accept a hero role.
- Settlement markets begin with zero invented money. Residents physically
  carry coin and artifacts, buy food deducted from the actual granary, sell or
  barter finds and create inter-settlement economic relations through completed
  journeys.
- Dungeon count, artifact count, recent run history, recent transactions,
  carried inventory and market inventory are bounded for centuries-old browser
  saves.

## Verification summary

- TypeScript, the production Vite build and all `185/185` sequential tests
  passed.
- The 100-year OFF-mode browser-seed run reached 738 living residents across
  all six peoples, 751 births, ten inhabited settlements and 133 residents in
  physical movement. No deprivation death occurred; humans grew from 10 to 65
  without Cardinal assistance or a demographic ceiling.
- All 751 native children had distinct non-numbered names. The final bounded
  conversation window contained 95 distinct utterances out of 96.
- The same autonomous run produced 39 adventure profiles, 308 dungeon runs,
  152 successes, 30 artifacts, 435.87 recovered coins and six physical
  inter-settlement trade relations.
- The project remains uncommitted on GitHub parent
  `66538c03ff8dfcea0bccb2e493c6af1666facfad`. The assistant performed no
  commit, push, Vercel write or Convex connection.
