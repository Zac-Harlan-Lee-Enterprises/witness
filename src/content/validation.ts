import type { Chapter } from '@/domain/chapter';
import {
  CONTENT_KINDS,
  EDUCATIONAL_KINDS,
  isPublishable,
  type ContentKind,
} from '@/domain/content-records';
import { approachTiles, blockedFn, findPath } from '@/domain/navigation';
import { inRect, parseLayout } from '@/domain/world';

/**
 * Content checks beyond schema + references:
 *  - reachability: from every spawn, every interactive entity and exit must be
 *    reachable (ignoring puzzle-gated blockers), so no player can get stuck;
 *  - spawns must not sit inside an exit (would bounce the player immediately);
 *  - governance report for editors.
 */
export function reachabilityIssues(chapter: Chapter): string[] {
  const issues: string[] = [];
  for (const scene of chapter.scenes) {
    const grid = parseLayout(scene);
    // Blockers that disappear once solved (visibleWhen) don't count as walls.
    const permanentSolids = scene.entities.filter((e) => e.solid && e.visibleWhen === undefined);
    const blocked = blockedFn(grid, permanentSolids);
    for (const [spawnId, spawn] of Object.entries(scene.spawns)) {
      if (scene.exits.some((x) => inRect(spawn.x, spawn.y, x))) {
        issues.push(`${scene.id}: spawn '${spawnId}' is inside an exit`);
      }
      for (const entity of scene.entities.filter((e) => e.interaction)) {
        const goals = approachTiles({ x: entity.x, y: entity.y }, entity.solid, blocked);
        if (findPath(spawn, goals, blocked) === null) {
          issues.push(`${scene.id}: '${entity.id}' is unreachable from spawn '${spawnId}'`);
        }
      }
      for (const exit of scene.exits) {
        const goals = [];
        for (let y = exit.y; y < exit.y + exit.h; y++)
          for (let x = exit.x; x < exit.x + exit.w; x++) goals.push({ x, y });
        if (findPath(spawn, goals, blocked) === null) {
          issues.push(`${scene.id}: exit '${exit.id}' is unreachable from spawn '${spawnId}'`);
        }
      }
    }
  }
  return issues;
}

export interface ContentReport {
  total: number;
  educational: number;
  approved: number;
  awaitingReview: number;
  unapproved: string[];
  byKind: Record<ContentKind, number>;
  sources: number;
  verifiedSources: number;
}

export function contentReport(chapter: Chapter): ContentReport {
  const byKind = Object.fromEntries(CONTENT_KINDS.map((k) => [k, 0])) as Record<
    ContentKind,
    number
  >;
  chapter.records.forEach((r) => {
    byKind[r.kind] += 1;
  });
  const educational = chapter.records.filter((r) => EDUCATIONAL_KINDS.includes(r.kind));
  const unapproved = educational
    .filter((r) => !isPublishable(r))
    .map((r) => `${r.id} (${r.kind}, ${r.governance.status})`);
  return {
    total: chapter.records.length,
    educational: educational.length,
    approved: educational.length - unapproved.length,
    awaitingReview: unapproved.length,
    unapproved,
    byKind,
    sources: chapter.sources.length,
    verifiedSources: chapter.sources.filter((s) => s.verified).length,
  };
}
