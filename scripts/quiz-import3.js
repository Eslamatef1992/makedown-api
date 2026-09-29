const BASE = 'https://back.makedown.online/api/v1';

// Either set MD_ADMIN_TOKEN directly (a token you already copied from
// somewhere), or set ADMIN_EMAIL + ADMIN_PASSWORD and this script logs in
// for you — no manual copy/paste of the access token required, which is
// where the last few attempts went wrong (a placeholder string got left in
// place of a real token).
let TOKEN = process.env.MD_ADMIN_TOKEN || null;

async function api(method, path, body, overrideToken) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(overrideToken === false ? {} : { Authorization: `Bearer ${overrideToken || TOKEN}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json)}`);
  }
  return json.data;
}

async function ensureToken() {
  if (TOKEN) return;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('Set either MD_ADMIN_TOKEN, or ADMIN_EMAIL + ADMIN_PASSWORD, as env vars.');
    process.exit(1);
  }
  console.log(`Logging in as ${email}...`);
  const result = await api('POST', '/admin/auth/login', { identifier: email, password }, false);
  TOKEN = result.accessToken;
  console.log('Logged in OK.');
}

// The 12 Kuwait Perfume questions from quiz-import2.js — that script never
// found a matching existing quiz to add these to, so this one creates a
// fresh "Kuwait Perfume" quiz (no category, plain style — same as your
// "pilates" quiz) and adds them there instead.
const QUESTIONS = [
  {
    points: 200,
    questionTextEn: 'This is used to burn bakhoor. What is it called?',
    questionTextAr: 'تُستخدم هذه الأداة لحرق البخور. ما اسمها؟',
    optionsEn: ['Dallah', 'Mabkhara', 'Finjan', 'Mirash'],
    optionsAr: ['دلة', 'مبخرة', 'فنجان', 'مرش'],
    correctOptionIndex: 1,
  },
  {
    points: 200,
    questionTextEn: 'In a Kuwaiti home, what is passed around to guests near the end of a visit?',
    questionTextAr: 'في المنزل الكويتي، ماذا يُمرَّر على الضيوف قرب نهاية الزيارة؟',
    optionsEn: ['Bakhoor', 'Candles', 'Flowers', 'Hand cream'],
    optionsAr: ['بخور', 'شموع', 'ورد', 'كريم يدين'],
    correctOptionIndex: 0,
  },
  {
    points: 400,
    questionTextEn: 'This bottle sprinkles rose water on guests. What is it called?',
    questionTextAr: 'تُستخدم هذه القارورة لرش ماء الورد على الضيوف. ما اسمها؟',
    optionsEn: ['Dallah', 'Mabkhara', 'Mirash', 'Tasa'],
    optionsAr: ['دلة', 'مبخرة', 'مرش', 'طاسة'],
    correctOptionIndex: 2,
  },
  {
    points: 400,
    questionTextEn: 'What do you put under bakhoor in a traditional mabkhara?',
    questionTextAr: 'ماذا يُوضع تحت البخور في المبخرة التقليدية؟',
    optionsEn: ['Ice', 'Hot charcoal', 'A candle', 'Sand'],
    optionsAr: ['ثلج', 'فحم ساخن', 'شمعة', 'رمل'],
    correctOptionIndex: 1,
  },
  {
    points: 600,
    questionTextEn: 'Oud comes from which tree?',
    questionTextAr: 'من أي شجرة يُستخرج العود؟',
    optionsEn: ['Palm tree', 'Agarwood tree', 'Olive tree', 'Lemon tree'],
    optionsAr: ['شجرة النخيل', 'شجرة العود', 'شجرة الزيتون', 'شجرة الليمون'],
    correctOptionIndex: 1,
  },
  {
    points: 600,
    questionTextEn: 'What is "Dehn Al Oud"?',
    questionTextAr: 'ما هو "دهن العود"؟',
    optionsEn: ['Oud oil', 'Rose water', 'Musk powder', 'Amber stone'],
    optionsAr: ['زيت العود', 'ماء الورد', 'بودرة المسك', 'حجر العنبر'],
    correctOptionIndex: 0,
  },
  {
    points: 200,
    questionTextEn: 'The Kuwaiti brand "Gissah" means what in Arabic?',
    questionTextAr: 'ماذا تعني كلمة "قصة" (Gissah) كعلامة تجارية كويتية؟',
    optionsEn: ['Gift', 'Story', 'Garden', 'Pearl'],
    optionsAr: ['هدية', 'قصة', 'حديقة', 'لؤلؤة'],
    correctOptionIndex: 1,
  },
  {
    points: 200,
    questionTextEn: 'What does TFK stand for?',
    questionTextAr: 'ما اختصار TFK؟',
    optionsEn: ['The Fragrance Kitchen', 'The French Kiss', 'Top Fragrance Kuwait', 'Taif Flower King'],
    optionsAr: ['مطبخ العطور', 'القبلة الفرنسية', 'أفضل عطور الكويت', 'ملك زهرة الطائف'],
    correctOptionIndex: 0,
  },
  {
    points: 400,
    questionTextEn: 'Which Kuwaiti brand calls itself the first fragrance company in the Gulf?',
    questionTextAr: 'أي علامة كويتية تصف نفسها بأنها أول شركة عطور في الخليج؟',
    optionsEn: ['Gissah', 'Atyab Al Marshoud', 'CZAR', 'The Fragrance Kitchen'],
    optionsAr: ['قصة', 'أطياب آل مرشود', 'سي زد إيه آر', 'مطبخ العطور'],
    correctOptionIndex: 1,
  },
  {
    points: 400,
    questionTextEn: 'Which Kuwaiti perfume brand is named after a Russian emperor title?',
    questionTextAr: 'أي علامة عطور كويتية سُمّيت على اسم لقب إمبراطور روسي؟',
    optionsEn: ['CZAR', 'Gissah', 'OQ', 'Etry'],
    optionsAr: ['سي زد إيه آر', 'قصة', 'أو كيو', 'إتري'],
    correctOptionIndex: 0,
  },
  {
    points: 600,
    questionTextEn: 'In what year was Atyab Al Marshoud founded?',
    questionTextAr: 'في أي عام تأسست أطياب آل مرشود؟',
    optionsEn: ['1925', '1975', '1999', '2012'],
    optionsAr: ['1925', '1975', '1999', '2012'],
    correctOptionIndex: 0,
  },
  {
    points: 600,
    questionTextEn: 'Which Kuwaiti brand opened a counter at Bergdorf Goodman in New York in 2016?',
    questionTextAr: 'أي علامة كويتية افتتحت ركناً لها في متجر بيرغدورف غودمان في نيويورك عام 2016؟',
    optionsEn: ['Gissah', 'CZAR', 'The Fragrance Kitchen', 'Atyab Al Marshoud'],
    optionsAr: ['قصة', 'سي زد إيه آر', 'مطبخ العطور', 'أطياب آل مرشود'],
    correctOptionIndex: 2,
  },
];

async function main() {
  await ensureToken();
  console.log('Verifying token...');
  const me = await api('GET', '/admin/auth/me');
  console.log('Logged in as:', me.admin?.email || me.school?.email || JSON.stringify(me));

  console.log('\nCreating "Kuwait Perfume" quiz (no category, plain style)...');
  const quiz = await api('POST', '/admin/quizzes', {
    titleEn: 'Kuwait Perfume',
    titleAr: 'عطور الكويت',
    isActive: true,
  });
  console.log(`  created quiz id ${quiz.id}`);

  console.log(`\nAdding ${QUESTIONS.length} questions...`);
  let sortOrder = 0;
  for (const q of QUESTIONS) {
    await api('POST', `/admin/quizzes/${quiz.id}/questions`, {
      questionTextEn: q.questionTextEn,
      questionTextAr: q.questionTextAr,
      questionType: 'text',
      optionsEn: q.optionsEn,
      optionsAr: q.optionsAr,
      correctOptionIndex: q.correctOptionIndex,
      points: q.points,
      mode: 'both',
      timeLimitSeconds: 20,
      sortOrder: sortOrder++,
    });
  }

  console.log(`\nDone — quiz ${quiz.id} ("Kuwait Perfume") now has ${QUESTIONS.length} questions.`);
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
