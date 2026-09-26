import type { StoredPassage, Translation } from '@/domain/scripture';

/**
 * Translation registry.
 *
 * The World English Bible (WEB) is in the public domain (eBible.org). Every
 * passage below was copied programmatically, verbatim, from the chapter pages
 * at https://ebible.org/eng-web/ (footnote markers removed): Luke 10:25–37 on
 * 2026-09-24, the rest on 2026-09-26 (the source page is noted above each).
 * The parser used on 2026-09-26 reproduced the stored Luke 10:25–37 exactly,
 * character for character, before it was used for the others.
 *
 * APPROVED FOR DISPLAY by Zac Harlan (owner and editor) on 2026-09-26, so
 * players see the text itself beside each Scripture reference (recorded in
 * docs/content-governance.md). A reference without a stored passage still
 * shows the placeholder.
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
    approvedForDisplay: true,
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
  // https://ebible.org/eng-web/LEV19.htm
  {
    translationId: 'WEB',
    reference: 'Leviticus 19:18',
    text: [
      '18 “ ‘You shall not take vengeance, nor bear any grudge against the children of your people; but you shall love your neighbor as yourself. I am Yahweh.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/LEV19.htm
  {
    translationId: 'WEB',
    reference: 'Leviticus 19:34',
    text: [
      '34 The stranger who lives as a foreigner with you shall be to you as the native-born among you, and you shall love him as yourself; for you lived as foreigners in the land of Egypt. I am Yahweh your God.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/DEU06.htm
  {
    translationId: 'WEB',
    reference: 'Deuteronomy 6:5',
    text: [
      '5 You shall love Yahweh your God with all your heart, with all your soul, and with all your might.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/JHN04.htm
  {
    translationId: 'WEB',
    reference: 'John 4:9',
    text: [
      '9 The Samaritan woman therefore said to him, “How is it that you, being a Jew, ask for a drink from me, a Samaritan woman?” (For Jews have no dealings with Samaritans.)',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/LUK09.htm
  {
    translationId: 'WEB',
    reference: 'Luke 9:52–54',
    text: [
      '52 and sent messengers before his face. They went and entered into a village of the Samaritans, so as to prepare for him.',
      '53 They didn’t receive him, because he was traveling with his face set toward Jerusalem.',
      '54 When his disciples, James and John, saw this, they said, “Lord, do you want us to command fire to come down from the sky and destroy them, just as Elijah did?”',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/MAT20.htm
  {
    translationId: 'WEB',
    reference: 'Matthew 20:2',
    text: [
      '2 When he had agreed with the laborers for a denarius a day, he sent them into his vineyard.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/JOS15.htm
  {
    translationId: 'WEB',
    reference: 'Joshua 15:7',
    text: [
      '7 The border went up to Debir from the valley of Achor, and so northward, looking toward Gilgal, that faces the ascent of Adummim, which is on the south side of the river. The border passed along to the waters of En Shemesh, and ended at En Rogel.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/JOS18.htm
  {
    translationId: 'WEB',
    reference: 'Joshua 18:17',
    text: [
      '17 It extended northward, went out at En Shemesh, and went out to Geliloth, which is opposite the ascent of Adummim. It went down to the stone of Bohan the son of Reuben.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/DEU34.htm
  {
    translationId: 'WEB',
    reference: 'Deuteronomy 34:3',
    text: [
      '3 and the south, and the Plain of the valley of Jericho the city of palm trees, to Zoar.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/ISA01.htm
  {
    translationId: 'WEB',
    reference: 'Isaiah 1:6',
    text: [
      '6 From the sole of the foot even to the head there is no soundness in it, but wounds, welts, and open sores. They haven’t been closed, bandaged, or soothed with oil.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/MRK04.htm
  {
    translationId: 'WEB',
    reference: 'Mark 4:35–41',
    text: [
      '35 On that day, when evening had come, he said to them, “Let’s go over to the other side.”',
      '36 Leaving the multitude, they took him with them, even as he was, in the boat. Other small boats were also with him.',
      '37 A big wind storm arose, and the waves beat into the boat, so much that the boat was already filled.',
      '38 He himself was in the stern, asleep on the cushion; and they woke him up and asked him, “Teacher, don’t you care that we are dying?”',
      '39 He awoke and rebuked the wind, and said to the sea, “Peace! Be still!” The wind ceased and there was a great calm.',
      '40 He said to them, “Why are you so afraid? How is it that you have no faith?”',
      '41 They were greatly afraid and said to one another, “Who then is this, that even the wind and the sea obey him?”',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/MAT08.htm
  {
    translationId: 'WEB',
    reference: 'Matthew 8:23–27',
    text: [
      '23 When he got into a boat, his disciples followed him.',
      '24 Behold, a violent storm came up on the sea, so much that the boat was covered with the waves; but he was asleep.',
      '25 The disciples came to him and woke him up, saying, “Save us, Lord! We are dying!”',
      '26 He said to them, “Why are you fearful, O you of little faith?” Then he got up, rebuked the wind and the sea, and there was a great calm.',
      '27 The men marveled, saying, “What kind of man is this, that even the wind and the sea obey him?”',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/LUK08.htm
  {
    translationId: 'WEB',
    reference: 'Luke 8:22–25',
    text: [
      '22 Now on one of those days, he entered into a boat, himself and his disciples, and he said to them, “Let’s go over to the other side of the lake.” So they launched out.',
      '23 But as they sailed, he fell asleep. A wind storm came down on the lake, and they were taking on dangerous amounts of water.',
      '24 They came to him and awoke him, saying, “Master, Master, we are dying!” He awoke and rebuked the wind and the raging of the water; then they ceased, and it was calm.',
      '25 He said to them, “Where is your faith?” Being afraid, they marveled, saying to one another, “Who is this then, that he commands even the winds and the water, and they obey him?”',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/MRK04.htm
  {
    translationId: 'WEB',
    reference: 'Mark 4:1–9',
    text: [
      '1 Again he began to teach by the seaside. A great multitude was gathered to him, so that he entered into a boat in the sea and sat down. All the multitude were on the land by the sea.',
      '2 He taught them many things in parables, and told them in his teaching,',
      '3 “Listen! Behold, the farmer went out to sow.',
      '4 As he sowed, some seed fell by the road, and the birds came and devoured it.',
      '5 Others fell on the rocky ground, where it had little soil, and immediately it sprang up, because it had no depth of soil.',
      '6 When the sun had risen, it was scorched; and because it had no root, it withered away.',
      '7 Others fell among the thorns, and the thorns grew up and choked it, and it yielded no fruit.',
      '8 Others fell into the good ground and yielded fruit, growing up and increasing. Some produced thirty times, some sixty times, and some one hundred times as much.”',
      '9 He said, “Whoever has ears to hear, let him hear.”',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/MRK05.htm
  {
    translationId: 'WEB',
    reference: 'Mark 5:1',
    text: ['1 They came to the other side of the sea, into the country of the Gadarenes.'].join(
      '\n',
    ),
  },
  // https://ebible.org/eng-web/MRK01.htm
  {
    translationId: 'WEB',
    reference: 'Mark 1:16–21',
    text: [
      '16 Passing along by the sea of Galilee, he saw Simon and Andrew, the brother of Simon, casting a net into the sea, for they were fishermen.',
      '17 Jesus said to them, “Come after me, and I will make you into fishers for men.”',
      '18 Immediately they left their nets, and followed him.',
      '19 Going on a little further from there, he saw James the son of Zebedee, and John his brother, who were also in the boat mending the nets.',
      '20 Immediately he called them, and they left their father, Zebedee, in the boat with the hired servants, and went after him.',
      '21 They went into Capernaum, and immediately on the Sabbath day he entered into the synagogue and taught.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/LUK05.htm
  {
    translationId: 'WEB',
    reference: 'Luke 5:1–11',
    text: [
      '1 Now while the multitude pressed on him and heard the word of God, he was standing by the lake of Gennesaret.',
      '2 He saw two boats standing by the lake, but the fishermen had gone out of them and were washing their nets.',
      '3 He entered into one of the boats, which was Simon’s, and asked him to put out a little from the land. He sat down and taught the multitudes from the boat.',
      '4 When he had finished speaking, he said to Simon, “Put out into the deep and let down your nets for a catch.”',
      '5 Simon answered him, “Master, we worked all night and caught nothing; but at your word I will let down the net.”',
      '6 When they had done this, they caught a great multitude of fish, and their net was breaking.',
      '7 They beckoned to their partners in the other boat, that they should come and help them. They came and filled both boats, so that they began to sink.',
      '8 But Simon Peter, when he saw it, fell down at Jesus’ knees, saying, “Depart from me, for I am a sinful man, Lord.”',
      '9 For he was amazed, and all who were with him, at the catch of fish which they had caught;',
      '10 and so also were James and John, sons of Zebedee, who were partners with Simon. Jesus said to Simon, “Don’t be afraid. From now on you will be catching people alive.”',
      '11 When they had brought their boats to land, they left everything, and followed him.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/MAT04.htm
  {
    translationId: 'WEB',
    reference: 'Matthew 4:13',
    text: [
      '13 Leaving Nazareth, he came and lived in Capernaum, which is by the sea, in the region of Zebulun and Naphtali,',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/MAT04.htm
  {
    translationId: 'WEB',
    reference: 'Matthew 4:18',
    text: [
      '18 Walking by the sea of Galilee, he saw two brothers: Simon, who is called Peter, and Andrew, his brother, casting a net into the sea; for they were fishermen.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/MRK02.htm
  {
    translationId: 'WEB',
    reference: 'Mark 2:1–4',
    text: [
      '1 When he entered again into Capernaum after some days, it was heard that he was at home.',
      '2 Immediately many were gathered together, so that there was no more room, not even around the door; and he spoke the word to them.',
      '3 Four people came, carrying a paralytic to him.',
      '4 When they could not come near to him for the crowd, they removed the roof where he was. When they had broken it up, they let down the mat that the paralytic was lying on.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/PSA107.htm
  {
    translationId: 'WEB',
    reference: 'Psalms 107:23–30',
    text: [
      '23 Those who go down to the sea in ships, who do business in great waters,',
      '24 these see Yahweh’s deeds, and his wonders in the deep.',
      '25 For he commands, and raises the stormy wind, which lifts up its waves.',
      '26 They mount up to the sky; they go down again to the depths. Their soul melts away because of trouble.',
      '27 They reel back and forth, and stagger like a drunken man, and are at their wits’ end.',
      '28 Then they cry to Yahweh in their trouble, and he brings them out of their distress.',
      '29 He makes the storm a calm, so that its waves are still.',
      '30 Then they are glad because it is calm, so he brings them to their desired haven.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/PSA089.htm
  {
    translationId: 'WEB',
    reference: 'Psalms 89:9',
    text: ['9 You rule the pride of the sea. When its waves rise up, you calm them.'].join('\n'),
  },
  // https://ebible.org/eng-web/JON01.htm
  {
    translationId: 'WEB',
    reference: 'Jonah 1:4–6',
    text: [
      '4 But Yahweh sent out a great wind on the sea, and there was a mighty storm on the sea, so that the ship was likely to break up.',
      '5 Then the mariners were afraid, and every man cried to his god. They threw the cargo that was in the ship into the sea to lighten the ship. But Jonah had gone down into the innermost parts of the ship and he was laying down, and was fast asleep.',
      '6 So the ship master came to him, and said to him, “What do you mean, sleeper? Arise, call on your God! Maybe your God will notice us, so that we won’t perish.”',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/MAT13.htm
  {
    translationId: 'WEB',
    reference: 'Matthew 13:47–48',
    text: [
      '47 “Again, the Kingdom of Heaven is like a dragnet that was cast into the sea and gathered some fish of every kind,',
      '48 which, when it was filled, fishermen drew up on the beach. They sat down and gathered the good into containers, but the bad they threw away.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/LEV11.htm
  {
    translationId: 'WEB',
    reference: 'Leviticus 11:9–12',
    text: [
      '9 “ ‘You may eat of all these that are in the waters: whatever has fins and scales in the waters, in the seas, and in the rivers, that you may eat.',
      '10 All that don’t have fins and scales in the seas and rivers, all that move in the waters, and all the living creatures that are in the waters, they are an abomination to you,',
      '11 and you shall detest them. You shall not eat of their meat, and you shall detest their carcasses.',
      '12 Whatever has no fins nor scales in the waters is an abomination to you.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/LUK02.htm
  {
    translationId: 'WEB',
    reference: 'Luke 2:1–20',
    text: [
      '1 Now in those days, a decree went out from Caesar Augustus that all the world should be enrolled.',
      '2 This was the first enrollment made when Quirinius was governor of Syria.',
      '3 All went to enroll themselves, everyone to his own city.',
      '4 Joseph also went up from Galilee, out of the city of Nazareth, into Judea, to David’s city, which is called Bethlehem, because he was of the house and family of David,',
      '5 to enroll himself with Mary, who was pledged to be married to him as wife, being pregnant.',
      '6 While they were there, the day had come for her to give birth.',
      '7 She gave birth to her firstborn son. She wrapped him in bands of cloth and laid him in a feeding trough, because there was no room for them in the inn.',
      '8 There were shepherds in the same country staying in the field, and keeping watch by night over their flock.',
      '9 Behold, an angel of the Lord stood by them, and the glory of the Lord shone around them, and they were terrified.',
      '10 The angel said to them, “Don’t be afraid, for behold, I bring you good news of great joy which will be to all the people.',
      '11 For there is born to you today, in David’s city, a Savior, who is Christ the Lord.',
      '12 This is the sign to you: you will find a baby wrapped in strips of cloth, lying in a feeding trough.”',
      '13 Suddenly, there was with the angel a multitude of the heavenly army praising God and saying,',
      '14 “Glory to God in the highest, on earth peace, good will toward men.”',
      '15 When the angels went away from them into the sky, the shepherds said to one another, “Let’s go to Bethlehem, now, and see this thing that has happened, which the Lord has made known to us.”',
      '16 They came with haste and found both Mary and Joseph, and the baby was lying in the feeding trough.',
      '17 When they saw it, they publicized widely the saying which was spoken to them about this child.',
      '18 All who heard it wondered at the things which were spoken to them by the shepherds.',
      '19 But Mary kept all these sayings, pondering them in her heart.',
      '20 The shepherds returned, glorifying and praising God for all the things that they had heard and seen, just as it was told them.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/LUK02.htm
  {
    translationId: 'WEB',
    reference: 'Luke 2:1–5',
    text: [
      '1 Now in those days, a decree went out from Caesar Augustus that all the world should be enrolled.',
      '2 This was the first enrollment made when Quirinius was governor of Syria.',
      '3 All went to enroll themselves, everyone to his own city.',
      '4 Joseph also went up from Galilee, out of the city of Nazareth, into Judea, to David’s city, which is called Bethlehem, because he was of the house and family of David,',
      '5 to enroll himself with Mary, who was pledged to be married to him as wife, being pregnant.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/LUK02.htm
  {
    translationId: 'WEB',
    reference: 'Luke 2:8–20',
    text: [
      '8 There were shepherds in the same country staying in the field, and keeping watch by night over their flock.',
      '9 Behold, an angel of the Lord stood by them, and the glory of the Lord shone around them, and they were terrified.',
      '10 The angel said to them, “Don’t be afraid, for behold, I bring you good news of great joy which will be to all the people.',
      '11 For there is born to you today, in David’s city, a Savior, who is Christ the Lord.',
      '12 This is the sign to you: you will find a baby wrapped in strips of cloth, lying in a feeding trough.”',
      '13 Suddenly, there was with the angel a multitude of the heavenly army praising God and saying,',
      '14 “Glory to God in the highest, on earth peace, good will toward men.”',
      '15 When the angels went away from them into the sky, the shepherds said to one another, “Let’s go to Bethlehem, now, and see this thing that has happened, which the Lord has made known to us.”',
      '16 They came with haste and found both Mary and Joseph, and the baby was lying in the feeding trough.',
      '17 When they saw it, they publicized widely the saying which was spoken to them about this child.',
      '18 All who heard it wondered at the things which were spoken to them by the shepherds.',
      '19 But Mary kept all these sayings, pondering them in her heart.',
      '20 The shepherds returned, glorifying and praising God for all the things that they had heard and seen, just as it was told them.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/LUK22.htm
  {
    translationId: 'WEB',
    reference: 'Luke 22:11',
    text: [
      '11 Tell the master of the house, ‘The Teacher says to you, “Where is the guest room, where I may eat the Passover with my disciples?” ’',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/MAT02.htm
  {
    translationId: 'WEB',
    reference: 'Matthew 2:1–11',
    text: [
      '1 Now when Jesus was born in Bethlehem of Judea in the days of King Herod, behold, wise men from the east came to Jerusalem, saying,',
      '2 “Where is he who is born King of the Jews? For we saw his star in the east, and have come to worship him.”',
      '3 When King Herod heard it, he was troubled, and all Jerusalem with him.',
      '4 Gathering together all the chief priests and scribes of the people, he asked them where the Christ would be born.',
      '5 They said to him, “In Bethlehem of Judea, for this is written through the prophet,',
      '6 ‘You Bethlehem, land of Judah, are in no way least among the princes of Judah; for out of you shall come a governor who shall shepherd my people, Israel.’ ”',
      '7 Then Herod secretly called the wise men, and learned from them exactly what time the star appeared.',
      '8 He sent them to Bethlehem, and said, “Go and search diligently for the young child. When you have found him, bring me word, so that I also may come and worship him.”',
      '9 They, having heard the king, went their way; and behold, the star, which they saw in the east, went before them until it came and stood over where the young child was.',
      '10 When they saw the star, they rejoiced with exceedingly great joy.',
      '11 They came into the house and saw the young child with Mary, his mother, and they fell down and worshiped him. Opening their treasures, they offered to him gifts: gold, frankincense, and myrrh.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/GEN18.htm
  {
    translationId: 'WEB',
    reference: 'Genesis 18:1–8',
    text: [
      '1 Yahweh appeared to him by the oaks of Mamre, as he sat in the tent door in the heat of the day.',
      '2 He lifted up his eyes and looked, and saw that three men stood near him. When he saw them, he ran to meet them from the tent door, and bowed himself to the earth,',
      '3 and said, “My lord, if now I have found favor in your sight, please don’t go away from your servant.',
      '4 Now let a little water be fetched, wash your feet, and rest yourselves under the tree.',
      '5 I will get a piece of bread so you can refresh your heart. After that you may go your way, now that you have come to your servant.” They said, “Very well, do as you have said.”',
      '6 Abraham hurried into the tent to Sarah, and said, “Quickly prepare three seahs of fine meal, knead it, and make cakes.”',
      '7 Abraham ran to the herd, and fetched a tender and good calf, and gave it to the servant. He hurried to dress it.',
      '8 He took butter, milk, and the calf which he had dressed, and set it before them. He stood by them under the tree, and they ate.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/1SA16.htm
  {
    translationId: 'WEB',
    reference: '1 Samuel 16:1',
    text: [
      '1 Yahweh said to Samuel, “How long will you mourn for Saul, since I have rejected him from being king over Israel? Fill your horn with oil, and go. I will send you to Jesse the Bethlehemite, for I have provided a king for myself among his sons.”',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/1SA16.htm
  {
    translationId: 'WEB',
    reference: '1 Samuel 16:11',
    text: [
      '11 Samuel said to Jesse, “Are all your children here?” He said, “There remains yet the youngest. Behold, he is keeping the sheep.” Samuel said to Jesse, “Send and get him, for we will not sit down until he comes here.”',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/1SA17.htm
  {
    translationId: 'WEB',
    reference: '1 Samuel 17:12',
    text: [
      '12 Now David was the son of that Ephrathite of Bethlehem Judah, whose name was Jesse; and he had eight sons. The man was an elderly old man in the days of Saul.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/1SA17.htm
  {
    translationId: 'WEB',
    reference: '1 Samuel 17:15',
    text: [
      '15 Now David went back and forth from Saul to feed his father’s sheep at Bethlehem.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/2SA23.htm
  {
    translationId: 'WEB',
    reference: '2 Samuel 23:15–16',
    text: [
      '15 David said longingly, “Oh that someone would give me water to drink from the well of Bethlehem, which is by the gate!”',
      '16 The three mighty men broke through the army of the Philistines, and drew water out of the well of Bethlehem that was by the gate and took it and brought it to David; but he would not drink of it, but poured it out to Yahweh.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/RUT01.htm
  {
    translationId: 'WEB',
    reference: 'Ruth 1:1',
    text: [
      '1 In the days when the judges judged, there was a famine in the land. A certain man of Bethlehem Judah went to live in the country of Moab with his wife and his two sons.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/RUT01.htm
  {
    translationId: 'WEB',
    reference: 'Ruth 1:19',
    text: [
      '19 So they both went until they came to Bethlehem. When they had come to Bethlehem, all the city was excited about them, and they asked, “Is this Naomi?”',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/RUT03.htm
  {
    translationId: 'WEB',
    reference: 'Ruth 3:2',
    text: [
      '2 Now isn’t Boaz our kinsman, with whose maidens you were? Behold, he will be winnowing barley tonight on the threshing floor.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/JER33.htm
  {
    translationId: 'WEB',
    reference: 'Jeremiah 33:13',
    text: [
      '13 In the cities of the hill country, in the cities of the lowland, in the cities of the South, in the land of Benjamin, in the places around Jerusalem, and in the cities of Judah, the flocks will again pass under the hands of him who counts them,” says Yahweh.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/JHN10.htm
  {
    translationId: 'WEB',
    reference: 'John 10:1–4',
    text: [
      '1 “Most certainly, I tell you, one who doesn’t enter by the door into the sheep fold, but climbs up some other way, is a thief and a robber.',
      '2 But one who enters in by the door is the shepherd of the sheep.',
      '3 The gatekeeper opens the gate for him, and the sheep listen to his voice. He calls his own sheep by name and leads them out.',
      '4 Whenever he brings out his own sheep, he goes before them; and the sheep follow him, for they know his voice.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/EZK16.htm
  {
    translationId: 'WEB',
    reference: 'Ezekiel 16:4',
    text: [
      '4 As for your birth, in the day you were born your navel was not cut. You weren’t washed in water to cleanse you. You weren’t salted at all, nor wrapped in blankets at all.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/MIC05.htm
  {
    translationId: 'WEB',
    reference: 'Micah 5:2',
    text: [
      '2 But you, Bethlehem Ephrathah, being small among the clans of Judah, out of you one will come out to me who is to be ruler in Israel; whose goings out are from of old, from ancient times.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/ACT05.htm
  {
    translationId: 'WEB',
    reference: 'Acts 5:37',
    text: [
      '37 After this man, Judas of Galilee rose up in the days of the enrollment, and drew away some people after him. He also perished, and all, as many as obeyed him, were scattered abroad.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/PHM01.htm
  {
    translationId: 'WEB',
    reference: 'Philemon 1:1–25',
    text: [
      '1 Paul, a prisoner of Christ Jesus, and Timothy our brother, to Philemon, our beloved fellow worker,',
      '2 to the beloved Apphia, to Archippus our fellow soldier, and to the assembly in your house:',
      '3 Grace to you and peace from God our Father and the Lord Jesus Christ.',
      '4 I thank my God always, making mention of you in my prayers,',
      '5 hearing of your love and of the faith which you have toward the Lord Jesus and toward all the saints,',
      '6 that the fellowship of your faith may become effective in the knowledge of every good thing which is in us in Christ Jesus.',
      '7 For we have much joy and comfort in your love, because the hearts of the saints have been refreshed through you, brother.',
      '8 Therefore though I have all boldness in Christ to command you that which is appropriate,',
      '9 yet for love’s sake I rather appeal to you, being such a one as Paul, the aged, but also a prisoner of Jesus Christ.',
      '10 I appeal to you for my child Onesimus, whom I have become the father of in my chains,',
      '11 who once was useless to you, but now is useful to you and to me.',
      '12 I am sending him back. Therefore receive him, that is, my own heart,',
      '13 whom I desired to keep with me, that on your behalf he might serve me in my chains for the Good News.',
      '14 But I was willing to do nothing without your consent, that your goodness would not be as of necessity, but of free will.',
      '15 For perhaps he was therefore separated from you for a while that you would have him forever,',
      '16 no longer as a slave, but more than a slave, a beloved brother—especially to me, but how much rather to you, both in the flesh and in the Lord.',
      '17 If then you count me a partner, receive him as you would receive me.',
      '18 But if he has wronged you at all or owes you anything, put that to my account.',
      '19 I, Paul, write this with my own hand: I will repay it (not to mention to you that you owe to me even your own self besides).',
      '20 Yes, brother, let me have joy from you in the Lord. Refresh my heart in the Lord.',
      '21 Having confidence in your obedience, I write to you, knowing that you will do even beyond what I say.',
      '22 Also, prepare a guest room for me, for I hope that through your prayers I will be restored to you.',
      '23 Epaphras, my fellow prisoner in Christ Jesus, greets you,',
      '24 as do Mark, Aristarchus, Demas, and Luke, my fellow workers.',
      '25 The grace of our Lord Jesus Christ be with your spirit. Amen.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/COL04.htm
  {
    translationId: 'WEB',
    reference: 'Colossians 4:7–9',
    text: [
      '7 All my affairs will be made known to you by Tychicus, the beloved brother, faithful servant, and fellow bondservant in the Lord.',
      '8 I am sending him to you for this very purpose, that he may know your circumstances and comfort your hearts,',
      '9 together with Onesimus, the faithful and beloved brother, who is one of you. They will make known to you everything that is going on here.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/COL04.htm
  {
    translationId: 'WEB',
    reference: 'Colossians 4:15–16',
    text: [
      '15 Greet the brothers who are in Laodicea, with Nymphas and the assembly that is in his house.',
      '16 When this letter has been read among you, cause it to be read also in the assembly of the Laodiceans, and that you also read the letter from Laodicea.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/COL04.htm
  {
    translationId: 'WEB',
    reference: 'Colossians 4:18',
    text: [
      '18 I, Paul, write this greeting with my own hand. Remember my chains. Grace be with you. Amen.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/COL01.htm
  {
    translationId: 'WEB',
    reference: 'Colossians 1:7',
    text: [
      '7 even as you learned from Epaphras our beloved fellow servant, who is a faithful servant of Christ on your behalf,',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/COL04.htm
  {
    translationId: 'WEB',
    reference: 'Colossians 4:12–13',
    text: [
      '12 Epaphras, who is one of you, a servant of Christ, salutes you, always striving for you in his prayers, that you may stand perfect and complete in all the will of God.',
      '13 For I testify about him that he has great zeal for you, and for those in Laodicea, and for those in Hierapolis.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/COL02.htm
  {
    translationId: 'WEB',
    reference: 'Colossians 2:1',
    text: [
      '1 For I desire to have you know how greatly I struggle for you and for those at Laodicea, and for as many as have not seen my face in the flesh;',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/ROM16.htm
  {
    translationId: 'WEB',
    reference: 'Romans 16:22',
    text: ['22 I, Tertius, who write the letter, greet you in the Lord.'].join('\n'),
  },
  // https://ebible.org/eng-web/GAL06.htm
  {
    translationId: 'WEB',
    reference: 'Galatians 6:11',
    text: ['11 See with what large letters I write to you with my own hand.'].join('\n'),
  },
  // https://ebible.org/eng-web/1CO16.htm
  {
    translationId: 'WEB',
    reference: '1 Corinthians 16:21',
    text: ['21 This greeting is by me, Paul, with my own hand.'].join('\n'),
  },
  // https://ebible.org/eng-web/2TH03.htm
  {
    translationId: 'WEB',
    reference: '2 Thessalonians 3:17',
    text: [
      '17 I, Paul, write this greeting with my own hand, which is the sign in every letter. This is how I write.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/1TH05.htm
  {
    translationId: 'WEB',
    reference: '1 Thessalonians 5:27',
    text: [
      '27 I solemnly command you by the Lord that this letter be read to all the holy brothers.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/COL03.htm
  {
    translationId: 'WEB',
    reference: 'Colossians 3:11',
    text: [
      '11 where there can’t be Greek and Jew, circumcision and uncircumcision, barbarian, Scythian, bondservant, or free person; but Christ is all, and in all.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/COL03.htm
  {
    translationId: 'WEB',
    reference: 'Colossians 3:22–25',
    text: [
      '22 Servants, obey in all things those who are your masters according to the flesh, not just when they are looking, as men pleasers, but in singleness of heart, fearing God.',
      '23 And whatever you do, work heartily, as for the Lord and not for men,',
      '24 knowing that from the Lord you will receive the reward of the inheritance; for you serve the Lord Christ.',
      '25 But he who does wrong will receive again for the wrong that he has done, and there is no partiality.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/COL04.htm
  {
    translationId: 'WEB',
    reference: 'Colossians 4:1',
    text: [
      '1 Masters, give to your servants that which is just and equal, knowing that you also have a Master in heaven.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/GAL03.htm
  {
    translationId: 'WEB',
    reference: 'Galatians 3:28',
    text: [
      '28 There is neither Jew nor Greek, there is neither slave nor free man, there is neither male nor female; for you are all one in Christ Jesus.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/1CO07.htm
  {
    translationId: 'WEB',
    reference: '1 Corinthians 7:20–23',
    text: [
      '20 Let each man stay in that calling in which he was called.',
      '21 Were you called being a bondservant? Don’t let that bother you, but if you get an opportunity to become free, use it.',
      '22 For he who was called in the Lord being a bondservant is the Lord’s free man. Likewise he who was called being free is Christ’s bondservant.',
      '23 You were bought with a price. Don’t become bondservants of men.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/EPH06.htm
  {
    translationId: 'WEB',
    reference: 'Ephesians 6:21–22',
    text: [
      '21 But that you also may know my affairs, how I am doing, Tychicus, the beloved brother and faithful servant in the Lord, will make known to you all things.',
      '22 I have sent him to you for this very purpose, that you may know our state and that he may comfort your hearts.',
    ].join('\n'),
  },
  // https://ebible.org/eng-web/REV01.htm
  {
    translationId: 'WEB',
    reference: 'Revelation 1:3',
    text: [
      '3 Blessed is he who reads and those who hear the words of the prophecy, and keep the things that are written in it, for the time is near.',
    ].join('\n'),
  },
];
