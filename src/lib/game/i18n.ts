import type { Difficulty } from "./types";
import type { Lang } from "@/lib/i18n/dictionary";

export interface GameText {
  title: string;
  cardKicker: string;
  cardTitle: string;
  cardDesc: string;
  cardHighlights: [string, string, string];
  playFree: string;
  biggerScreen: string;
  exitBiggerScreen: string;
  loading: string;
  loadError: string;
  retry: string;
  cancel: string;
  startChallenge: string;
  tryTutorial: string;
  skipTutorial: string;
  tutorialTitle: string;
  tutorialMove: string;
  tutorialJump: string;
  tutorialHit: string;
  tutorialProgress: string;
  chooseDifficulty: string;
  difficultyEasy: string;
  difficultyMedium: string;
  difficultyHard: string;
  countdown: string;
  serve: string;
  pause: string;
  resume: string;
  quit: string;
  quitConfirm: string;
  quitYes: string;
  quitNo: string;
  time: string;
  you: string;
  opponent: string;
  gameRules: string;
  ruleTouchNet: string;
  ruleThreeTouches: string;
  ruleLinesIn: string;
  ruleTiming: string;
  sorryOffline: string;
  pointYou: string;
  pointOpponent: string;
  reasonGround: string;
  reasonOut: string;
  reasonFourTouches: string;
  reasonTimeout: string;
  matchOver: string;
  youWon: string;
  youLost: string;
  draw: string;
  yourScore: string;
  matchPoints: string;
  perfectHits: string;
  longestStreak: string;
  bestLocal: string;
  newBest: string;
  playAgain: string;
  challengeFriend: string;
  shareResult: string;
  shareHint: string;
  copied: string;
  localResult: string;
  ctaTitle: string;
  ctaDesc: string;
  viewBeachGames: string;
  browseOtherSports: string;
  soundOn: string;
  soundOff: string;
  controls: string;
  controlsKeyboard: string;
  controlsTouch: string;
  move: string;
  jump: string;
  hit: string;
  tip: string;
  jumpHint: string;
  perfectHit: string;
  whyBook: string;
  rulesNotice: string;
  fullscreenHint: string;
}

const en: GameText = {
  title: "Playza Beach Challenge",
  cardKicker: "NEW · 90-SECOND CHALLENGE",
  cardTitle: "Need a match? Play now 🏐",
  cardDesc: "A 90-second challenge. Your timing is what wins it.",
  cardHighlights: ["No sign-up needed", "Play on mobile or desktop", "Beat the computer"],
  playFree: "Play free",
  biggerScreen: "Bigger screen",
  exitBiggerScreen: "Close big screen",
  loading: "Loading the court…",
  loadError: "The game couldn't load.",
  retry: "Try again",
  cancel: "Cancel",
  startChallenge: "Start the challenge",
  tryTutorial: "Try the practice",
  skipTutorial: "Skip practice",
  tutorialTitle: "Quick practice",
  tutorialMove: "Move",
  tutorialJump: "Jump",
  tutorialHit: "Hit the ball",
  tutorialProgress: "Practice",
  chooseDifficulty: "Pick a level",
  difficultyEasy: "Easy",
  difficultyMedium: "Medium",
  difficultyHard: "Hard",
  countdown: "Get ready",
  serve: "Hit to serve",
  pause: "Pause",
  resume: "Resume",
  quit: "Quit match",
  quitConfirm: "Leave the match? This round's progress will be lost.",
  quitYes: "Leave",
  quitNo: "Keep playing",
  time: "Time",
  you: "You",
  opponent: "Rival",
  gameRules: "Game rules",
  ruleTouchNet: "Touching the net with your body isn't a fault in this arcade version.",
  ruleThreeTouches: "Up to 3 touches per side — the 4th is a fault.",
  ruleLinesIn: "Lines count as in — decided by the ball's centre on landing.",
  ruleTiming: "Jump and time your hit near the ball to land a Perfect Hit.",
  sorryOffline: "Scores can't be saved right now, but you can keep playing.",
  pointYou: "Your point!",
  pointOpponent: "Rival's point",
  reasonGround: "Ball landed",
  reasonOut: "Ball out",
  reasonFourTouches: "More than 3 touches",
  reasonTimeout: "Time up",
  matchOver: "Match over",
  youWon: "You won! 🎉",
  youLost: "You lost",
  draw: "Draw",
  yourScore: "Your score",
  matchPoints: "Match points",
  perfectHits: "Perfect hits",
  longestStreak: "Longest streak",
  bestLocal: "Personal best",
  newBest: "New personal best!",
  playAgain: "Play again",
  challengeFriend: "Challenge a friend",
  shareResult: "Share result",
  shareHint: "Send your score as a card or a link.",
  copied: "Link copied",
  localResult: "Local result",
  ctaTitle: "Liked playing here? Try it on real sand 🏐",
  ctaDesc: "Find beach volleyball games on Playza and play for real.",
  viewBeachGames: "See beach volleyball games",
  browseOtherSports: "Browse other sports",
  soundOn: "Sound on",
  soundOff: "Sound off",
  controls: "Controls",
  controlsKeyboard: "Keyboard",
  controlsTouch: "Touch",
  move: "Move",
  jump: "Jump",
  hit: "Hit",
  tip: "Tip",
  jumpHint: "Jump",
  perfectHit: "Perfect Hit!",
  whyBook: "Real games, real courts — this is what you're training for.",
  rulesNotice: "This is an arcade version, not tournament rules.",
  fullscreenHint: "For a bigger view, rotate your phone or use a larger screen.",
};

const ar: GameText = {
  title: "تحدّي بلايزا الشاطئي",
  cardKicker: "جديد · تحدّي 90 ثانية",
  cardTitle: "ناقصك ماتش؟ العب دلوقتي 🏐",
  cardDesc: "تحدّي 90 ثانية… وتوقيتك هو اللي هيكسبك",
  cardHighlights: ["من غير تسجيل", "العب من الموبايل أو الكمبيوتر", "اتحدّى الكمبيوتر"],
  playFree: "العب مجانًا",
  biggerScreen: "شاشة أكبر",
  exitBiggerScreen: "أغلق الشاشة الكبيرة",
  loading: "بنحمّل الملعب…",
  loadError: "اللعبة مش راضية تحمّل.",
  retry: "حاول تاني",
  cancel: "إلغاء",
  startChallenge: "ابدأ التحدّي",
  tryTutorial: "جرّب التدريب",
  skipTutorial: "تخطّى التدريب",
  tutorialTitle: "تدريب سريع",
  tutorialMove: "تحرّك",
  tutorialJump: "اقفز",
  tutorialHit: "اضرب الكورة",
  tutorialProgress: "التدريب",
  chooseDifficulty: "اختار المستوى",
  difficultyEasy: "سهل",
  difficultyMedium: "متوسط",
  difficultyHard: "صعب",
  countdown: "استعد",
  serve: "اضرب عشان ترسل",
  pause: "إيقاف",
  resume: "كمّل",
  quit: "اخرج من الماتش",
  quitConfirm: "تخرج من الماتش؟ تقدم الجولة دي هيتفقد.",
  quitYes: "اخرج",
  quitNo: "كمّل لعب",
  time: "الوقت",
  you: "أنت",
  opponent: "المنافس",
  gameRules: "قواعد اللعبة",
  ruleTouchNet: "لمس الشبكة بالجسم مش خطأ في النسخة الأركيد دي.",
  ruleThreeTouches: "3 لمسات لكل جانب كحد أقصى، والرابعة خطأ.",
  ruleLinesIn: "الخطوط تُحسب داخل الملعب، حسب مركز الكورة وقت الهبوط.",
  ruleTiming: "اقفز واضرب الكورة في التوقيت المناسب لتحقيق ضربة ممتازة.",
  sorryOffline: "مش قادرين نحفظ النتيجة دلوقتي، بس تقدر تكمّل لعب.",
  pointYou: "نقطتك!",
  pointOpponent: "نقطة للمنافس",
  reasonGround: "الكورة وقعت",
  reasonOut: "الكورة برّه",
  reasonFourTouches: "أكتر من 3 لمسات",
  reasonTimeout: "خلص الوقت",
  matchOver: "الجولة خلصت",
  youWon: "كسبت! 🎉",
  youLost: "خسرت",
  draw: "تعادل",
  yourScore: "تقييمك",
  matchPoints: "نقاط الماتش",
  perfectHits: "ضربات ممتازة",
  longestStreak: "أطول سلسلة",
  bestLocal: "أفضل نتيجة شخصية",
  newBest: "أفضل نتيجة جديدة!",
  playAgain: "العب تاني",
  challengeFriend: "تحدّى صاحبك",
  shareResult: "شارك النتيجة",
  shareHint: "ابعت نتيجتك على شكل بطاقة أو رابط.",
  copied: "اتنسخ الرابط",
  localResult: "نتيجة محلية",
  ctaTitle: "حلو اللعب هنا؟ جرّبه على الرمل بجد 🏐",
  ctaDesc: "لاقي ماتشات الكرة الطائرة الشاطئية على بلايزا والعب بجد.",
  viewBeachGames: "شوف ماتشات Beach Volleyball",
  browseOtherSports: "اتفرّج على رياضات تانية",
  soundOn: "الصوت مفتوح",
  soundOff: "الصوت مقفول",
  controls: "التحكم",
  controlsKeyboard: "الكيبورد",
  controlsTouch: "اللمس",
  move: "حركة",
  jump: "قفز",
  hit: "ضرب",
  tip: "Tip",
  jumpHint: "اقفز",
  perfectHit: "ضربة ممتازة!",
  whyBook: "ماتشات وملاعب حقيقية — ده اللي بتتمرّن عليه.",
  rulesNotice: "دي نسخة أركيد مبسطة، مش قواعد البطولات.",
  fullscreenHint: "لصورة أوضح، لفّ الموبايل أو استخدم شاشة أكبر.",
};

const dictionaries: Record<Lang, GameText> = { en, ar };

export function gameText(lang: Lang): GameText {
  return dictionaries[lang] ?? en;
}

export function difficultyLabel(difficulty: Difficulty, lang: Lang): string {
  return gameText(lang)[
    difficulty === "easy"
      ? "difficultyEasy"
      : difficulty === "hard"
        ? "difficultyHard"
        : "difficultyMedium"
  ];
}
