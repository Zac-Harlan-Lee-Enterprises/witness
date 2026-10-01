import type { KeyArt } from '@/domain/chapter';

/**
 * The title screen's hero image (rendered by tools/art/build_key_art.py,
 * shot `title`; each chapter's own key art is in its registry entry,
 * src/content/index.ts).
 */
export const TITLE_ART: KeyArt = {
  src: 'art/key-art/title.webp',
  srcSmall: 'art/key-art/title-960.webp',
  width: 1920,
  height: 960,
  alt: 'Dawn over Jerusalem: the sun rising over the city’s flat roofs and walls, and the road east leading down into the wilderness.',
};
