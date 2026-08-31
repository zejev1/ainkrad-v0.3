# Ainkrad v0.3 Architecture Invariants

These rules convert failures from the previous implementation into tests and structural constraints.

## Cardinal

1. Cardinal is the central research system, but the world must remain autonomous without it.
2. `OFF` and `OBSERVER` must produce identical world state and autonomous world-event history under the same seed and disturbances.
3. Observer code receives read-only world/event capabilities.
4. Cardinal Core may propose an intervention but cannot hold the world mutation capability.
5. The independent intervention gateway authorizes **and executes** simulation interventions.
6. Intervention rate and magnitude are bounded outside Cardinal Core.
7. Every evaluation is journaled, including `no_action`.
8. Every intervention authorization decision is journaled.
9. Executed interventions receive later outcome observations and independent audit.
10. Cardinal metrics come from real world state/events, not synthetic Cardinal-owned NPC state.

## Control-world fairness

11. Cardinal must never possess a recovery mechanism that the control world is deliberately prevented from having.
12. The autonomous world must have endogenous recovery paths such as resource regeneration, cooperation and adaptation.
13. Disturbances are applied equivalently to paired worlds.
14. A successful experiment must be capable of concluding that Cardinal is useless or harmful.

## History and storage

15. Current state, active signals, experiment history and technical transport data are different categories.
16. `activeUntil` ends current influence; it never authorizes deletion of historical evidence.
17. Ordinary historical events are not treated as forever-active signals.
18. Experimental history is append-only by default.
19. Full long-term memory history lives outside the hot world snapshot; agents query bounded recent slices for decisions.
20. Technical queue rows may be pruned only after acknowledgement.
21. Dedupe tombstones use an explicit bounded policy in persistent adapters; they must not grow accidentally forever.

## Concurrency and retries

22. No ordinary input path may allocate `lastInputNumber + 1` from one global hot record.
23. Input consumers use claims/leases so concurrent workers do not process the same event simultaneously.
24. World input application is idempotent by stable input event ID.
25. A crash between world commit and queue acknowledgement must not duplicate world history.
26. Broad mutable-table reads and hot shared writes are treated as architectural smells in any future database adapter.

## Scheduler / jobs

27. Scheduled work contains IDs and small primitives, not serialized worlds, maps or full NPC arrays.
28. The application payload guard stays conservative even if a provider allows larger payloads.

## Agents and emergence

29. Relationships may improve or deteriorate based on interaction outcome.
30. Relationships and memories must affect future behavior; they are not decorative telemetry.
31. Agent routines may influence choices but must not permanently bypass autonomous/social decision paths.
32. Agent history and current relationship projections are separate concepts.
33. Social exploration remains possible so early relationships do not permanently freeze the society into scripted cliques.

## Reproducibility

34. Experimental behavior uses seeded randomness.
35. Determinism state is part of world state so a future persistent adapter can resume/replay correctly.
36. Infrastructure-generated IDs must not affect autonomous decision randomness.

## Project safety

37. No automatic upstream materializer may overwrite reviewed Ainkrad code.
38. Ainkrad v0.3 does not use Convex; storage providers are adapters, not the domain model.
39. CI must typecheck and test changes before we treat a revision as healthy.
40. README is the project constitution. If code conflicts with it, code changes.

## Audit round 2 additions

41. Sensor reads are side-effect free; asking what was active at one time must not destroy the ability to inspect another time.
42. Event and memory identities are scoped by world, so identical external IDs in different worlds cannot collide.
43. Exact memory/event retries are idempotent; same ID with different content is a hard error.
44. Dedupe tombstones for unacknowledged transport rows cannot be pruned.
45. Input envelopes are size-bounded just like scheduled operations.
46. Gateway allowlists are checked at runtime and configuration cannot raise intervention magnitude above the constitutional hard cap.
47. Stable proposal/disturbance operation IDs prevent a retry from applying the same world mutation twice.
48. A finished experiment may not silently discard pending intervention outcomes; a follow-up observation tail completes them.
49. Persistent adapters must atomically couple a logical world-state mutation with its historical evidence, or implement an equivalent recoverable commit protocol.
50. Any gateway capable of real external execution must run outside Cardinal's control boundary; the only in-process external gateway allowed in v0.3 is deny-all.

51. Single-world before/after intervention outcomes are labeled observational; causal claims require a matched control or another explicit counterfactual design.
52. Active signals never influence a time before their own `occurredAt`; temporal projections obey both start and end boundaries.
53. Serialized input envelopes are validated at runtime; TypeScript source unions are not a transport security boundary.
54. OFF/OBSERVER contamination checks compare autonomous world-event history as well as the final world snapshot.

## Audit round 3 additions

55. WorldEngine stages state changes, events and memories before one persistence commit; it does not write current state first and evidence later.
56. `WorldState.revision` provides per-world compare-and-swap protection against stale concurrent writers; it is never a global input counter.
57. World operation idempotency survives process restart because stable operation IDs and fingerprints live at the `WorldStore` boundary.
58. Same world operation ID with different logical content is a hard error.
59. A failed world commit leaves the live engine state and RNG state unchanged.
60. A persisted world can be reopened with its RNG and event-sequence determinism state intact.
61. World snapshots carry a rules version and incompatible rules require explicit migration rather than silent continuation.
62. Sensor snapshots carry a sensor version and Cardinal evaluations carry a policy version.
63. Experiment results record a reproducibility manifest containing seed, versions and disturbance-schedule fingerprint.
64. Transport wall-clock `createdAt` is not simulation time; world input evidence records the logical application time.
65. Time-bounded sensor evidence excludes events whose `occurredAt` is in the future.
66. A sensor observation timestamp must match the supplied world snapshot timestamp.
67. Cardinal evaluation, proposal, outcome and Auditor decision identities are stable across exact logical retries.
68. Cardinal journal exact retries are idempotent and same-ID/different-content reuse is rejected.
69. Input event IDs and deduplication keys reject different-content reuse instead of silently discarding the collision.
70. A new world operation may not reuse an event or memory ID already owned by another committed world operation.
71. Pending intervention outcome work is reconstructed from journal evidence instead of existing only in an ephemeral in-process array.
72. Outcome evidence records the before/after world revisions, sensor version and supporting event IDs used for the follow-up observation.
73. Reading `WorldEngine.snapshot()` is side-effect free; determinism state is synchronized at operation commit, not by observation.
74. A committed world event/effect may not claim a logical time later than the current-state timestamp that already contains its effect; multiple operations may share one logical time and are deduplicated by operation ID, not by `now === now`.

75. Exact retries are recognized by stable operation identity even after the world has progressed beyond the operation's original logical time; temporal guards apply only to genuinely new operations.
76. One `WorldEngine` instance serializes logical mutations so concurrent callers cannot share or corrupt a working transaction.
77. `snapshot()` exposes only the last committed projection; uncommitted working state is never observable by sensors or other readers.

## Audit round 4 additions

78. Gateway cooldown and prior execution state must not live only in process RAM; a restart cannot erase intervention history.
79. An authorized intervention intent is persisted before the simulation mutation is attempted.
80. A pending gateway intent is recoverable by stable proposal ID; an exact retry may finalize it but must never apply the world effect twice.
81. Unknown or transient gateway failures leave a recoverable pending intent rather than silently forgetting authorization state.
82. Gateway authorization based on world revision `R` is rechecked at the world commit boundary; preflight snapshot equality alone is insufficient.
83. If another writer advances the world between authorization and commit, the intervention finishes as `stale` and does not mutate the world.
84. World revision conflicts refresh the engine from committed storage before later decisions continue.
85. A simulation intervention target verifies the target `worldId` as well as the proposal kind and magnitude; a ledger entry for another world cannot be executed against the current world.
86. Gateway records include the policy version, observed world revision, execution status and exact committed world revision when execution succeeds.
87. Gateway recovery resolves pending intents before a new proposal can rely on reset in-memory cooldown state.
88. Cardinal research evidence has an append-only log-backed journal contract that survives component recreation when backed by durable storage.
89. Same Cardinal evidence ID + same content is an idempotent retry across restart; same ID + different content is a hard collision.
90. Cardinal journal streams are partitioned by world and evidence kind; there is no global journal sequence shared by unrelated worlds.
91. Gateway ledger streams are partitioned by world; intervention control does not use one shared global counter.
92. Gateway final evidence can be reconciled into the Cardinal research journal after a crash between execution completion and journal append.
93. The gateway ledger and Cardinal journal are separate capabilities: Cardinal cannot rewrite gateway execution history to make itself look better.
94. An executed intervention's recorded committed revision comes from the committed world operation itself, not from a later snapshot that may already include unrelated mutations.
95. The experiment manifest records the intervention-gateway policy version in addition to world, sensor and Cardinal policy versions.
96. A durable `AppendOnlyLog` adapter must make each compare-and-append atomic (or recoverably equivalent); a torn record is never accepted as committed evidence.
97. Compaction or indexing of Cardinal/gateway logs may improve storage efficiency but may not erase experimental evidence or alter stable identities.

## Audit round 5 additions

98. Cardinal longitudinal reasoning is reconstructed from append-only research evidence; a private mutable belief store is not the source of truth.
99. A Cardinal cycle uses only strictly earlier logical-time evaluations as prior research evidence, so an exact retry cannot count itself as a new observation.
100. The bounded active research window has an explicit fingerprint; bounding a hot read is not permission to delete the historical records behind it.
101. Prior evaluations contribute to current persistence reasoning only when Cardinal policy and sensor versions are compatible.
102. A non-critical systemic condition normally produces `defer` until it persists across at least three compatible semantic observations; one-opportunity noise must not automatically trigger intervention.
103. Critical-threshold bypass of the persistence window is explicit, policy-versioned and auditable.
104. A continuing problem hypothesis keeps a stable hypothesis ID across consecutive compatible supporting observations; a broken support chain starts a new hypothesis.
105. Every intervention proposal is bound to the exact hypothesis that justified it.
106. Every intervention proposal contains a falsifiable prediction: target metric, direction, minimum improvement and bounded canonical world-minute horizon.
107. The independent gateway validates the serialized hypothesis/prediction contract at runtime and fails closed for malformed or unbounded predictions.
108. Intervention outcome timing comes from the proposal's recorded prediction horizon rather than an unrelated hidden timer.
109. Outcome evidence records the prediction metric, required improvement and actual observed delta.
110. A failed prediction is evidence that the stated expectation was not observed; it is not automatically evidence that the intervention caused the failure.
111. Recent failed predictions may make Cardinal defer repeating a non-critical intervention, but this caution must remain distinguishable from a causal conclusion.
112. OBSERVER may use Cardinal research memory for analysis but still has no world-mutation path; research memory must not contaminate OFF/OBSERVER world equivalence.
113. Experiment manifests record the Cardinal research-semantics version in addition to world, sensor, Cardinal policy and gateway policy versions.
114. Cardinal reasoning factors stored for audit are concise decision factors, not an unverifiable hidden chain of thought; the reproducible evidence and policy are the authoritative basis.
115. Restarting Cardinal over the same durable journal must reproduce the same compatible research context and the same next logical evaluation for identical observation evidence.

## Audit round 6 additions

116. Cardinal may not start a new same-kind intervention test while an earlier executed intervention of that kind is still active or lacks its required outcome evidence.
117. The no-overlap rule is scientific discipline, not merely gateway cooldown; a technically permitted second action may still be epistemically invalid.
118. Every intervention record stores the exact effect duration authorized by the independent gateway.
119. Cardinal washout uses the greater of the recorded effect duration and prediction horizon so later evidence is not silently attributed across overlapping test windows.
120. Unresolved executed interventions remain in the active Cardinal research context even if a bounded ordinary history tail would otherwise omit them.
121. Unresolved executed interventions likewise remain visible to the independent Auditor context.
122. Cardinal records a machine-readable defer reason whenever it sees a qualifying problem but intentionally postpones action.
123. `experiment_in_progress` means an earlier same-kind intervention is active or unresolved; it is not interchangeable with lack of evidence.
124. A recent intervention-density autonomy budget limits repeated non-critical Cardinal action even when every individual proposal would otherwise qualify.
125. In v0.3.15, three executed interventions inside the 129,600-world-minute (90-day) autonomy window exhaust the non-critical budget until the window naturally washes out.
126. Critical conditions may explicitly override the intervention-density budget, but criticality does not silently permit overlap with an unresolved same-kind experiment.
127. Cardinal's autonomy/dependency assessment is persisted inside the evaluation evidence and participates in stable evaluation identity.
128. The Auditor reconstructs recent intervention density and in-progress tests independently from the append-only journal rather than trusting Cardinal's derived autonomy assessment.
129. Auditor decision records bind the independent audit-context version and fingerprint used to challenge Cardinal.
130. Experiment results report defer counts, including experiment-in-progress and autonomy-budget deferrals, so restraint is measurable rather than hidden.

## Audit round 7 additions — autonomous world

131. The control world must remain capable of production, recovery, cooperation and adaptation without Cardinal.
132. NPC personality, needs, skills, goals, home and location are world-owned persistent state; Cardinal cannot write them directly.
133. Cardinal mode is not an input to autonomous NPC action selection.
134. The same seed, world rules and disturbances must reproduce the same autonomous state and event history.
135. Different seeds are allowed to diverge; diversity is a valid outcome rather than a replay defect.
136. NPC processing order is shuffled by the persisted seeded RNG each tick instead of granting permanent priority to array order.
137. Survival emergencies may constrain choice, but ordinary behavior is selected among multiple locally scored actions rather than a fixed routine ladder.
138. Work is an endogenous control-world resource path and must not depend on Cardinal.
139. Gathering, work, exploration and voluntary help provide distinct recovery paths; no single Cardinal-only resource mechanism may be required for survival.
140. Exploration may discover resources but must not guarantee discovery on every action.
141. Helping is an explicit agent action; positive conversation does not automatically transfer resources.
142. An offer of help may be rejected and the rejection remains part of autonomous evidence.
143. Social interactions may improve or worsen relationships; positive outcome is never guaranteed by merely starting a conversation.
144. Pair memories influence later social targeting, while random social exploration remains possible.
145. Skills change through experience and are persisted so later behavior can depend on history.
146. Current NPC goals are derived from inspectable needs/personality/state and are persisted; they are not private Cardinal instructions.
147. World places are persistent state and agent actions can change location independently of Cardinal.
148. Visual appearance must remain separable from causal NPC logic so later graphics cannot silently become a decision controller.
149. Resource shocks may affect shared and household resources, but OFF/OBSERVER worlds retain the same autonomous recovery capabilities as INTERVENE worlds.
150. Social and safety disturbances modify environmental opportunity/support; they do not directly rewrite relationships, memories or goals.
151. Social isolation is measured from recent autonomous contact, not from the mere existence of an old relationship projection.
152. A bounded sensor read that may not cover its declared logical-time window records an explicit limitation.
153. Changing the semantic meaning of a sensor metric requires a sensor-version change.
154. Persisted world data is runtime-validated; TypeScript types are not trusted as a storage boundary.
155. A same-version snapshot missing required nested NPC/world structures fails loudly instead of being partially accepted.
156. A world-rules change that alters NPC state/action semantics requires explicit migration or a new experiment.
157. Long-run viability checks guard against guaranteed architectural collapse; they are not evidence that every seed is healthy.
158. OFF/OBSERVER equivalence must continue to hold after adding richer personalities, goals, skills, locations and social behavior.
159. Simulation interventions may alter bounded environmental conditions but may not directly assign NPC actions, goals, skills or relationships.
160. Richer world behavior must remain falsifiable: it is acceptable for a sufficiently capable control society to make Cardinal unnecessary.

## Audit round 8 additions — durable live world

161. Ordinary NPC choice is sampled from a bounded set of reasonable alternatives rather than always executing the maximum utility score.
162. Choice sampling remains deterministic under the persisted seeded RNG; UI timing and Cardinal mode are not action-selection inputs.
163. Curiosity and risk tolerance may widen ordinary choice, while survival emergencies may explicitly narrow it.
164. The selected action, dominant alternative, considered-action count and normalized openness are persisted as concise decision evidence.
165. Visual motion, action bubbles, selection panels and the event feed are read-only projections and cannot become agent-control capabilities.
166. The live browser world persists projection, events, memories and operation identity in one atomic IndexedDB transaction.
167. Cardinal research evidence and independent gateway recovery/cooldown evidence persist across browser runtime recreation.
168. A page reload resumes the last committed logical tick and RNG state; it must not silently create a replacement society.
169. Multiple same-origin tabs use one writer where Web Locks are available; revision checks remain authoritative when they are not.
170. A waiting tab may mirror committed frames but may not become a second uncoordinated source of world decisions.
171. Browser-local durability is not described as 24/7 execution: closing every page stops the worker, and clearing site data explicitly resets local state.
172. Any future always-on world host remains architecturally separate from Cardinal and does not weaken the independent external-gateway boundary.

## Audit round 9 additions — growing world and learned Cardinal

173. Natural territory is persistent world state and is revealed only by accumulated resident exploration, never by a Cardinal command or a UI animation.
174. Region discovery proceeds through an explicit staged plan and atomically commits the place, wildlife population and append-only discovery evidence.
175. Meadow, forest and sea-shore discovery is caused by resident action; discovery events identify the resident source.
176. Wildlife population, carrying capacity, recovery rate, habitat, alertness and last-change time are validated persisted state.
177. Wildlife has an endogenous recovery path in every Cardinal mode, including recovery from local depletion.
178. Hunting is a fallible resident choice influenced by resident skill and world conditions; Cardinal cannot select the hunter or target.
179. Successful hunting changes resources, skill and wildlife population together in one world tick commit; failed hunting remains evidence and does not remove an animal.
180. Walking and nature relaxation remain resident-selected alternatives rather than imposed routines.
181. Ecological sensors are read-only projections of committed places and wildlife and carry a new sensor version.
182. Cardinal experience is deterministically reconstructed from append-only evaluations and outcomes; Cardinal cannot directly increment or rewrite its own level.
183. Capability unlock thresholds are policy-versioned, explicit and auditable.
184. Cardinal capability growth may expand observation and bounded environmental proposals but never adds control of resident cognition, goals, actions, memories, skills or relationships.
185. Habitat support is a temporary bounded environmental effect that requires the learned capability, independent audit and independent gateway execution.
186. Habitat support supplements but does not replace the world's endogenous wildlife recovery.
187. The `0.3.8 -> 0.3.9` migration preserves the existing society, logical time, RNG state and historical evidence and commits as an idempotent operation.
188. A deployment containing v0.3.9 must migrate the browser-local world instead of silently replacing it with a new society.

## Audit round 10 additions — persistent people and world authority

189. Every resident has a stable world-scoped identity key that survives goal, emotion, age, relationship and life-stage changes.
190. Cardinal may not write identity, memory, agency, values or relationships; these protected domains are persisted as a fixed world constitution.
191. Cardinal world-architecture observations contain aggregate population/frontier state and no resident mind objects.
192. Biological death ends future action but does not delete identity, lineage, relationships or historical memory.
193. Birth creates a new identity and reciprocal parent/child links; it may not clone or replace either parent.
194. Parent selection is an autonomous relationship/living-condition outcome and is never a Cardinal target.
195. Children, adolescents, adults and elders have different action constraints derived from life stage, not UI appearance.
196. Multi-tick exploration and hunting plans belong to the resident and remain interruptible by severe survival pressure.
197. The frontier is not capped at the three founding regions; later geography is seeded, persistent and procedurally extensible.
198. Place connections are reciprocal and residents traverse the topology rather than treating map location as decorative text.
199. Procedural map coordinates may expand beyond the initial viewport; rendering may normalize bounds but may not rewrite stored geography.
200. Natural unexplained phenomena affect only residents who perceive them and create memories rather than global belief assignments.
201. Shared myth and emergent belief-deities arise from resident interpretation; an external deity may not impersonate an emergent belief.
202. Resident or deity entry occurs only through the independent entry gateway and never replaces a native resident.
203. A newly entered resident is subject to the same life, autonomy, mortality and persistence rules as native residents.
204. Cardinal rule authority is earned from append-only evidence and grants proposal capacity, not a direct world mutation reference.
205. Every world law belongs to a registered non-person domain and executable mechanism; unknown decorative rules are rejected.
206. A new authorized rule changes a registered engine mechanism and therefore cannot exist only as ignored prose.
207. World-law proposals require bounded ranges, fresh world revision, persistent evidence, necessity and cooldown.
208. A world-law amendment may not widen the constitutional range of an existing law.
209. Catastrophe proposals require exceptional evidence, learned capability, systemic scope, population floor, casualty ceiling and recovery plan.
210. Catastrophes may not contain resident target IDs; individual exposure comes from world conditions and resident resilience.
211. Actual catastrophe deaths may not exceed the authorized ratio and at least four possible survivors remain protected.
212. A catastrophe persists a destructive phase and a bounded recovery phase governed by a registered recovery mechanism.
213. Cardinal is not allowed to cause catastrophe merely to create entertainment, training data or faster experience.
214. v0.3.10 migrates both v0.3.8 and deployed v0.3.9 without resetting tick, RNG future, people, relationships or existing ecology.
215. Cross-tab browser frames carry a protocol version so an old open deployment cannot be rendered as the new world schema.

## Audit round 11 additions — time, physiology and civilization

216. Calendar time, biological age, birth cooldowns and physiology consume one persisted elapsed-world-minute domain.
217. A speed change is authorized only by the independent external clock gateway; Cardinal receives no clock capability.
218. External acceleration may change world minutes contributed by a worker frame but may not change the fixed semantic quantum or skip world decisions, ecology, life events or evidence.
219. Strength, endurance, mobility and recovery are derived from age and health and causally affect action cost and effectiveness.
220. Emotions remain persistent resident-owned consequences and influence choice without becoming Cardinal or UI commands.
221. Deadly monsters arise only as world-owned populations in remote geography and may injure or kill through bounded encounters.
222. Cardinal habitat support may not increase a monster population.
223. Villages and cities emerge from population and frontier maturity and persist as connected world places with append-only evidence.
224. World level is derived from actual frontier growth rather than copied from Cardinal experience or hard-coded UI text.
225. Cardinal safety pressure is derived from committed danger evidence and can produce only a bounded proposal through the independent gateway.
226. v0.3.11 migrates deployed v0.3.10 biological history into unified world minutes without replacing residents or restarting the map.

## Audit round 12 additions — physical surface and inspectable Cardinal

227. Every living resident has one persisted 2D position on an explicit world layer; browser animation may not invent causal position.
228. v0.3 currently simulates only the surface layer. Dungeon and sky layers require later explicit world rules and migration.
229. Land and reachable shore may be walked; open water is not walkable without an explicit bridge or boat route.
230. Routes are persistent deterministic world projections with non-linear waypoints and traversal semantics.
231. A traveller follows route waypoints over multiple semantic quanta and another resident's interaction may not teleport or pull that traveller off the route.
232. Founding homes and civic buildings belong to a compact persisted settlement rather than a ring around the entire frontier.
233. New villages and cities have persistent settlement identity, center, radius and member buildings.
234. Map pan, button zoom, fit-to-view and pinch zoom change only rendering and never stored world geometry.
235. Cardinal law, evaluation, proposal, intervention, outcome and audit details are requested on demand rather than copied into every live frame.
236. The console distinguishes system laws, Cardinal amendments and temporary gateway-authorized effects.
237. Missing legacy detail is reported as missing; UI text may not invent old evidence, targets, before-values or gateway reasons.
238. Opening a Cardinal record may highlight inferred affected geography, but the inference must be labeled by the record type and may not mutate the world.
239. Append-only stream length and bounded range/tail reads are performance indexes, not permission to compact evidence.
240. The live loop may keep bounded hot views and exact aggregate counters; it must not reload and clone complete Cardinal or world history on every worker frame.
241. v0.3.12 migrates deployed v0.3.11 spatially without resetting people, generations, time, frontier, Cardinal evidence or RNG future.

## Audit round 15 additions — canonical Cardinal world time

242. One Ainkrad year is 525,600 world minutes and one semantic quantum is 8,760 world minutes.
243. Technical ticks are ordering/idempotency coordinates and may not define Cardinal persistence, autonomy, cooldown, effect or outcome durations.
244. CardinalCore and CardinalAuditor independently reconstruct the same 129,600-world-minute autonomy window.
245. Intervention cooldown and authorized effect duration are persisted and enforced in canonical world minutes.
246. Every modern prediction carries `horizonWorldMinutes`; the outcome scheduler is due only when that canonical horizon is reached.
247. Modern timed research evidence must match the current world epoch, Cardinal policy, sensor and research versions and carry canonical world time.
248. Tick-only legacy evidence remains historical evidence but cannot participate in current autonomy, persistence or outcome timing.
249. Equal persisted Ainkrad time at `×1`, `×10` and `×100` must produce identical semantic opportunities and Cardinal decisions.
250. Production UI displays Ainkrad time/durations, not technical tick numbers presented as elapsed time.
251. Readable law/intervention reports, death diagnostics and world-health output are projections of committed evidence and never mutation paths.

## Audit round 18 additions — lived civilization and Underworld direction

252. Every release must make a measurable, tested step toward autonomous Underworld behavior; a larger data dump or decorative skin alone is not progress.
253. Visual evolution proceeds through explicit surface, layer and geometry migrations from 2D toward 3D; rendering may not claim a causal dimension absent from world state.
254. A stored material or meal exists only after physical production, hunting, transfer, trade or conquest. Time, UI and Cardinal may not fabricate settlement stock.
255. Renewable ecology may recover naturally, but renewable base and stored stock remain different quantities.
256. An action that requires a field, source, workshop, sacred place or target executes only after the resident physically reaches a compatible place.
257. Starting a route persists an interruptible resident intention and never applies the destination action remotely.
258. A resident may continue or abandon that intention after arrival according to changed needs, fatigue, danger and choice.
259. Livelihood is a bounded summary of repeated lived practice and vocational fit; Cardinal, UI and settlement quotas may not assign it.
260. Residents may change livelihood when another repeatedly lived path becomes more important; old practice remains evidence rather than a permanent caste.
261. Safe productive participation begins at race-appropriate youth capability, while hazardous work, hunting and adult intimacy keep stricter physical gates.
262. Satiety is persistent resident evidence and food consumption drains reachable personal or local stock; shared stores do not teleport to travellers.
263. Prosperity does not disable frontier agency. Curiosity, freedom, ambition, crowding, scarcity and long absence from the frontier may independently motivate travel.
264. Frontier appraisal considers only discovered reachable land. Expedition volunteers choose independently, travel physically and reconsider settlement at camp.
265. Prior voluntary expedition commitment may influence the camp decision but may not prevent refusal due to stress, exhaustion, injury or danger.
266. Settlement founding, abandonment, ruin, return and occupation are persistent evidence-bearing transitions, not map decoration.
267. Territorial monsters react only to residents physically present in their habitat; a destination or unfinished route is not physical presence.
268. Russian speech and Cyrillic literacy grow through conversations, teaching and writing evidence; migration may not invent a language history.
269. Observer-visible dialogue must quote persisted utterance/reply evidence and may not generate retrospective NPC speech for presentation.
270. Cardinal may observe aggregate satiety, mobility, profession diversity and action balance, but gains no resident mind, action, profession or language writer.
271. Closed-tab catch-up executes every semantic quantum and may batch only commits, observations and rendering; progress/ETA is presentation, not simulated time.
272. Catch-up targets are absolute and epoch-scoped, making exact retries idempotent and preventing duplicate tabs from double-advancing time.
273. Player-entry types remain dormant until a later explicit migration and independent gateway activation; Cardinal cannot authenticate, embody or steer the future player.
274. Original strategy-style visual hierarchy may improve readability, but proprietary assets/code are not copied and graphics never become an NPC controller.
