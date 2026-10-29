import { createContext, useContext } from 'react'
import type { Lang } from './city/name'

type Dict = Record<string, Record<Lang, string>>

const UI = {
  'tab.words': { ru: 'Слова', en: 'Words', el: 'Λέξεις' },
  'tab.grammar': { ru: 'Грамматика', en: 'Grammar', el: 'Γραμματική' },
  'tab.speak': { ru: 'Речь', en: 'Speaking', el: 'Ομιλία' },
  'tab.spell': { ru: 'Письмо', en: 'Spelling', el: 'Γραφή' },
  'tab.mock': { ru: 'Тест', en: 'Test', el: 'Τεστ' },
  'tab.aria': { ru: 'Разделы', en: 'Sections', el: 'Ενότητες' },

  'header.signIn': { ru: 'Войти', en: 'Sign in', el: 'Σύνδεση' },
  'header.account': { ru: 'Аккаунт', en: 'Account', el: 'Λογαριασμός' },
  'header.settings': { ru: 'Настройки', en: 'Settings', el: 'Ρυθμίσεις' },
  'header.cityPoints': { ru: 'Очки за факты', en: 'Points for facts', el: 'Πόντοι για γεγονότα' },
  'header.level': { ru: 'Уровень', en: 'Level', el: 'Επίπεδο' },
  'header.citySubtitle': {
    ru: '{city} · жители говорят на уровне {level}',
    en: '{city} · residents speak at level {level}',
    el: '{city} · οι κάτοικοι μιλούν σε επίπεδο {level}',
  },

  'settings.title': { ru: 'Настройки', en: 'Settings', el: 'Ρυθμίσεις' },
  'settings.learn': { ru: 'Изучаемый язык', en: 'Language I learn', el: 'Γλώσσα που μαθαίνω' },
  'settings.hint': { ru: 'Язык перевода и подсказок', en: 'Language of translations and hints', el: 'Γλώσσα μετάφρασης και βοήθειας' },
  'settings.level': { ru: 'Уровень {level}', en: 'Level {level}', el: 'Επίπεδο {level}' },
  'settings.speed': {
    ru: '{city}: скорость речи жителей — {speed}×',
    en: '{city}: how fast residents speak — {speed}×',
    el: '{city}: ταχύτητα ομιλίας των κατοίκων — {speed}×',
  },
  'settings.speedAria': { ru: 'Скорость речи жителей', en: 'Residents’ speech speed', el: 'Ταχύτητα ομιλίας' },
  'settings.ambience': { ru: '{city}: фоновые звуки — {value}', en: '{city}: background sounds — {value}', el: '{city}: ήχοι περιβάλλοντος — {value}' },
  'settings.ambienceAria': { ru: 'Громкость фоновых звуков', en: 'Background sound volume', el: 'Ένταση ήχων περιβάλλοντος' },
  'settings.off': { ru: 'выключены', en: 'off', el: 'κλειστοί' },
  'settings.offShort': { ru: 'выкл', en: 'off', el: 'off' },
  'settings.reset': { ru: 'Сбросить прогресс', en: 'Reset progress', el: 'Επαναφορά προόδου' },
  'settings.resetConfirm': { ru: 'Сбросить весь прогресс?', en: 'Reset all progress?', el: 'Επαναφορά όλης της προόδου;' },
  'common.close': { ru: 'Закрыть', en: 'Close', el: 'Κλείσιμο' },

  'account.title': { ru: 'Аккаунт', en: 'Account', el: 'Λογαριασμός' },
  'account.saved': {
    ru: 'Прогресс сохраняется на сервере — войдите под этим именем на любом устройстве.',
    en: 'Progress is saved on the server — sign in with this name on any device.',
    el: 'Η πρόοδος αποθηκεύεται στον διακομιστή — συνδέσου με αυτό το όνομα από οποιαδήποτε συσκευή.',
  },
  'account.signOut': { ru: 'Выйти', en: 'Sign out', el: 'Αποσύνδεση' },
  'account.new': { ru: 'Новый аккаунт', en: 'New account', el: 'Νέος λογαριασμός' },
  'account.create?': { ru: 'Такого имени ещё нет — создать аккаунт', en: 'This name is free — create the account', el: 'Αυτό το όνομα δεν υπάρχει — να δημιουργηθεί ο λογαριασμός' },
  'account.create': { ru: 'Создать', en: 'Create', el: 'Δημιουργία' },
  'account.fix': { ru: 'Исправить', en: 'Change', el: 'Διόρθωση' },
  'account.signIn': { ru: 'Вход', en: 'Sign in', el: 'Σύνδεση' },
  'account.howto': {
    ru: 'Придумайте имя и входите под ним на любом устройстве — прогресс будет общий. Пароль не нужен.',
    en: 'Choose a name and sign in with it on any device — your progress is shared. No password needed.',
    el: 'Διάλεξε ένα όνομα και συνδέσου με αυτό σε κάθε συσκευή — η πρόοδος είναι κοινή. Δεν χρειάζεται κωδικός.',
  },
  'account.placeholder': { ru: 'Ваше имя', en: 'Your name', el: 'Το όνομά σου' },
  'account.rules': {
    ru: '3–{max} символа: буквы, цифры, _ и -',
    en: '3–{max} characters: letters, digits, _ and -',
    el: '3–{max} χαρακτήρες: γράμματα, ψηφία, _ και -',
  },
  'account.continue': { ru: 'Продолжить', en: 'Continue', el: 'Συνέχεια' },
  'account.skip': { ru: 'Без входа', en: 'Not now', el: 'Χωρίς σύνδεση' },

  'city.offline': { ru: 'Нет связи с сервером', en: 'No connection to the server', el: 'Δεν υπάρχει σύνδεση με τον διακομιστή' },
  'city.updating': {
    ru: 'Сервер обновляется, попробуй ещё раз через минуту',
    en: 'The server is updating, try again in a minute',
    el: 'Ο διακομιστής ενημερώνεται, δοκίμασε ξανά σε ένα λεπτό',
  },
  'city.serverError': { ru: 'Ошибка сервера', en: 'Server error', el: 'Σφάλμα διακομιστή' },
  'city.micDenied': {
    ru: 'Доступ к микрофону запрещён. Разреши его в настройках браузера.',
    en: 'Microphone access is blocked. Allow it in the browser settings.',
    el: 'Η πρόσβαση στο μικρόφωνο είναι κλειστή. Επίτρεψέ τη στις ρυθμίσεις του browser.',
  },
  'city.startFailed': { ru: 'Не получилось начать разговор, попробуй ещё раз', en: 'Could not start the conversation, try again', el: 'Η συζήτηση δεν ξεκίνησε, δοκίμασε ξανά' },
  'city.codeFailed': { ru: 'Не получилось проверить код', en: 'Could not check the code', el: 'Ο κωδικός δεν ελέγχθηκε' },
  'city.dropped': { ru: 'Связь прервалась', en: 'The connection dropped', el: 'Η σύνδεση διακόπηκε' },
  'city.walkedAway': { ru: '{name} не хочет больше с тобой разговаривать', en: '{name} does not want to talk to you any more', el: '{name} δεν θέλει να σου μιλήσει άλλο' },
  'city.someone': { ru: 'Собеседник', en: 'The resident', el: 'Ο κάτοικος' },
  'city.noScene': { ru: 'Картинку нарисовать не получилось — играем без неё', en: 'Could not draw the picture — playing without it', el: 'Η εικόνα δεν σχεδιάστηκε — παίζουμε χωρίς αυτήν' },
  'city.inventing': { ru: 'Придумываю историю…', en: 'Making up a story…', el: 'Φτιάχνω μια ιστορία…' },
  'city.drawingThenTalk': { ru: 'Рисую сцену, потом начнём разговор…', en: 'Drawing the scene, then we talk…', el: 'Σχεδιάζω τη σκηνή και μετά μιλάμε…' },
  'city.drawing': { ru: 'Рисую сцену…', en: 'Drawing the scene…', el: 'Σχεδιάζω τη σκηνή…' },
  'city.preparing': { ru: '🎨 Готовлю сцену…', en: '🎨 Preparing the scene…', el: '🎨 Ετοιμάζω τη σκηνή…' },
  'city.queued': { ru: '🎨 Сцена в очереди на отрисовку', en: '🎨 The scene is waiting to be drawn', el: '🎨 Η σκηνή περιμένει να σχεδιαστεί' },
  'city.walking': { ru: 'Идёшь дальше по городу…', en: 'Walking on through the town…', el: 'Περπατάς στην πόλη…' },
  'city.won': { ru: 'Задание выполнено! 🎉', en: 'Task complete! 🎉', el: 'Η αποστολή ολοκληρώθηκε! 🎉' },
  'city.newTask': { ru: 'Новое задание', en: 'New task', el: 'Νέα αποστολή' },
  'city.otherTask': { ru: 'Другое задание', en: 'Another task', el: 'Άλλη αποστολή' },
  'city.choose': {
    ru: 'Ты отошёл от собеседника. Выбери в блокноте, к кому подойти',
    en: 'You stepped away. Pick someone in the notebook to go to',
    el: 'Απομακρύνθηκες. Διάλεξε στο σημειωματάριο σε ποιον θα πας',
  },
  'city.first': { ru: 'Нажми на микрофон, чтобы подойти к первому человеку', en: 'Press the microphone to go up to the first person', el: 'Πάτα το μικρόφωνο για να πας στο πρώτο άτομο' },
  'city.intro.el': {
    ru: '{city} — выдуманный греческий городок у моря. Ты турист, который только что сошёл с парома: получаешь задание и выполняешь его, разговаривая голосом с жителями по-гречески.',
    en: '{city} is a made-up Greek seaside town. You are a tourist who has just got off the ferry: you get a task and complete it by talking to the residents in Greek.',
    el: 'Η {city} είναι μια φανταστική ελληνική πόλη δίπλα στη θάλασσα. Είσαι τουρίστας που μόλις κατέβηκε από το πλοίο: παίρνεις μια αποστολή και την ολοκληρώνεις μιλώντας ελληνικά με τους κατοίκους.',
  },
  'city.intro.en': {
    ru: '{city} — выдуманный портовый городок в английском Корнуолле. Ты турист, который только что сошёл с поезда: получаешь задание и выполняешь его, разговаривая голосом с жителями по-английски.',
    en: '{city} is a made-up harbour town in Cornwall, England. You are a tourist who has just got off the train: you get a task and complete it by talking to the residents in English.',
    el: 'Το {city} είναι μια φανταστική πόλη με λιμάνι στην Κορνουάλη της Αγγλίας. Είσαι τουρίστας που μόλις κατέβηκε από το τρένο: παίρνεις μια αποστολή και την ολοκληρώνεις μιλώντας αγγλικά με τους κατοίκους.',
  },
  'city.intro.ru': {
    ru: '{city} — выдуманный старинный городок на Волге. Ты турист, который только что сошёл с теплохода: получаешь задание и выполняешь его, разговаривая голосом с жителями по-русски.',
    en: '{city} is a made-up old town on the Volga river. You are a tourist who has just got off the river boat: you get a task and complete it by talking to the residents in Russian.',
    el: 'Το {city} είναι μια φανταστική παλιά πόλη στον Βόλγα. Είσαι τουρίστας που μόλις κατέβηκε από το ποταμόπλοιο: παίρνεις μια αποστολή και την ολοκληρώνεις μιλώντας ρωσικά με τους κατοίκους.',
  },
  'city.start.el': { ru: 'Нажми на микрофон — и ты сойдёшь с парома в {city}', en: 'Press the microphone to step off the ferry in {city}', el: 'Πάτα το μικρόφωνο για να κατέβεις από το πλοίο στη {city}' },
  'city.start.en': { ru: 'Нажми на микрофон — и ты выйдешь из поезда в {city}', en: 'Press the microphone to step off the train in {city}', el: 'Πάτα το μικρόφωνο για να κατέβεις από το τρένο στο {city}' },
  'city.start.ru': { ru: 'Нажми на микрофон — и ты сойдёшь с теплохода в {city}', en: 'Press the microphone to step off the boat in {city}', el: 'Πάτα το μικρόφωνο για να κατέβεις από το πλοίο στο {city}' },
  'city.approaching': { ru: 'Подхожу…', en: 'Going up…', el: 'Πλησιάζω…' },
  'city.speaking': { ru: 'Говорит…', en: 'Speaking…', el: 'Μιλάει…' },
  'city.listening': { ru: 'Слушает тебя', en: 'Listening to you', el: 'Σε ακούει' },
  'city.paused': {
    ru: '⏸ Ты долго молчал — нажми на микрофон, чтобы продолжить',
    en: '⏸ You were silent for a while — press the microphone to go on',
    el: '⏸ Έμεινες σιωπηλός για λίγο — πάτα το μικρόφωνο για να συνεχίσεις',
  },
  'city.doneStatus': { ru: 'Задание выполнено — начни новое кнопкой или микрофоном', en: 'Task complete — start a new one with the button or the microphone', el: 'Η αποστολή ολοκληρώθηκε — ξεκίνα νέα με το κουμπί ή το μικρόφωνο' },
  'city.invite': { ru: 'Разговоры с жителями доступны по приглашению.', en: 'Talking to residents is by invitation.', el: 'Οι συζητήσεις με τους κατοίκους γίνονται με πρόσκληση.' },
  'city.inviteOnly': {
    ru: 'Разговоры с жителями пока доступны только по приглашению',
    en: 'Talking to residents is by invitation only for now',
    el: 'Οι συζητήσεις με τους κατοίκους είναι προς το παρόν μόνο με πρόσκληση',
  },
  'city.enterCode': { ru: 'Введи код доступа к городу:', en: 'Enter the town access code:', el: 'Γράψε τον κωδικό πρόσβασης της πόλης:' },
  'city.codeAria': { ru: 'Код доступа', en: 'Access code', el: 'Κωδικός πρόσβασης' },
  'city.open': { ru: 'Открыть', en: 'Open', el: 'Άνοιγμα' },
  'city.levelOk': { ru: 'Все реплики подходят для {level}', en: 'All lines fit {level}', el: 'Όλες οι φράσεις ταιριάζουν στο {level}' },
  'city.levelCount': { ru: '{who}: {ok} из {total} реплик по уровню {level}', en: '{who}: {ok} of {total} lines at level {level}', el: '{who}: {ok} από {total} φράσεις στο επίπεδο {level}' },
  'city.subsOn': { ru: 'Субтитры', en: 'Subtitles', el: 'Υπότιτλοι' },
  'city.subsOff': { ru: 'Без субтитров', en: 'No subtitles', el: 'Χωρίς υπότιτλους' },
  'city.endTalk': { ru: 'Закончить разговор', en: 'End the conversation', el: 'Τέλος συζήτησης' },
  'city.startTalk': { ru: 'Начать разговор', en: 'Start talking', el: 'Έναρξη συζήτησης' },
  'city.stepAway': { ru: 'Отойти', en: 'Step away', el: 'Απομάκρυνση' },
  'city.untranslatable': { ru: 'Не удалось перевести', en: 'Could not translate', el: 'Δεν μεταφράστηκε' },

  'progress.left': { ru: 'осталось ≈ {s} с', en: '≈ {s} s left', el: 'απομένουν ≈ {s} δευτ.' },
  'progress.almost': { ru: 'почти готово…', en: 'almost ready…', el: 'σχεδόν έτοιμο…' },

  'notebook.title': { ru: '📓 Блокнот', en: '📓 Notebook', el: '📓 Σημειωματάριο' },
  'notebook.aria': { ru: 'Блокнот', en: 'Notebook', el: 'Σημειωματάριο' },
  'notebook.points': { ru: '{n} очк. 🏆', en: '{n} pts 🏆', el: '{n} πόντοι 🏆' },
  'notebook.tip': { ru: 'Нажми на имя, чтобы подойти к человеку', en: 'Press a name to go up to that person', el: 'Πάτα ένα όνομα για να πας σε αυτό το άτομο' },
  'notebook.hidden': { ru: 'ещё не узнано: {n}', en: 'still unknown: {n}', el: 'άγνωστα ακόμα: {n}' },
  'notebook.strangers': { ru: 'не знакомы', en: 'not met', el: 'άγνωστοι' },
  'notebook.notMet': { ru: 'Вы ещё не разговаривали', en: 'You have not talked yet', el: 'Δεν έχετε μιλήσει ακόμα' },
  'notebook.normal': { ru: 'Ты ничем не задел — обычное отношение', en: 'You did nothing wrong — the usual attitude', el: 'Δεν έκανες τίποτα κακό — συνηθισμένη στάση' },
  'notebook.noReason': { ru: 'Причина не названа', en: 'No reason given', el: 'Δεν δόθηκε λόγος' },

  'board.aria': { ru: 'Лидерборд', en: 'Leaderboard', el: 'Κατάταξη' },
  'board.title': { ru: '🏆 Лидерборд {city}', en: '🏆 {city} leaderboard', el: '🏆 Κατάταξη {city}' },
  'board.loading': { ru: 'Загружаю…', en: 'Loading…', el: 'Φόρτωση…' },
  'board.failed': { ru: 'Не удалось загрузить', en: 'Could not load', el: 'Η φόρτωση απέτυχε' },
  'board.points': { ru: '⭐ Очки', en: '⭐ Points', el: '⭐ Πόντοι' },
  'board.quests': { ru: '🎯 Выполнено заданий', en: '🎯 Tasks completed', el: '🎯 Ολοκληρωμένες αποστολές' },
  'board.facts': { ru: '📓 Найдено фактов', en: '📓 Facts found', el: '📓 Γεγονότα που βρέθηκαν' },
  'board.players': { ru: '· игроков: {n}', en: '· players: {n}', el: '· παίκτες: {n}' },
  'board.you': { ru: '(ты)', en: '(you)', el: '(εσύ)' },
} satisfies Dict

export type UiKey = keyof typeof UI

const ATTITUDE: Record<string, Record<Lang, { male: string; female: string }>> = {
  friendly: { ru: { male: 'дружелюбен', female: 'дружелюбна' }, en: { male: 'friendly', female: 'friendly' }, el: { male: 'φιλικός', female: 'φιλική' } },
  annoyed: { ru: { male: 'раздражён', female: 'раздражена' }, en: { male: 'annoyed', female: 'annoyed' }, el: { male: 'ενοχλημένος', female: 'ενοχλημένη' } },
  offended: { ru: { male: 'обижен', female: 'обижена' }, en: { male: 'offended', female: 'offended' }, el: { male: 'προσβεβλημένος', female: 'προσβεβλημένη' } },
  angry: { ru: { male: 'зол на тебя', female: 'зла на тебя' }, en: { male: 'angry with you', female: 'angry with you' }, el: { male: 'θυμωμένος μαζί σου', female: 'θυμωμένη μαζί σου' } },
}

export function attitudeWord(ui: Lang, mood: string, gender: 'male' | 'female'): string {
  return (ATTITUDE[mood] ?? ATTITUDE.friendly)[ui][gender]
}

export function translate(ui: Lang, key: UiKey, vars: Record<string, string | number> = {}): string {
  return UI[key][ui].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''))
}

export const UiContext = createContext<Lang>('ru')

export function useT() {
  const ui = useContext(UiContext)
  return (key: UiKey, vars?: Record<string, string | number>) => translate(ui, key, vars)
}

export const useUi = () => useContext(UiContext)
