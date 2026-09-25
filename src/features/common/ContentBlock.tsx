import type { Source } from '@/domain/content-records';
import {
  CONTENT_KIND_LABELS,
  isPublishable,
  type ContentKind,
  type ContentRecord,
} from '@/domain/content-records';
import { formatScriptureRef } from '@/domain/scripture';
import { useServices } from './services';

/**
 * Renders one ContentRecord with its KIND always visible (as words, not just
 * colour), Scripture references kept separate from displayed text, sources
 * available on demand, and a review label while content awaits editors.
 */
const KIND_ICONS: Record<ContentKind, string> = {
  scripture: '📖',
  paraphrase: '✎',
  historical: '🏛',
  reconstruction: '🧩',
  interpretation: '💭',
  fiction: '🎭',
  instruction: 'ℹ',
};

export function ContentKindBadge({ kind }: { kind: ContentKind }) {
  return (
    <span className={`badge badge--${kind}`}>
      <span aria-hidden="true">{KIND_ICONS[kind]}</span> {CONTENT_KIND_LABELS[kind]}
    </span>
  );
}

const CONFIDENCE_LABELS: Record<string, string> = {
  established: 'Well established',
  probable: 'Probable',
  possible: 'Possible',
  tradition: 'Tradition',
  uncertain: 'Uncertain',
};

export function ContentBlock({
  record,
  sources,
  headingLevel = 3,
}: {
  record: ContentRecord;
  sources: readonly Source[];
  headingLevel?: 3 | 4;
}) {
  const { scripture, config } = useServices();
  const Heading = headingLevel === 3 ? 'h3' : 'h4';
  const g = record.governance;
  const showReview = config.contentMode === 'preview' && !isPublishable(record);
  const cited = record.sources
    .map((id) => sources.find((s) => s.id === id))
    .filter((s): s is Source => s !== undefined);

  return (
    <article
      className={`content-block content-block--${record.kind}`}
      aria-label={`${CONTENT_KIND_LABELS[record.kind]}: ${record.title}`}
    >
      <div className="content-block__meta">
        <ContentKindBadge kind={record.kind} />
        {record.kind !== 'fiction' &&
          record.kind !== 'instruction' &&
          CONFIDENCE_LABELS[g.historicalConfidence] && (
            <span className="meta-note">
              Confidence: {CONFIDENCE_LABELS[g.historicalConfidence]}
            </span>
          )}
        {(g.denominationalSensitivity === 'moderate' || g.denominationalSensitivity === 'high') && (
          <span className="meta-note">Christians may understand this differently</span>
        )}
        {showReview && (
          <span className="meta-note meta-note--review">Awaiting editorial review</span>
        )}
      </div>
      <Heading className="content-block__title">{record.title}</Heading>

      {record.kind === 'scripture' &&
        (record.scripture ?? []).map((ref) => {
          const passage = scripture.getPassage(ref);
          return (
            <figure className="scripture" key={formatScriptureRef(ref)}>
              {passage.status === 'text' ? (
                <blockquote className="scripture__text">
                  {passage.text.split('\n').map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </blockquote>
              ) : (
                <div className="scripture__placeholder">
                  <p className="scripture__placeholder-code">{passage.text}</p>
                  <p>
                    The verse text will appear here once an approved translation is configured. For
                    now, read <strong>{formatScriptureRef(ref)}</strong> in your own Bible.
                  </p>
                </div>
              )}
              <figcaption>
                {formatScriptureRef(ref)}
                {passage.translation ? ` (${passage.translation.name})` : ''}
              </figcaption>
            </figure>
          );
        })}

      {record.kind === 'paraphrase' && (
        <p className="paraphrase-note">
          In our own words — not a quotation. Based on{' '}
          {(record.scripture ?? []).map(formatScriptureRef).join('; ')}.
        </p>
      )}

      {record.body?.split('\n\n').map((para, i) => (
        <p key={i}>{para}</p>
      ))}

      {record.kind !== 'scripture' &&
        record.kind !== 'paraphrase' &&
        (record.scripture?.length ?? 0) > 0 && (
          <p className="meta-note">
            See: {(record.scripture ?? []).map(formatScriptureRef).join('; ')}
          </p>
        )}

      {cited.length > 0 && record.kind !== 'scripture' && (
        <details className="sources">
          <summary>Sources ({cited.length})</summary>
          <ul>
            {cited.map((s) => (
              <li key={s.id}>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.title}
                    <span className="visually-hidden"> (opens in a new tab)</span>
                    <span aria-hidden="true"> ↗</span>
                  </a>
                ) : (
                  s.title
                )}
                {s.locator ? ` — ${s.locator}` : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}
