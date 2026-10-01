import type { Chapter } from './chapter';
import { conditionReferences, type Condition } from './conditions';
import { checkRecordIntegrity } from './content-records';
import { danglingNodeRefs, RESERVED_SPEAKERS } from './dialogue';
import type { Effect } from './effects';
import { ALL_EVENT_TYPES } from './events';
import { packRuleItems, type LoadoutRule, type PackRule } from './puzzle-base';
import { shortestDyeings } from './puzzle-dyeing';
import { floorplanLayouts } from './puzzle-floorplan';
import { logicGridSolutions, logicRuleRefs } from './puzzle-logic-grid';
import { exitsFrom, isRoad, walk } from './puzzle-map';
import { nettingSolutions } from './puzzle-netting';
import { isSolidTile, parseLayout, tileAt, type TileGrid } from './world';

/**
 * Referential integrity for a chapter: every id that content mentions must
 * exist. Zod checks SHAPE; this checks MEANING. Run at build time
 * (scripts/validate-content.ts), in unit tests, and when a chapter loads.
 */
export interface IntegrityIssue {
  where: string;
  message: string;
}

export function validateChapterIntegrity(chapter: Chapter): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const add = (where: string, message: string): void => {
    issues.push({ where, message });
  };

  const ids = {
    items: new Set(chapter.items.map((i) => i.id)),
    quests: new Map(chapter.quests.map((q) => [q.id, q])),
    choices: new Map(chapter.choices.map((c) => [c.id, c])),
    clues: new Set(chapter.clues.map((c) => c.id)),
    puzzles: new Set(chapter.puzzles.map((p) => p.id)),
    scenes: new Map(chapter.scenes.map((s) => [s.id, s])),
    characters: new Set(chapter.characters.map((c) => c.id)),
    dialogues: new Set(chapter.dialogues.map((d) => d.id)),
    journal: new Set(chapter.journal.map((j) => j.id)),
    records: new Map(chapter.records.map((r) => [r.id, r])),
    sources: new Set(chapter.sources.map((s) => s.id)),
    themes: new Set(chapter.themes.map((t) => t.id)),
  };

  // Duplicate ids within each collection.
  const collections: Array<[string, Array<{ id: string }>]> = [
    ['items', chapter.items],
    ['quests', chapter.quests],
    ['choices', chapter.choices],
    ['clues', chapter.clues],
    ['puzzles', chapter.puzzles],
    ['scenes', chapter.scenes],
    ['characters', chapter.characters],
    ['dialogues', chapter.dialogues],
    ['journal', chapter.journal],
    ['records', chapter.records],
    ['sources', chapter.sources],
    ['themes', chapter.themes],
  ];
  for (const [name, list] of collections) {
    const seen = new Set<string>();
    for (const { id } of list) {
      if (seen.has(id)) add(name, `duplicate id '${id}'`);
      seen.add(id);
    }
  }

  const checkCondition = (where: string, condition: Condition | undefined): void => {
    if (!condition) return;
    const refs = conditionReferences(condition);
    refs.items.forEach((x) => !ids.items.has(x) && add(where, `unknown item '${x}'`));
    refs.quests.forEach((x) => !ids.quests.has(x) && add(where, `unknown quest '${x}'`));
    refs.choices.forEach((x) => !ids.choices.has(x) && add(where, `unknown choice '${x}'`));
    refs.clues.forEach((x) => !ids.clues.has(x) && add(where, `unknown clue '${x}'`));
    refs.puzzles.forEach((x) => !ids.puzzles.has(x) && add(where, `unknown puzzle '${x}'`));
    refs.scenes.forEach((x) => !ids.scenes.has(x) && add(where, `unknown scene '${x}'`));
    refs.characters.forEach(
      (x) => !ids.characters.has(x) && add(where, `unknown character '${x}'`),
    );
    refs.dialogues.forEach((x) => !ids.dialogues.has(x) && add(where, `unknown dialogue '${x}'`));
    refs.journal.forEach((x) => !ids.journal.has(x) && add(where, `unknown journal entry '${x}'`));
    walkCondition(condition, (c) => {
      if (c.type === 'questStage') {
        const quest = ids.quests.get(c.quest);
        if (quest && !quest.stages.some((s) => s.id === c.stage))
          add(where, `quest '${c.quest}' has no stage '${c.stage}'`);
      }
      if (c.type === 'objectiveDone') {
        const quest = ids.quests.get(c.quest);
        if (quest && !quest.stages.some((s) => s.objectives.some((o) => o.id === c.objective)))
          add(where, `quest '${c.quest}' has no objective '${c.objective}'`);
      }
      if (c.type === 'choiceMade' && c.option) {
        const choice = ids.choices.get(c.choice);
        if (choice && !choice.options.some((o) => o.id === c.option))
          add(where, `choice '${c.choice}' has no option '${c.option}'`);
      }
    });
  };

  const checkEffects = (where: string, effects: readonly Effect[] | undefined): void => {
    for (const e of effects ?? []) {
      switch (e.type) {
        case 'giveItem':
        case 'takeItem':
          if (!ids.items.has(e.item)) add(where, `unknown item '${e.item}'`);
          break;
        case 'startQuest':
          if (!ids.quests.has(e.quest)) add(where, `unknown quest '${e.quest}'`);
          break;
        case 'completeObjective': {
          const quest = ids.quests.get(e.quest);
          if (!quest) add(where, `unknown quest '${e.quest}'`);
          else if (!quest.stages.some((s) => s.objectives.some((o) => o.id === e.objective)))
            add(where, `quest '${e.quest}' has no objective '${e.objective}'`);
          break;
        }
        case 'unlockJournal':
          if (!ids.journal.has(e.entry)) add(where, `unknown journal entry '${e.entry}'`);
          break;
        case 'discoverClue':
          if (!ids.clues.has(e.clue)) add(where, `unknown clue '${e.clue}'`);
          break;
        case 'adjustTrust':
        case 'meetCharacter':
          if (!ids.characters.has(e.character)) add(where, `unknown character '${e.character}'`);
          break;
        case 'recordChoice': {
          const choice = ids.choices.get(e.choice);
          if (!choice) add(where, `unknown choice '${e.choice}'`);
          else if (!choice.options.some((o) => o.id === e.option))
            add(where, `choice '${e.choice}' has no option '${e.option}'`);
          break;
        }
        case 'openPuzzle':
          if (!ids.puzzles.has(e.puzzle)) add(where, `unknown puzzle '${e.puzzle}'`);
          break;
        case 'transition': {
          const scene = ids.scenes.get(e.scene);
          if (!scene) add(where, `unknown scene '${e.scene}'`);
          else if (!scene.spawns[e.spawn])
            add(where, `scene '${e.scene}' has no spawn '${e.spawn}'`);
          break;
        }
        case 'startDialogue':
          if (!ids.dialogues.has(e.dialogue)) add(where, `unknown dialogue '${e.dialogue}'`);
          break;
        default:
          break;
      }
    }
  };

  const checkRecord = (where: string, recordId: string): void => {
    if (!ids.records.has(recordId)) add(where, `unknown content record '${recordId}'`);
  };

  // Start + main quest
  const startScene = ids.scenes.get(chapter.start.scene);
  if (!startScene) add('chapter.start', `unknown scene '${chapter.start.scene}'`);
  else if (!startScene.spawns[chapter.start.spawn])
    add('chapter.start', `scene '${chapter.start.scene}' has no spawn '${chapter.start.spawn}'`);
  if (!ids.quests.has(chapter.mainQuest))
    add('chapter.mainQuest', `unknown quest '${chapter.mainQuest}'`);
  checkEffects('chapter.opening', chapter.opening);
  if (chapter.lightItem && !ids.items.has(chapter.lightItem))
    add('chapter.lightItem', `unknown item '${chapter.lightItem}'`);
  Object.keys(chapter.initial.inventory).forEach(
    (i) => !ids.items.has(i) && add('chapter.initial', `unknown item '${i}'`),
  );

  // Records
  chapter.records.forEach((r) =>
    checkRecordIntegrity(r, ids.sources).forEach((i) => add(`record ${i.recordId}`, i.message)),
  );

  // Characters
  chapter.characters.forEach((c) => {
    if (c.journalEntry && !ids.journal.has(c.journalEntry))
      add(`character ${c.id}`, `unknown journal entry '${c.journalEntry}'`);
  });

  // Dialogues
  const validSpeakers = new Set<string>([...ids.characters, ...RESERVED_SPEAKERS]);
  chapter.dialogues.forEach((d) => {
    const where = `dialogue ${d.id}`;
    if (d.characterId && !ids.characters.has(d.characterId))
      add(where, `unknown character '${d.characterId}'`);
    danglingNodeRefs(d).forEach((n) => add(where, `references missing node '${n}'`));
    d.entries.forEach((e) => checkCondition(where, e.when));
    d.nodes.forEach((n) => {
      const nWhere = `${where} node ${n.id}`;
      if (!validSpeakers.has(n.speaker)) add(nWhere, `unknown speaker '${n.speaker}'`);
      if (n.kind === 'paraphrase' || n.kind === 'scripture') {
        if (!n.recordId) add(nWhere, `${n.kind} lines must link a content record (recordId)`);
        else {
          const rec = ids.records.get(n.recordId);
          if (!rec) add(nWhere, `unknown content record '${n.recordId}'`);
          else if (rec.kind !== 'paraphrase' && rec.kind !== 'scripture')
            add(nWhere, `${n.kind} line links a '${rec.kind}' record`);
        }
      } else if (n.recordId) {
        checkRecord(nWhere, n.recordId);
      }
      checkEffects(nWhere, n.effects);
      n.branches.forEach((b) => checkCondition(`${nWhere} branch`, b.when));
      n.choices.forEach((c) => {
        const cWhere = `${nWhere} choice ${c.id}`;
        checkCondition(cWhere, c.when);
        checkCondition(cWhere, c.requires);
        checkEffects(cWhere, c.effects);
      });
    });
  });

  // Quests
  const validEvents = new Set<string>(ALL_EVENT_TYPES);
  chapter.quests.forEach((q) => {
    const where = `quest ${q.id}`;
    checkCondition(where, q.prerequisites);
    checkCondition(where, q.failWhen);
    if (q.failWhen && !q.outcomes.some((o) => o.id === q.failOutcome))
      add(where, `failWhen requires a failOutcome that exists`);
    [...q.eventsConsumed, ...q.eventsEmitted].forEach(
      (e) => !validEvents.has(e) && add(where, `unknown event type '${e}'`),
    );
    if (q.journal.onStart && !ids.journal.has(q.journal.onStart))
      add(where, `unknown journal entry '${q.journal.onStart}'`);
    if (q.journal.onComplete && !ids.journal.has(q.journal.onComplete))
      add(where, `unknown journal entry '${q.journal.onComplete}'`);
    const stageIds = new Set(q.stages.map((s) => s.id));
    q.stages.forEach((s) => {
      if (s.next && !stageIds.has(s.next))
        add(`${where} stage ${s.id}`, `unknown next stage '${s.next}'`);
      checkEffects(`${where} stage ${s.id}`, s.onEnter);
      s.objectives.forEach((o) => {
        checkCondition(`${where} objective ${o.id}`, o.completeWhen);
        checkCondition(`${where} objective ${o.id}`, o.revealWhen);
      });
    });
    q.outcomes.forEach((o) => {
      checkCondition(`${where} outcome ${o.id}`, o.when);
      checkEffects(`${where} outcome ${o.id}`, o.rewards);
    });
  });

  // Clues & journal
  chapter.clues.forEach((c) => c.recordIds.forEach((r) => checkRecord(`clue ${c.id}`, r)));
  chapter.journal.forEach((j) => {
    j.recordIds.forEach((r) => checkRecord(`journal ${j.id}`, r));
    checkCondition(`journal ${j.id}`, j.unlockWhen);
    if (j.characterId && !ids.characters.has(j.characterId))
      add(`journal ${j.id}`, `unknown character '${j.characterId}'`);
  });

  const checkLoadout = (
    where: string,
    p: {
      choiceId: string;
      classifications: Array<{ option: string; rule: PackRule }>;
      rules: LoadoutRule[];
    },
  ): void => {
    const choice = ids.choices.get(p.choiceId);
    if (!choice) add(where, `unknown choice '${p.choiceId}'`);
    else
      p.classifications.forEach(
        (c) =>
          !choice.options.some((o) => o.id === c.option) &&
          add(where, `classification option '${c.option}' is not an option of '${p.choiceId}'`),
      );
    [...p.rules.map((r) => r.rule), ...p.classifications.map((c) => c.rule)]
      .flatMap(packRuleItems)
      .forEach((item) => !ids.items.has(item) && add(where, `unknown item '${item}'`));
  };

  // Puzzles
  chapter.puzzles.forEach((p) => {
    const where = `puzzle ${p.id}`;
    p.recordIds.forEach((r) => checkRecord(where, r));
    checkEffects(where, p.onSolved);
    switch (p.type) {
      case 'packing':
        checkLoadout(where, p);
        break;
      case 'trim': {
        checkLoadout(where, p);
        const places = new Set(p.places.map((pl) => pl.id));
        p.crew.forEach(
          (c) =>
            !places.has(c.place) && add(where, `crew '${c.id}' sits in unknown place '${c.place}'`),
        );
        p.balance.forEach((b) =>
          b.between.forEach(
            (pl) => !places.has(pl) && add(where, `balance '${b.id}' names unknown place '${pl}'`),
          ),
        );
        if (p.places.reduce((s, pl) => s + pl.limit, 0) < p.capacity)
          add(where, 'the places together have less room than the capacity');
        break;
      }
      case 'netting': {
        const width = p.pattern[0]?.length ?? 0;
        if (p.pattern.some((r) => r.length !== width) || p.torn.some((r) => r.length !== width))
          add(where, 'every pattern and torn row must be the same width');
        if (p.torn.length !== p.pattern.length)
          add(where, 'torn must have a row for every pattern row');
        if (!p.torn.some((r) => r.includes('?'))) add(where, 'nothing is torn');
        const solutions = nettingSolutions(p);
        if (solutions.length !== 1)
          add(
            where,
            `the numbers allow ${solutions.length === 0 ? 'no' : 'more than one'} mended net`,
          );
        break;
      }
      case 'floorplan': {
        checkLoadout(where, p);
        const width = p.floor[0]?.length ?? 0;
        if (p.floor.some((r) => r.length !== width))
          add(where, 'every floor row must be the same width');
        const symbols = new Set(p.fixtures.map((f) => f.symbol));
        [...p.floor.join('')].forEach(
          (ch) =>
            ch !== '.' && !symbols.has(ch) && add(where, `floor symbol '${ch}' has no fixture`),
        );
        p.pieces.forEach(
          (piece) => !ids.items.has(piece.item) && add(where, `unknown item '${piece.item}'`),
        );
        p.pieces.forEach(
          (piece) =>
            floorplanLayouts(p, [piece.item], 1).length === 0 &&
            add(where, `'${piece.item}' fits nowhere on the floor`),
        );
        break;
      }
      case 'logicGrid': {
        const subjects = new Set(p.subjects.map((x) => x.id));
        const options = new Set(p.options.map((x) => x.id));
        p.clues.forEach((c) => {
          const refs = logicRuleRefs(c.rule);
          refs.subjects.forEach(
            (x) => !subjects.has(x) && add(where, `clue '${c.id}': unknown subject '${x}'`),
          );
          refs.options.forEach(
            (x) => !options.has(x) && add(where, `clue '${c.id}': unknown option '${x}'`),
          );
        });
        if (p.subjects.length !== p.options.length)
          add(where, 'there must be exactly one option for each subject');
        const solutions = logicGridSolutions(p);
        const answer = p.subjects.map((x) => p.answer[x.id]).join();
        if (solutions.length !== 1)
          add(where, `the clues allow ${solutions.length} answers, not exactly one`);
        else if (p.subjects.map((x) => solutions[0]?.[x.id]).join() !== answer)
          add(where, 'the answer does not keep every clue');
        break;
      }
      case 'dyeing': {
        const colours = new Set(p.colours.map((c) => c.id));
        const levels = [
          p.target,
          ...p.baths.map((b) => b.change),
          ...p.shades.map((sh) => sh.levels),
        ];
        levels.forEach((l) =>
          Object.keys(l).forEach((k) => !colours.has(k) && add(where, `unknown colour '${k}'`)),
        );
        if (Object.values(p.target).some((v) => v > p.max))
          add(where, 'the target is darker than the maximum');
        const shortest = shortestDyeings(p);
        if (shortest.length === 0) add(where, `the target can't be reached in ${p.maxDips} dips`);
        else if ((shortest[0]?.length ?? 0) < p.maxDips)
          add(where, `the target can be reached in fewer than ${p.maxDips} dips; lower maxDips`);
        break;
      }
      case 'map': {
        const width = p.map[0]?.length ?? 0;
        if (p.map.some((r) => r.length !== width))
          add(where, 'every map row must be the same width');
        p.landmarks.forEach(
          (l) => !isRoad(p, l.x, l.y) && add(where, `landmark '${l.id}' is not on a road`),
        );
        if (!p.landmarks.some((l) => l.id === p.goal))
          add(where, `goal '${p.goal}' is not a landmark`);
        Object.keys(p.wrongStops).forEach(
          (k) =>
            !p.landmarks.some((l) => l.id === k) &&
            add(where, `wrong stop '${k}' is not a landmark`),
        );
        if (!isRoad(p, p.start.x, p.start.y)) add(where, 'the start is not on a road');
        // The goal must be reachable by walking.
        const goal = p.landmarks.find((l) => l.id === p.goal);
        const seen = new Set<string>();
        const queue = [{ ...p.start }];
        while (queue.length > 0) {
          const at = queue.shift();
          if (!at || seen.has(`${at.x},${at.y}`)) continue;
          seen.add(`${at.x},${at.y}`);
          for (const d of exitsFrom(p, at.x, at.y)) {
            const next = walk(p, at, d);
            if (next) queue.push(next.position);
          }
        }
        if (goal && !seen.has(`${goal.x},${goal.y}`)) add(where, 'the goal cannot be reached');
        break;
      }
      case 'measuring':
        if (!p.vessels.some((v) => v.id === p.goal.vessel))
          add(where, `goal vessel '${p.goal.vessel}' missing`);
        break;
      case 'deduction':
        if (!p.options.some((o) => o.id === p.answer))
          add(where, `answer '${p.answer}' is not an option`);
        p.evidence.forEach(
          (e) => !ids.clues.has(e.clueId) && add(where, `unknown clue '${e.clueId}'`),
        );
        break;
      case 'sequence': {
        const cardIds = new Set(p.cards.map((c) => c.id));
        [...p.correctOrder, ...p.initialOrder].forEach(
          (c) => !cardIds.has(c) && add(where, `unknown card '${c}'`),
        );
        if (p.correctOrder.length !== p.cards.length)
          add(where, 'correctOrder must list every card once');
        if (p.initialOrder.join() === p.correctOrder.join())
          add(where, 'initialOrder must not already be solved');
        p.cards.forEach(
          (c) => c.clueId && !ids.clues.has(c.clueId) && add(where, `unknown clue '${c.clueId}'`),
        );
        p.requiresClues?.clues.forEach(
          (c) => !ids.clues.has(c) && add(where, `unknown clue '${c}'`),
        );
        if (p.conclusion && !p.conclusion.options.some((o) => o.correct))
          add(where, 'conclusion needs at least one correct option');
        break;
      }
    }
  });

  chapter.playerLooks.forEach((look, i) => checkCondition(`player look ${i}`, look.when));

  // Scenes
  chapter.scenes.forEach((s) => {
    const where = `scene ${s.id}`;
    let grid: TileGrid | null = null;
    try {
      grid = parseLayout(s);
    } catch (err) {
      add(where, (err as Error).message);
    }
    const walkable = (x: number, y: number): boolean =>
      grid !== null && !isSolidTile(tileAt(grid, x, y));
    Object.entries(s.spawns).forEach(([id, sp]) => {
      if (grid && !walkable(sp.x, sp.y))
        add(where, `spawn '${id}' is on a solid or out-of-bounds tile`);
    });
    s.weatherChanges.forEach((change, i) =>
      checkCondition(`${where} weather change ${i}`, change.when),
    );
    s.musicChanges.forEach((change, i) =>
      checkCondition(`${where} music change ${i}`, change.when),
    );
    s.entities.forEach((e) => {
      const eWhere = `${where} entity ${e.id}`;
      if (grid && (e.x >= grid.width || e.y >= grid.height)) add(eWhere, 'is outside the map');
      if (e.characterId && !ids.characters.has(e.characterId))
        add(eWhere, `unknown character '${e.characterId}'`);
      checkCondition(eWhere, e.visibleWhen);
      e.looks.forEach((look, i) => checkCondition(`${eWhere} look ${i}`, look.when));
      if (e.looks.length > 0 && !e.characterId)
        add(eWhere, 'looks change how a person appears, but this entity has no character');
      if (e.interaction) {
        if (e.interaction.dialogue && !ids.dialogues.has(e.interaction.dialogue))
          add(eWhere, `unknown dialogue '${e.interaction.dialogue}'`);
        checkCondition(eWhere, e.interaction.requires);
        checkEffects(eWhere, e.interaction.effects);
        if (!e.interaction.dialogue && e.interaction.effects.length === 0)
          add(eWhere, 'interaction does nothing (no dialogue or effects)');
      }
    });
    s.exits.forEach((x) => {
      const xWhere = `${where} exit ${x.id}`;
      const target = ids.scenes.get(x.to.scene);
      if (!target) add(xWhere, `unknown scene '${x.to.scene}'`);
      else if (!target.spawns[x.to.spawn])
        add(xWhere, `scene '${x.to.scene}' has no spawn '${x.to.spawn}'`);
      checkCondition(xWhere, x.requires);
      checkEffects(xWhere, x.effects);
      if (x.blockedDialogue && !ids.dialogues.has(x.blockedDialogue))
        add(xWhere, `unknown dialogue '${x.blockedDialogue}'`);
      if (x.requires && !x.blockedDialogue && !x.blockedText)
        add(xWhere, 'restricted exits must explain themselves (blockedDialogue or blockedText)');
      if (grid && !walkable(x.x, x.y)) add(xWhere, 'exit tile must be walkable');
    });
    s.triggers.forEach((t) => {
      if (t.area && grid && (t.area.x + t.area.w > grid.width || t.area.y + t.area.h > grid.height))
        add(`${where} trigger ${t.id}`, 'area extends outside the map');
      checkCondition(`${where} trigger ${t.id}`, t.when);
      checkEffects(`${where} trigger ${t.id}`, t.effects);
    });
    checkEffects(`${where} onEnter`, s.onEnter);
  });

  // The teaser's words are a content record like any other.
  if (chapter.teaser) {
    checkRecord('teaser', chapter.teaser.recordId);
    const rec = ids.records.get(chapter.teaser.recordId);
    if (rec) {
      const words = chapter.teaser.cues.map((c) => c.text);
      if (words.some((w) => !(rec.body ?? '').includes(w)))
        add(
          'teaser',
          `every cue's words must appear in its record '${rec.id}' (what editors review)`,
        );
    }
  }

  // Connection + summary
  chapter.scriptureConnection.sections.forEach((sec) =>
    sec.recordIds.forEach((r) => checkRecord('scriptureConnection', r)),
  );
  chapter.scriptureConnection.comparisons.forEach((c) =>
    checkCondition('scriptureConnection', c.when),
  );
  chapter.summary.recap.forEach((r) => checkCondition('summary.recap', r.when));
  chapter.summary.consequences.forEach((c) =>
    checkCondition(`summary.consequence ${c.id}`, c.when),
  );
  chapter.summary.themes.forEach(
    (t) => !ids.themes.has(t) && add('summary.themes', `unknown theme '${t}'`),
  );
  [...chapter.summary.scriptureRecordIds, ...chapter.summary.historyRecordIds].forEach((r) =>
    checkRecord('summary', r),
  );
  chapter.choices.forEach((c) =>
    c.themes.forEach((t) => !ids.themes.has(t) && add(`choice ${c.id}`, `unknown theme '${t}'`)),
  );

  return issues;
}

function walkCondition(c: Condition, visit: (c: Condition) => void): void {
  visit(c);
  if (c.type === 'all' || c.type === 'any') c.of.forEach((x) => walkCondition(x, visit));
  if (c.type === 'not') walkCondition(c.condition, visit);
}
