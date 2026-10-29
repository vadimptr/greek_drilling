import { CITY_NAMES, type Lang } from '../../src/logic/city/name.ts'

export type Level = 'A1' | 'A2' | 'B1'
export type Mood = 'friendly' | 'annoyed' | 'offended' | 'angry'
export type TimeOfDay = 'morning' | 'noon' | 'evening' | 'night'
export type Ambience = 'harbour' | 'fish_market' | 'kafeneio' | 'square' | 'bakery' | 'shop' | 'beach' | 'hill' | 'lane' | 'kiosk'

export const AMBIENCE_IDS: Ambience[] = ['harbour', 'fish_market', 'kafeneio', 'square', 'bakery', 'shop', 'beach', 'hill', 'lane', 'kiosk']

export const LANGUAGE_EN: Record<Lang, string> = { el: 'Greek', en: 'English', ru: 'Russian' }

export interface Setting {
  city: string
  cityIn: Record<Lang, string>
  townWords: string
  lore: string
  arrival: string
  examples: string[]
  names: string
  time: Record<TimeOfDay, string>
  levels: Record<Level, string>
  levelRules: string
  address: string
  regreeting: Record<Mood, string[]>
  resume: { voice: string; tap: string }
  goodbye: string
  together: string
  unclear: string
  apology: string
  local: string
  ambienceHint: string
  ambience: Record<Ambience, string>
  image: string
  nationality: string
}

const el: Setting = {
  city: CITY_NAMES.el,
  cityIn: { el: 'Μυθόπολη', en: 'Mythopoli', ru: 'Мифополи' },
  townWords: 'In Russian texts the town is «городок» or «Мифополи», never «деревня»; in English texts it is a "town", never a "village".',
  lore: `${CITY_NAMES.el} is a small fictional harbour town (κωμόπολη, about 3000 people) on the Aegean coast of Greece. It does not exist on any map.
It is a town, not a village: locals call it «η πόλη μας» or simply «η Μυθόπολη», never «χωριό». It has neighbourhoods: Λιμάνι (the harbour), Πλατεία (the centre), Πάνω Γειτονιά (the upper town on the hill).
The ferry from Piraeus arrives at the harbour (λιμάνι) twice a day. Places: the harbour with fishing boats (καΐκια) and the fish market (ψαραγορά);
the square with an old plane tree (η πλατεία με τον πλάτανο) and the καφενείο «Η Ωραία Ελένη» where old men play τάβλι;
the bakery (φούρνος) of the Papadopoulos family; the grocery (μπακάλικο) «Ο Μανώλης»; the taverna «Ο Γλάρος» on the beach;
the pharmacy; the kiosk (περίπτερο); the small church of Άγιος Νικόλαος on the hill; narrow white lanes with blue doors and bougainvillea.
Everybody knows everybody, people are curious about tourists, talkative and helpful, but each has their own business and mood.`,
  arrival: 'has just arrived by ferry',
  examples: [
    'buy a set of groceries from the shopkeeper and ask how to cook a Greek dish with them',
    'go to the harbour and find out from a fisherman what he caught today, what he sells and for how much',
    'find out from Mrs Papadopoulou where her granddaughter Maria lives and what she does',
  ],
  names: 'Greek names',
  time: {
    morning: 'morning: shops and the bakery are opening, fishermen are back from the sea, people greet with «Καλημέρα»',
    noon: 'midday and early afternoon: hot sun, some shops close for the siesta, people greet with «Γεια σου» or «Καλησπέρα» after noon',
    evening: 'evening: sunset, people walk on the waterfront, tavernas and the café are full, people greet with «Καλησπέρα»',
    night: 'night: most shops are closed, the taverna, the café and the kiosk may still be open, people greet with «Καλησπέρα» and say «Καληνύχτα» when leaving',
  },
  levels: {
    A1: `CEFR A1, strictly:
  - Each reply is ONE short sentence of at most 8 words; at most two such sentences only when really needed.
  - Grammar: present tense, imperative and «θέλω να» + verb only. No past tenses, no future with «θα», no perfect («έχω κάνει»), no passive, no subordinate clauses.
  - Vocabulary: only the most frequent everyday words (greetings, numbers, prices, time, food, family, places in town, weather). No idioms, no slang, no rare words.`,
    A2: `CEFR A2, strictly:
  - Each reply is 1-2 short sentences of at most 12 words each.
  - Grammar: present, simple past (aorist), future with «θα», imperative, simple «να» and «γιατί» clauses. No perfect tenses, no passive, no long subordinate clauses.
  - Vocabulary: common everyday words; if you need a rarer word, explain it with simple words.`,
    B1: `CEFR B1:
  - Each reply is up to 2-3 sentences.
  - Natural everyday speech; simple subordinate clauses and all common tenses are fine.
  - Avoid rare words, idioms and dialect; rephrase if the tourist does not understand.`,
  },
  levelRules: `- A1: one short sentence (≤ 8 words) per reply, present tense / imperative / «θέλω να» only, the most frequent everyday words.
- A2: 1-2 short sentences (≤ 12 words each), present, aorist, future with «θα», imperative, simple «να» clauses; no perfect, no passive.
- B1: up to 2-3 sentences, everyday speech, no rare words or idioms.
Always informal «εσύ»; formal «εσείς» breaks the rules.`,
  address: 'Always address the tourist informally with «εσύ» (σου, σε), never «εσείς» or «σας».',
  regreeting: {
    friendly: ['Α, πάλι εσύ! Τι νέα;', 'Γεια σου ξανά! Βρήκες αυτό που έψαχνες;', 'Καλώς τον ξανά! Πες μου.'],
    annoyed: ['Πάλι εσύ; Τι θέλεις;', 'Ναι; Τι θέλεις πάλι;'],
    offended: ['Εσύ πάλι… Τι θέλεις;', 'Δεν έχω πολύ χρόνο. Τι θέλεις;'],
    angry: ['Εσύ; Δεν θέλω να σου μιλήσω.', 'Φύγε, σε παρακαλώ. Δεν έχω όρεξη.'],
  },
  resume: { voice: 'Συγγνώμη, δεν σε άκουσα. Τι είπες;', tap: 'Ναι;' },
  goodbye: '«Άντε, καλή τύχη!», «Τα λέμε!»',
  together: '«πάμε μαζί», «έλα μαζί μου», «θα σε πάω»',
  unclear: '«Συγγνώμη;», «Τι εννοείς;»',
  apology: '«συγγνώμη»',
  local: 'a real person from a small Greek town',
  ambienceHint:
    'harbour, fish_market, kafeneio (traditional café), square, bakery, shop (grocery), beach (taverna by the sea), hill (church, upper town), lane or kiosk',
  ambience: {
    harbour: 'Calm Greek harbour: gentle waves lapping against a stone pier, distant seagulls, wooden fishing boats creaking softly on their ropes',
    fish_market: 'Small open-air fish market by the sea: muffled voices of a few vendors, ice being scooped, seagulls overhead, gentle waves nearby',
    kafeneio: 'Traditional Greek village café: clicking backgammon dice and pieces, spoons in small coffee cups, soft murmur of old men talking, a chair scraping',
    square: 'Sunny small Greek town square: cicadas in a plane tree, a small fountain trickling, distant footsteps and a scooter passing far away',
    bakery: 'Small bakery shop: oven door, trays sliding, paper bags rustling, a shop bell ringing once, quiet street outside',
    shop: 'Small grocery shop: rustling bags, a cash drawer, a fridge humming, a door bell, quiet street outside',
    beach: 'Beach taverna by the sea: soft waves on pebbles, plates and glasses clinking quietly, warm breeze, distant laughter',
    hill: 'Hilltop above the sea near a small chapel: warm wind in dry grass, cicadas, goat bells far away, a distant church bell',
    lane: 'Narrow whitewashed lane in a Greek island town: footsteps on stone, a cat, birds, distant radio, a door closing',
    kiosk: 'Street kiosk on a Greek town square: rustling newspapers, a fridge humming, passing footsteps, distant traffic and cicadas',
  },
  image:
    'a small fictional harbour town on the Aegean coast of Greece — whitewashed houses with blue doors and shutters, bougainvillea, stone lanes, fishing boats (kaikia), the sea always nearby',
  nationality: 'Greek',
}

const en: Setting = {
  city: CITY_NAMES.en,
  cityIn: { en: 'Mythmouth', ru: 'Митмут', el: 'Μίθμαουθ' },
  townWords: 'In Russian texts the town is «городок» or «Митмут», never «деревня»; in English texts it is a "town", never a "village".',
  lore: `${CITY_NAMES.en} is a small fictional harbour town (about 4000 people) on the north coast of Cornwall, in the south-west of England. It does not exist on any map.
It is a town, not a village: locals call it "the town" or "Mythmouth" and are proud of it. Steep narrow streets run down from the hill to the harbour; houses are grey granite and whitewashed cottages with slate roofs.
Visitors come by the little branch-line train that stops at the station above the town, or by the coach from Truro. Places: the harbour with fishing boats, lobster pots and the old lifeboat station; the fish market on the quay;
the pub «The Anchor» by the harbour, where old fishermen sit by the fire; the market square with the clock tower and a Thursday market;
the bakery «Trelawny's», famous for its Cornish pasties and saffron buns; the corner shop and post office; the beach café «The Gull» on the sandy cove;
the chemist; the newsagent; the church of St Piran and the coastguard lookout on the headland; cobbled lanes with fishermen's cottages and gardens full of hydrangeas.
Everybody knows everybody, people are friendly and chatty with visitors, love talking about the weather and the sea, but each has their own business and mood.`,
  arrival: 'has just arrived by the little train',
  examples: [
    'buy what you need for a picnic at the corner shop and ask where the best place on the cliffs is',
    'find out from a fisherman at the harbour what he caught this morning and how much the crab costs',
    'find out from Mrs Penrose where her grandson Tom works and what time he finishes',
  ],
  names: 'English and Cornish names (Tom, Sarah, Jack, Morwenna, Penrose, Trelawny…)',
  time: {
    morning: 'morning: the bakery smells of fresh pasties, shops are opening, fishermen are back with the catch, people greet with "Morning!" or "Good morning"',
    noon: 'midday and early afternoon: the pub serves lunch, the beach café is busy, people greet with "Hello", "Afternoon!"',
    evening: 'evening: sunset over the sea, people walk the dog on the beach, the pub is full, people greet with "Evening!"',
    night: 'night: most shops are closed, the pub and the chip shop may still be open, people greet with "Evening!" and say "Night!" when leaving',
  },
  levels: {
    A1: `CEFR A1, strictly:
  - Each reply is ONE short sentence of at most 8 words; at most two such sentences only when really needed.
  - Grammar: present simple, present continuous, imperative, "can" and "want to" + verb only. No past tenses, no "will" or "going to", no perfect tenses, no passive, no conditionals, no subordinate clauses.
  - Vocabulary: only the most frequent everyday words (greetings, numbers, prices, time, food, family, places in town, weather). No idioms, no phrasal verbs with idiomatic meaning, no slang.`,
    A2: `CEFR A2, strictly:
  - Each reply is 1-2 short sentences of at most 12 words each.
  - Grammar: present, past simple, "going to" and "will", "can/could", imperative, simple "because", "when" and "if" clauses. No perfect continuous, no passive, no long subordinate clauses.
  - Vocabulary: common everyday words; if you need a rarer word, explain it with simple words. No idioms or slang.`,
    B1: `CEFR B1:
  - Each reply is up to 2-3 sentences.
  - Natural everyday speech; simple subordinate clauses and all common tenses are fine.
  - Avoid rare words, idioms and strong regional dialect; rephrase if the tourist does not understand.`,
  },
  levelRules: `- A1: one short sentence (≤ 8 words) per reply, present simple / continuous, imperative, "can", "want to" only, the most frequent everyday words.
- A2: 1-2 short sentences (≤ 12 words each), present, past simple, "going to" / "will", "can/could", simple "because/when/if" clauses; no perfect continuous, no passive.
- B1: up to 2-3 sentences, everyday speech, no rare words, idioms or heavy dialect.`,
  address: 'Speak to the tourist in a warm, casual, friendly way; you may call them "love" or "mate" now and then, like locals do.',
  regreeting: {
    friendly: ['Oh, hello again! How is it going?', 'Hi again! Did you find it?', 'You are back! Tell me.'],
    annoyed: ['You again? What do you want?', 'Yes? What is it now?'],
    offended: ['Oh. It is you. What do you want?', 'I am busy. What is it?'],
    angry: ['You? I do not want to talk to you.', 'Please go away. I am not in the mood.'],
  },
  resume: { voice: 'Sorry, I did not hear you. What did you say?', tap: 'Yes?' },
  goodbye: '"Good luck!", "See you!", "Bye now!"',
  together: '"let\'s go together", "come with me", "I\'ll take you there"',
  unclear: '"Sorry?", "What do you mean?"',
  apology: '"sorry"',
  local: 'a real person from a small Cornish seaside town',
  ambienceHint:
    'harbour, fish_market (on the quay), kafeneio (the pub), square (market square), bakery, shop (corner shop), beach (beach café), hill (church, headland), lane or kiosk (newsagent)',
  ambience: {
    harbour: 'Small Cornish harbour: waves slapping the granite quay, gulls crying, ropes and masts clinking, a small boat engine far away',
    fish_market: 'Fish market on a Cornish quay: a few voices, crates being dragged, ice shovelled, gulls overhead, the sea nearby',
    kafeneio: 'Cosy old English pub: low murmur of voices, glasses clinking, a log fire crackling, a dartboard thud now and then',
    square: 'Small English market town square: a few footsteps, distant voices, pigeons, a clock tower striking once far away, light wind',
    bakery: 'Small English bakery: oven door, trays sliding, paper bags rustling, a shop bell ringing once, quiet street outside',
    shop: 'Small English corner shop: a fridge humming, a till beeping, rustling bags, a door bell, quiet street outside',
    beach: 'Beach café on a Cornish sandy cove: waves breaking on sand, cups and saucers, a coffee machine, children far away, wind',
    hill: 'Windy Cornish headland near an old church: strong sea wind in the grass, waves far below, gulls, a distant church bell',
    lane: 'Narrow cobbled lane in a Cornish fishing town: footsteps on stone, gulls, a door closing, a distant radio, wind',
    kiosk: 'Small English newsagent: newspapers rustling, a bell over the door, a fridge humming, footsteps outside, gulls',
  },
  image:
    'a small fictional harbour town on the north coast of Cornwall, England — grey granite and whitewashed cottages with slate roofs, steep cobbled lanes, a stone harbour with fishing boats and lobster pots, green cliffs and the Atlantic sea nearby',
  nationality: 'English',
}

const ru: Setting = {
  city: CITY_NAMES.ru,
  cityIn: { ru: 'Мифоград', en: 'Mifograd', el: 'Μιφογκράντ' },
  townWords: 'In Russian texts the town is «город», «городок» or «Мифоград», never «деревня» or «село»; in English texts it is a "town", never a "village".',
  lore: `${CITY_NAMES.ru} is a small fictional old town (about 15 000 people) on the high bank of the Volga river, in the heart of Russia. It does not exist on any map.
It is a town, not a village: locals say «наш город» or «у нас в Мифограде». The town is more than 600 years old: there is the old кремль hill with white walls, the Успенский собор and a view over the river.
Tourists arrive by the river boat (теплоход) at the пристань or by the bus from the regional centre. Places: the river пристань with boats and fishermen; the market (рынок) with fish, berries, mushrooms and honey;
the old Торговая площадь with merchant houses and the clock; the столовая-кафе «Самовар» where they serve tea, блины and пироги; the bakery «Калач»;
the grocery shop «Продукты» on Советская улица; the набережная with benches and a little beach; the кремль hill with the cathedral and the bell tower;
quiet streets of wooden houses with carved window frames (наличники), gardens and dogs behind fences; the kiosk with newspapers and ice cream.
Everybody knows everybody, people are hospitable and curious about visitors, a bit reserved at first and warm after a few words, each with their own business and mood.`,
  arrival: 'has just arrived by the river boat',
  examples: [
    'buy what you need for блины at the market and ask a seller how to make them',
    'find out from a fisherman at the пристань what he caught today and how much the fish costs',
    'find out from Анна Петровна where her grandson Миша works and when he is free',
  ],
  names: 'Russian names (first names, and for older people name + patronymic, e.g. Анна Петровна, Николай Иванович)',
  time: {
    morning: 'morning: the market and the bakery are opening, fishermen are on the пристань, people greet with «Доброе утро!»',
    noon: 'daytime: the market is busy, the столовая serves lunch, people greet with «Добрый день!» or «Здравствуйте!»',
    evening: 'evening: sunset over the Volga, people walk on the набережная, the café is full, people greet with «Добрый вечер!»',
    night: 'night: most shops are closed, only the kiosk and a 24-hour shop are open, people greet with «Добрый вечер!» and say «Спокойной ночи!» when leaving',
  },
  levels: {
    A1: `CEFR A1 (ТРКИ элементарный), strictly:
  - Each reply is ONE short sentence of at most 8 words; at most two such sentences only when really needed.
  - Grammar: present tense, imperative, «хочу», «можно», «надо» + infinitive only. No past or future tenses, no participles (причастия), no gerunds (деепричастия), no subordinate clauses.
  - Vocabulary: only the most frequent everyday words (greetings, numbers, prices, time, food, family, places in town, weather). No idioms, no slang, no diminutive chains.`,
    A2: `CEFR A2 (ТРКИ базовый), strictly:
  - Each reply is 1-2 short sentences of at most 12 words each.
  - Grammar: present, past and future tenses, imperative, simple «что», «потому что», «когда», «если» clauses. No participles, no gerunds, no passive, no long subordinate clauses.
  - Vocabulary: common everyday words; if you need a rarer word, explain it with simple words. No idioms or slang.`,
    B1: `CEFR B1 (ТРКИ-1):
  - Each reply is up to 2-3 sentences.
  - Natural everyday speech; simple subordinate clauses and all common tenses are fine.
  - Avoid rare words, idioms, slang and dialect; rephrase if the tourist does not understand.`,
  },
  levelRules: `- A1: one short sentence (≤ 8 words) per reply, present tense / imperative / «хочу», «можно», «надо» + infinitive only, the most frequent everyday words.
- A2: 1-2 short sentences (≤ 12 words each), present, past and future, imperative, simple «что/потому что/когда/если» clauses; no participles, no gerunds, no passive.
- B1: up to 2-3 sentences, everyday speech, no rare words, idioms or slang.
Always informal «ты»; formal «вы» to the tourist breaks the rules.`,
  address: 'Always address the tourist informally with «ты» (тебя, тебе), never «вы».',
  regreeting: {
    friendly: ['О, снова ты! Как дела?', 'Привет ещё раз! Ну что, получилось?', 'А, это ты! Рассказывай.'],
    annoyed: ['Опять ты? Что тебе?', 'Да? Что ещё?'],
    offended: ['А, это ты… Что тебе нужно?', 'У меня мало времени. Что тебе?'],
    angry: ['Ты? Не хочу с тобой говорить.', 'Уходи, пожалуйста. Нет настроения.'],
  },
  resume: { voice: 'Извини, плохо слышно. Повтори, пожалуйста?', tap: 'Да?' },
  goodbye: '«Ну, удачи!», «Пока!», «Счастливо!»',
  together: '«пойдём вместе», «пошли со мной», «я тебя отведу»',
  unclear: '«Что-что?», «Это как?»',
  apology: '«извини» or «прости»',
  local: 'a real person from a small old Russian town on the Volga',
  ambienceHint:
    'harbour (river пристань), fish_market (the market), kafeneio (the café/столовая), square, bakery, shop (grocery), beach (набережная by the river), hill (кремль, cathedral), lane (street of wooden houses) or kiosk',
  ambience: {
    harbour: 'River pier on the wide Volga: water lapping against a wooden pier, a river boat horn far away, gulls, ropes creaking',
    fish_market: 'Small open-air town market in Russia: a few vendors talking quietly, scales clinking, paper bags, footsteps, birds',
    kafeneio: 'Small old-fashioned Russian café: cups and saucers clinking, a samovar bubbling softly, quiet murmur of voices, a chair scraping',
    square: 'Old town square in a small Russian town: footsteps, pigeons, distant voices, a bus passing far away, church bells far off',
    bakery: 'Small Russian bakery: oven door, trays sliding, paper bags rustling, a door bell ringing once, quiet street outside',
    shop: 'Small Russian grocery shop: a fridge humming, a cash register, rustling plastic bags, a door creaking, quiet street outside',
    beach: 'Embankment by the wide Volga river: gentle river waves, wind, gulls, a few people talking far away, a boat passing',
    hill: 'Old kremlin hill above the Volga: wind in the trees, crows, a big church bell ringing slowly in the distance',
    lane: 'Quiet street of old wooden houses in a Russian town: a dog barking behind a fence, birds, a gate creaking, footsteps on gravel',
    kiosk: 'Street kiosk in a small Russian town: a fridge humming, coins on the counter, passing footsteps, distant traffic and birds',
  },
  image:
    'a small fictional old town on the high bank of the Volga river in central Russia — white kremlin walls and a cathedral with golden domes on the hill, old merchant houses, wooden houses with carved painted window frames, birch trees, the wide river nearby',
  nationality: 'Russian',
}

export const SETTINGS: Record<Lang, Setting> = { el, en, ru }

export const settingOf = (lang: Lang | undefined): Setting => SETTINGS[lang ?? 'el']
