import fs from 'node:fs';

const changed = [];
const lines = (...items) => items.join('\n');
function update(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after !== before) {
    fs.writeFileSync(path, after);
    changed.push(path);
  }
}
function replaceOnce(text, before, after, label) {
  if (text.includes(after)) return text;
  const index = text.indexOf(before);
  if (index < 0) throw new Error(`Family rendezvous anchor not found: ${label}`);
  return text.slice(0, index) + after + text.slice(index + before.length);
}

// A mutual child intention is stronger than a casual remembered meeting, but
// it is still not an engine command. It increases the resident's own weight for
// choosing bond/rendezvous again; ordinary needs can still win the decision.
update('src/world/WorldEngine.ts', (text) => {
  let next = replaceOnce(
    text,
    lines(
      '    const activeFamilyIntent = this.familyRendezvousForAgent(agent.id);',
      '    const familyMeetingAvailable = Boolean(',
    ),
    lines(
      '    const activeFamilyIntent = this.familyRendezvousForAgent(agent.id);',
      '    const committedFamilyIntent = this.familyIntentForAgent(agent.id);',
      '    const familyMeetingAvailable = Boolean(',
    ),
    'separate committed child intent from casual rendezvous',
  );

  next = replaceOnce(
    next,
    lines(
      "            learnedKnowledgeBoost('bond') +",
      "            goalBoost('build_family') +",
      '            (activeFamilyIntent ? 0.14 : 0)',
    ),
    lines(
      "            learnedKnowledgeBoost('bond') +",
      "            goalBoost('build_family') +",
      '            (committedFamilyIntent ? 0.62 : activeFamilyIntent ? 0.14 : 0)',
    ),
    'persist voluntary child-intent rendezvous priority',
  );

  next = replaceOnce(
    next,
    lines(
      '        const target = this.chooseBondTarget(',
      '          agent,',
      '          this.agentsAtLocation(agent.locationId),',
      '        );',
    ),
    lines(
      '        if (',
      '          familyIntent &&',
      '          agent.locationId === familyIntent.meetingPlaceId &&',
      '          (!intendedPartner ||',
      '            intendedPartner.movement ||',
      '            intendedPartner.locationId !== agent.locationId)',
      '        ) {',
      '          // The resident already chose bond this quantum and reached the',
      '          // remembered rendezvous. Waiting here executes that voluntary',
      '          // choice instead of immediately walking away to reflect elsewhere.',
      '          // The next quantum remains a fresh autonomous decision.',
      '          agent.energy = clamp01(agent.energy + 0.004);',
      '          agent.stress = clamp01(agent.stress - 0.006);',
      "          agent.lastAction = 'bond';",
      '          break;',
      '        }',
      '        const target = this.chooseBondTarget(',
      '          agent,',
      '          this.agentsAtLocation(agent.locationId),',
      '        );',
    ),
    'wait at chosen rendezvous instead of immediately leaving',
  );

  return next;
});

console.log(JSON.stringify({ changed }, null, 2));
