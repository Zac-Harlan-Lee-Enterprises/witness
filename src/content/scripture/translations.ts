import type { StoredPassage, Translation } from '@/domain/scripture';

/**
 * Translation registry.
 *
 * The World English Bible (WEB) is in the public domain (eBible.org). The
 * Luke 10:25–37 text below was copied programmatically, verbatim, from
 * https://ebible.org/eng-web/LUK10.htm on 2026-09-24.
 *
 * It is DISABLED by default (`approvedForDisplay: false`): the project's
 * content-governance rule is that no Scripture text is displayed until a
 * human editor has proofread the stored text against the source. To enable
 * it, a reviewer proofreads the verses below, sets `approvedForDisplay: true`,
 * and records their name in docs/content-governance.md. Until then players
 * see the placeholder
 *   [SCRIPTURE TEXT REQUIRES APPROVED TRANSLATION — Luke 10:25-37]
 * plus a clearly labelled paraphrase.
 *
 * "World English Bible" is a trademark: never alter this text while keeping
 * that name.
 */
export const TRANSLATIONS: Translation[] = [
  {
    id: 'WEB',
    name: 'World English Bible',
    license: 'public-domain',
    licenseNote:
      'Public domain (eBible.org). “World English Bible” is a trademark; altered text must not use the name.',
    approvedForDisplay: false,
  },
];

export const STORED_PASSAGES: StoredPassage[] = [
  {
    translationId: 'WEB',
    reference: 'Luke 10:25–37',
    text: [
      '25 Behold, a certain lawyer stood up and tested him, saying, “Teacher, what shall I do to inherit eternal life?”',
      '26 He said to him, “What is written in the law? How do you read it?”',
      '27 He answered, “You shall love the Lord your God with all your heart, with all your soul, with all your strength, and with all your mind; and your neighbor as yourself.”',
      '28 He said to him, “You have answered correctly. Do this, and you will live.”',
      '29 But he, desiring to justify himself, asked Jesus, “Who is my neighbor?”',
      '30 Jesus answered, “A certain man was going down from Jerusalem to Jericho, and he fell among robbers, who both stripped him and beat him, and departed, leaving him half dead.',
      '31 By chance a certain priest was going down that way. When he saw him, he passed by on the other side.',
      '32 In the same way a Levite also, when he came to the place and saw him, passed by on the other side.',
      '33 But a certain Samaritan, as he traveled, came where he was. When he saw him, he was moved with compassion,',
      '34 came to him, and bound up his wounds, pouring on oil and wine. He set him on his own animal, brought him to an inn, and took care of him.',
      '35 On the next day, when he departed, he took out two denarii, gave them to the host, and said to him, ‘Take care of him. Whatever you spend beyond that, I will repay you when I return.’',
      '36 Now which of these three do you think seemed to be a neighbor to him who fell among the robbers?”',
      '37 He said, “He who showed mercy on him.” Then Jesus said to him, “Go and do likewise.”',
    ].join('\n'),
  },
];
