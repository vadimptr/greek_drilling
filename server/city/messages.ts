import type { Lang } from './scenario.ts'

const MESSAGES = {
  signIn: { ru: 'Нужно войти', en: 'Please sign in', el: 'Πρέπει να συνδεθείς' },
  needCode: { ru: 'Нужен код доступа к городу', en: 'You need an access code for the town', el: 'Χρειάζεσαι κωδικό πρόσβασης για την πόλη' },
  closed: { ru: 'Город пока закрыт для этого аккаунта', en: 'The town is not open for this account yet', el: 'Η πόλη δεν είναι ακόμα ανοιχτή για αυτόν τον λογαριασμό' },
  noGame: { ru: 'Игра не найдена', en: 'Game not found', el: 'Το παιχνίδι δεν βρέθηκε' },
  aiDown: { ru: 'Сервис ИИ сейчас недоступен, попробуй ещё раз', en: 'The AI service is unavailable right now, try again', el: 'Η υπηρεσία ΤΝ δεν είναι διαθέσιμη τώρα, δοκίμασε ξανά' },
  aiError: { ru: 'Ошибка сервиса ИИ', en: 'AI service error', el: 'Σφάλμα της υπηρεσίας ΤΝ' },
  tooManyCodes: { ru: 'Слишком много попыток, подожди 10 минут', en: 'Too many attempts, wait 10 minutes', el: 'Πάρα πολλές προσπάθειες, περίμενε 10 λεπτά' },
  wrongCode: { ru: 'Неверный код', en: 'Wrong code', el: 'Λάθος κωδικός' },
  noTranslator: { ru: 'Перевод не настроен', en: 'Translation is not configured', el: 'Η μετάφραση δεν έχει ρυθμιστεί' },
  emptyText: { ru: 'Пустой текст', en: 'Empty text', el: 'Κενό κείμενο' },
  noGenerator: { ru: 'Генератор сценариев не настроен', en: 'The story generator is not configured', el: 'Η γεννήτρια ιστοριών δεν έχει ρυθμιστεί' },
  storyLimit: {
    ru: 'На сегодня новых историй достаточно, приходи завтра',
    en: 'That is enough new stories for today, come back tomorrow',
    el: 'Αρκετές νέες ιστορίες για σήμερα, έλα αύριο',
  },
  noSound: { ru: 'Звука пока нет', en: 'No sound yet', el: 'Δεν υπάρχει ακόμα ήχος' },
  noImage: { ru: 'Картинки пока нет', en: 'No picture yet', el: 'Δεν υπάρχει ακόμα εικόνα' },
  noResident: { ru: 'Нет такого жителя', en: 'No such resident', el: 'Δεν υπάρχει τέτοιος κάτοικος' },
  done: { ru: 'Задание уже выполнено', en: 'The task is already done', el: 'Η αποστολή έχει ήδη ολοκληρωθεί' },
  noVoice: { ru: 'Голосовой сервис не настроен', en: 'The voice service is not configured', el: 'Η φωνητική υπηρεσία δεν έχει ρυθμιστεί' },
  unknownPlace: {
    ru: 'Ты ещё не знаешь, где найти этого жителя',
    en: 'You do not know yet where to find this resident',
    el: 'Δεν ξέρεις ακόμα πού θα βρεις αυτόν τον κάτοικο',
  },
  notMet: { ru: 'С этим жителем ты ещё не говорил', en: 'You have not talked to this resident yet', el: 'Δεν έχεις μιλήσει ακόμα με αυτόν τον κάτοικο' },
  talkLimit: {
    ru: 'На сегодня разговоров достаточно, город отдыхает до завтра',
    en: 'That is enough talking for today, the town is resting until tomorrow',
    el: 'Αρκετές κουβέντες για σήμερα, η πόλη ξεκουράζεται μέχρι αύριο',
  },
  unknownMood: { ru: 'Неизвестное настроение', en: 'Unknown mood', el: 'Άγνωστη διάθεση' },
  cannotFinish: { ru: 'Этот житель не может закрыть задание', en: 'This resident cannot complete the task', el: 'Αυτός ο κάτοικος δεν μπορεί να ολοκληρώσει την αποστολή' },
} satisfies Record<string, Record<Lang, string>>

export type MessageKey = keyof typeof MESSAGES

export const say = (lang: Lang, key: MessageKey): string => MESSAGES[key][lang]
