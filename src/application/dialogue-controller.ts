import type { Chapter } from '@/domain/chapter';
import {
  continuationOf,
  DialogueError,
  entryNodeId,
  findNode,
  interpolate,
  visibleChoices,
  type Dialogue,
  type DialogueNode,
} from '@/domain/dialogue';
import type { Effect } from '@/domain/effects';
import type { Logger } from '@/shared/logger';
import type { GameSession } from './game-session';
import type { DialogueSpeakerView, DialogueView, UiStore } from './ui-store';

/**
 * Runs one conversation at a time on top of the pure dialogue engine:
 * applies node/choice effects through the session, keeps the dialogue log
 * (history) and publishes ConversationStarted / ConversationCompleted.
 * A missing node ends the conversation gracefully instead of crashing.
 */
export interface DialogueVars {
  player: string;
}

export class DialogueController {
  private active: { dialogue: Dialogue; node: DialogueNode } | null = null;

  constructor(
    private readonly session: GameSession,
    private readonly ui: UiStore,
    private readonly vars: () => DialogueVars,
    private readonly playerSpeaker: () => DialogueSpeakerView,
    private readonly logger: Logger,
  ) {}

  private get chapter(): Chapter {
    return this.session.chapter;
  }

  get isActive(): boolean {
    return this.active !== null;
  }

  start(dialogueId: string): boolean {
    if (this.active) {
      this.logger.warn(
        `Dialogue '${dialogueId}' requested while '${this.active.dialogue.id}' is active`,
      );
      return false;
    }
    const dialogue = this.chapter.dialogues.find((d) => d.id === dialogueId);
    if (!dialogue) {
      this.logger.error(`Unknown dialogue '${dialogueId}'`);
      return false;
    }
    const character = this.chapter.characters.find((c) => c.id === dialogue.characterId);
    // Choose the entry BEFORE recording the meeting, so a `met` condition means
    // "met before this conversation" (otherwise a stranger greets you like a friend).
    const entry = entryNodeId(dialogue, this.session.state);
    this.session.publish([
      { type: 'ConversationStarted', dialogueId, characterId: character?.id ?? null },
    ]);
    if (character) {
      const meet: Effect[] = [{ type: 'meetCharacter', character: character.id }];
      if (character.journalEntry)
        meet.push({ type: 'unlockJournal', entry: character.journalEntry });
      this.session.dispatch(meet);
    }
    this.enter(dialogue, entry);
    return true;
  }

  choose(choiceId: string): void {
    const current = this.active;
    if (!current) return;
    const choice = current.node.choices.find((c) => c.id === choiceId);
    const view = visibleChoices(current.dialogue, current.node, this.session.state).find(
      (c) => c.id === choiceId,
    );
    if (!choice || !view?.available) {
      this.logger.warn(
        `Choice '${choiceId}' is not available in ${current.dialogue.id}/${current.node.id}`,
      );
      return;
    }
    this.session.logDialogue({
      dialogueId: current.dialogue.id,
      nodeId: current.node.id,
      choiceId,
    });
    this.session.dispatch(choice.effects);
    if (choice.next) this.enter(current.dialogue, choice.next);
    else this.end();
  }

  /** Continue from a node without choices. */
  advance(): void {
    const current = this.active;
    if (!current) return;
    if (visibleChoices(current.dialogue, current.node, this.session.state).length > 0) return;
    const next = continuationOf(current.node, this.session.state);
    if (next) this.enter(current.dialogue, next);
    else this.end();
  }

  end(): void {
    const current = this.active;
    if (!current) return;
    this.active = null;
    this.ui.setDialogue(null);
    this.session.markConversationDone(current.dialogue.id);
    this.session.publish([{ type: 'ConversationCompleted', dialogueId: current.dialogue.id }]);
  }

  private enter(dialogue: Dialogue, nodeId: string): void {
    let node: DialogueNode;
    try {
      node = findNode(dialogue, nodeId);
    } catch (error) {
      if (!(error instanceof DialogueError)) throw error;
      this.logger.error(error.message);
      this.active = {
        dialogue,
        node: {
          id: '__missing',
          speaker: 'narrator',
          text: '…',
          kind: 'fiction',
          effects: [],
          choices: [],
          branches: [],
        },
      };
      this.end();
      return;
    }
    this.active = { dialogue, node };
    this.session.logDialogue({ dialogueId: dialogue.id, nodeId: node.id, choiceId: null });
    this.session.dispatch(node.effects);
    // Effects may have ended the conversation's relevance but never the node itself.
    this.render();
  }

  /** Recompute the view (e.g. after state changed availability). */
  render(): void {
    const current = this.active;
    if (!current) return;
    const { dialogue, node } = current;
    const choices = visibleChoices(dialogue, node, this.session.state);
    const record = node.recordId
      ? (this.chapter.records.find((r) => r.id === node.recordId) ?? null)
      : null;
    const view: DialogueView = {
      dialogueId: dialogue.id,
      nodeId: node.id,
      speaker: this.speaker(node.speaker),
      text: interpolate(node.text, { ...this.vars() }),
      kind: node.kind,
      record,
      choices,
      canContinue: choices.length === 0,
      isLast: choices.length === 0 && continuationOf(node, this.session.state) === null,
    };
    this.ui.setDialogue(view);
  }

  private speaker(id: string): DialogueSpeakerView {
    if (id === 'player') return this.playerSpeaker();
    if (id === 'narrator')
      return { id, name: 'Narrator', role: null, appearance: null, kind: 'narrator' };
    const c = this.chapter.characters.find((x) => x.id === id);
    return c
      ? { id: c.id, name: c.name, role: c.role, appearance: c.appearance, kind: 'character' }
      : { id, name: id, role: null, appearance: null, kind: 'character' };
  }
}
