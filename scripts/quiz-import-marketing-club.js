const BASE = 'https://back.makedown.online/api/v1';

// Step 1: log in as ADMIN (env: ADMIN_EMAIL / ADMIN_PASSWORD, or a
// pre-fetched MD_ADMIN_TOKEN) to create the "Marketing Club" school.
// Step 2: log in AS that school (env: SCHOOL_EMAIL / SCHOOL_PASSWORD —
// defaults to the school's contactEmail/password below) to get a
// school-scoped token, then create the 5 quizzes + 29 questions under it.
// A quiz created with an admin token always lands in the public catalog;
// only a quiz created while logged in AS the school gets school_id set and
// stays private to that school. That's why this script logs in twice.

let ADMIN_TOKEN = process.env.MD_ADMIN_TOKEN || null;

const SCHOOL = {
  nameEn: 'Marketing Club',
  nameAr: 'ناد التسويق',
  contactEmail: 'marketingclub@makedown.com',
  // Override with SCHOOL_PASSWORD env var if you want a different one.
  password: process.env.SCHOOL_PASSWORD || 'oXQO9GBui0eZ',
};

async function api(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token === false ? {} : { Authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json)}`);
  }
  return json.data;
}

async function ensureAdminToken() {
  if (ADMIN_TOKEN) return;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('Set either MD_ADMIN_TOKEN, or ADMIN_EMAIL + ADMIN_PASSWORD, as env vars.');
    process.exit(1);
  }
  console.log(`Logging in as admin ${email}...`);
  const result = await api('POST', '/admin/auth/login', { identifier: email, password }, false);
  ADMIN_TOKEN = result.accessToken;
  console.log('Admin login OK.');
}

// ---- the 5 quizzes, each with its questions ----
// points cycle through the board's 200/400/600 tiers (2 per tier is the
// minimum the play board picks from — see TILES_PER_QUIZ_TIER in
// play.repository.js).

const QUIZZES = [
  {
    titleEn: 'Box Hill College Kuwait',
    titleAr: 'كلية بوكسهل الكويت',
    questions: [
      {
        points: 200,
        questionTextEn: 'In which year was Box Hill College Kuwait founded?',
        questionTextAr: 'في أي سنة تأسست كلية بوكسهل الكويت؟',
        optionsEn: ['2007', '2005', '2009', '2012'],
        optionsAr: ['٢٠٠٧', '٢٠٠٥', '٢٠٠٩', '٢٠١٢'],
        correctOptionIndex: 0,
      },
      {
        points: 200,
        questionTextEn: 'On what date did the college receive institutional accreditation from the awarding body?',
        questionTextAr: 'في أي تاريخ حصلت الكلية على الاعتماد المؤسسي من مجلس الجامعات المخاصة؟',
        optionsEn: ['22 October 2010', '15 May 2009', '1 January 2011', '22 October 2012'],
        optionsAr: ['٢٢ أكتوبر ٢٠١٠', '١٥ مايو ٢٠٠٩', '١ يناير ٢٠١١', '٢٢ أكتوبر ٢٠١٢'],
        correctOptionIndex: 0,
      },
      {
        points: 400,
        questionTextEn: 'How many people does the college\'s largest lecture hall seat?',
        questionTextAr: 'كم شخصاً تتسع لهم قاعة المحاضرات في الكلية؟',
        optionsEn: ['280 people', '200 people', '350 people', '400 people'],
        optionsAr: ['٢٨٠ شخصاً', '٢٠٠ شخص', '٣٥٠ شخصاً', '٤٠٠ شخص'],
        correctOptionIndex: 0,
      },
      {
        points: 400,
        questionTextEn: 'What does the "2+2" Bachelor\'s program structure mean?',
        questionTextAr: 'ما هو نظام برنامج البكالوريوس "٢+٢"؟',
        optionsEn: [
          'Two years diploma, then two years bachelor\'s',
          'One year diploma, then three years bachelor\'s',
          'Two years bachelor\'s only',
          'Four years diploma',
        ],
        optionsAr: [
          'سنتان دبلوم، ثم سنتان بكالوريوس',
          'سنة دبلوم، ثم ٣ سنوات بكالوريوس',
          'سنتان بكالوريوس فقط',
          '٤ سنوات دبلوم',
        ],
        correctOptionIndex: 0,
      },
      {
        points: 600,
        questionTextEn: 'How many levels does the intensive English language program have?',
        questionTextAr: 'كم مستوى في برنامج اللغة الإنجليزية المكثفة؟',
        optionsEn: ['Two levels', '3 levels', '4 levels', '5 levels'],
        optionsAr: ['مستويان', '٣ مستويات', '٤ مستويات', '٥ مستويات'],
        correctOptionIndex: 0,
      },
    ],
  },
  {
    titleEn: 'Volleyball',
    titleAr: 'كرة الطائرة',
    questions: [
      {
        points: 200,
        questionTextEn: 'How many main players does each team have on the court?',
        questionTextAr: 'كم عدد اللاعبين الأساسيين لكل فريق داخل الملعب؟',
        optionsEn: ['6 players', '5 players', '7 players', '8 players'],
        optionsAr: ['٦ لاعبين', '٥ لاعبين', '٧ لاعبين', '٨ لاعبين'],
        correctOptionIndex: 0,
      },
      {
        points: 200,
        questionTextEn: 'What is the maximum number of touches a team is allowed to return the ball to their opponent?',
        questionTextAr: 'ما هو الحد الأقصى لعدد اللمسات المسموح بها للفريق الواحد لإعادة الكرة للمنافس؟',
        optionsEn: ['3 touches', '2 touches', '4 touches', '5 touches'],
        optionsAr: ['٣ لمسات', '٢ لمستان', '٤ لمسات', '٥ لمسات'],
        correctOptionIndex: 0,
      },
      {
        points: 400,
        questionTextEn: 'How many points are needed to win a regular set?',
        questionTextAr: 'كم عدد النقاط المطلوبة للفوز بالشوط العادي؟',
        optionsEn: [
          '25 points, winning by at least 2',
          '21 points, winning by 1',
          '30 points, winning by 2',
          '20 points, winning by 3',
        ],
        optionsAr: [
          '٢٥ نقطة، بفارق نقطتين على الأقل',
          '٢١ نقطة، بفارق نقطة',
          '٣٠ نقطة، بفارق نقطتين',
          '٢٠ نقطة، بفارق ٣ نقاط',
        ],
        correctOptionIndex: 0,
      },
      {
        points: 400,
        questionTextEn: 'What are the official dimensions of a volleyball court?',
        questionTextAr: 'ما هي أبعاد ملعب كرة الطائرة المعتمدة؟',
        optionsEn: ['18m x 9m', '20m x 10m', '16m x 8m', '24m x 12m'],
        optionsAr: ['١٨ متر × ٩ أمتار', '٢٠ متر × ١٠ أمتار', '١٦ متر × ٨ أمتار', '٢٤ متر × ١٢ متر'],
        correctOptionIndex: 0,
      },
      {
        points: 600,
        questionTextEn: 'What is the net height in men\'s and women\'s competitions?',
        questionTextAr: 'ما هو ارتفاع الشبكة في منافسات الرجال ومنافسات السيدات؟',
        optionsEn: [
          '2.43m for men, 2.24m for women',
          '2.40m for men, 2.20m for women',
          '2.50m for men, 2.30m for women',
          '2.30m for men, 2.10m for women',
        ],
        optionsAr: [
          '٢٫٤٣ م للرجال و٢٫٢٤ م للسيدات',
          '٢٫٤٠ م للرجال و٢٫٢٠ م للسيدات',
          '٢٫٥٠ م للرجال و٢٫٣٠ م للسيدات',
          '٢٫٣٠ م للرجال و٢٫١٠ م للسيدات',
        ],
        correctOptionIndex: 0,
      },
      {
        points: 600,
        questionTextEn: 'What distinguishes the Libero\'s jersey from the rest of the team?',
        questionTextAr: 'ما الذي يميز قميص لاعب "الليبيرو" عن بقية زملائه؟',
        optionsEn: [
          'A different color or design',
          'The exact same color',
          'Always white',
          'Only wears number 1',
        ],
        optionsAr: [
          'يكون بلون أو تصميم مختلف',
          'يكون بنفس اللون تماماً',
          'يكون باللون الأبيض دائماً',
          'يكون عليه رقم ١ فقط',
        ],
        correctOptionIndex: 0,
      },
    ],
  },
  {
    titleEn: 'Kuwait',
    titleAr: 'الكويت',
    questions: [
      {
        points: 200,
        questionTextEn: 'What is the official capital of the State of Kuwait?',
        questionTextAr: 'ما هي العاصمة الرسمية لدولة الكويت؟',
        optionsEn: ['Kuwait City', 'Hawally', 'Farwaniya', 'Jahra'],
        optionsAr: ['مدينة الكويت', 'حولي', 'الفروانية', 'الجهراء'],
        correctOptionIndex: 0,
      },
      {
        points: 200,
        questionTextEn: 'What is the official currency used in Kuwait?',
        questionTextAr: 'ما هي العملة الرسمية المستخدمة في الكويت؟',
        optionsEn: ['Kuwaiti Dinar', 'Kuwaiti Riyal', 'Kuwaiti Dirham', 'Kuwaiti Pound'],
        optionsAr: ['الدينار الكويتي', 'الريال الكويتي', 'الدرهم الكويتي', 'الجنيه الكويتي'],
        correctOptionIndex: 0,
      },
      {
        points: 400,
        questionTextEn: 'In what year did Kuwait gain independence?',
        questionTextAr: 'في أي عام استقلت دولة الكويت؟',
        optionsEn: ['1961', '1958', '1965', '1971'],
        optionsAr: ['١٩٦١م', '١٩٥٨م', '١٩٦٥م', '١٩٧١م'],
        correctOptionIndex: 0,
      },
      {
        points: 400,
        questionTextEn: 'What is the famous three-tower landmark at the center of the capital on the Gulf coast?',
        questionTextAr: 'ما المعلم الشهير المكون من ثلاثة أبراج ويتوسط العاصمة على ساحل الخليج العربي؟',
        optionsEn: ['Kuwait Towers', 'Liberation Tower', 'Seif Palace', 'Scientific Center'],
        optionsAr: ['أبراج الكويت', 'برج التحرير', 'قصر السيف', 'المركز العلمي'],
        correctOptionIndex: 0,
      },
      {
        points: 600,
        questionTextEn: 'What is the largest Kuwaiti island by area?',
        questionTextAr: 'ما هي أكبر جزيرة كويتية من حيث المساحة؟',
        optionsEn: ['Bubiyan Island', 'Failaka Island', 'Warba Island', 'Kubbar Island'],
        optionsAr: ['جزيرة بوبيان', 'جزيرة فيلكا', 'جزيرة وربة', 'جزيرة كبر'],
        correctOptionIndex: 0,
      },
      {
        points: 600,
        questionTextEn: 'What is the name of the legislative council historically known as the National Assembly in Kuwait?',
        questionTextAr: 'ما اسم المجلس التشريعي المعروفة تاريخياً باسم مجلس الأمة في الكويت؟',
        optionsEn: ['Kuwait National Assembly', 'Council of Ministers', 'Municipal Council', 'Supreme Judicial Council'],
        optionsAr: ['مجلس الأمة الكويتي', 'مجلس الوزراء', 'المجلس البلدي', 'مجلس القضاء الأعلى'],
        correctOptionIndex: 0,
      },
    ],
  },
  {
    titleEn: 'Currencies',
    titleAr: 'العملات',
    questions: [
      {
        points: 200,
        questionTextEn: 'What is the most globally traded currency in the foreign exchange market?',
        questionTextAr: 'ما هي العملة الأكثر تداولاً في سوق الصرف الأجنبي عالمياً؟',
        optionsEn: ['US Dollar', 'Euro', 'British Pound', 'Japanese Yen'],
        optionsAr: ['الدولار الأمريكي', 'اليورو', 'الجنيه الإسترليني', 'الين الياباني'],
        correctOptionIndex: 0,
      },
      {
        points: 200,
        questionTextEn: 'Which currency is known for having the highest nominal value against the US Dollar?',
        questionTextAr: 'أي عملة تُعرف بأنها الأعلى قيمة اسمياً مقابل الدولار الأمريكي؟',
        optionsEn: ['Kuwaiti Dinar', 'Euro', 'British Pound', 'Swiss Franc'],
        optionsAr: ['الدينار الكويتي', 'اليورو', 'الجنيه الإسترليني', 'الفرنك السويسري'],
        correctOptionIndex: 0,
      },
      {
        points: 400,
        questionTextEn: 'What is the official currency used by most European Union countries?',
        questionTextAr: 'ما هي العملة الرسمية التي تستخدمها أغلب دول الاتحاد الأوروبي؟',
        optionsEn: ['Euro', 'US Dollar', 'British Pound', 'Swiss Franc'],
        optionsAr: ['اليورو', 'الدولار الأمريكي', 'الجنيه الإسترليني', 'الفرنك السويسري'],
        correctOptionIndex: 0,
      },
      {
        points: 400,
        questionTextEn: 'What is the official currency of Japan?',
        questionTextAr: 'ما هي العملة الرسمية في اليابان؟',
        optionsEn: ['Japanese Yen', 'Korean Won', 'Chinese Yuan', 'Singapore Dollar'],
        optionsAr: ['الين الياباني', 'الوون الكوري', 'اليوان الصيني', 'الدولار السنغافوري'],
        correctOptionIndex: 0,
      },
      {
        points: 600,
        questionTextEn: 'What is the name of one of the oldest national currencies still in use today?',
        questionTextAr: 'ما اسم إحدى أقدم العملات الوطنية التي لا تزال مستخدمة حتى اليوم؟',
        optionsEn: ['British Pound', 'Euro', 'Canadian Dollar', 'Russian Ruble'],
        optionsAr: ['الجنيه الإسترليني', 'اليورو', 'الدولار الكندي', 'الروبل الروسي'],
        correctOptionIndex: 0,
      },
      {
        points: 600,
        questionTextEn: 'What is the first and largest cryptocurrency by market value?',
        questionTextAr: 'ما هي أول وأكبر عملة رقمية مشفرة من حيث القيمة السوقية؟',
        optionsEn: ['Bitcoin', 'Ethereum', 'Litecoin', 'Solana'],
        optionsAr: ['البيتكوين', 'إيثيريوم', 'لايتكوين', 'سولانا'],
        correctOptionIndex: 0,
      },
    ],
  },
  {
    titleEn: 'Kuwaiti Football',
    titleAr: 'كرة القدم الكويتية',
    questions: [
      {
        points: 200,
        questionTextEn: 'What is the famous nickname of Kuwait\'s national football team?',
        questionTextAr: 'ما هو اللقب الشهير الذي يُعرف به منتخب الكويت لكرة القدم؟',
        optionsEn: ['Blue', 'White', 'Green', 'Red'],
        optionsAr: ['الأزرق', 'الأبيض', 'الأخضر', 'الأحمر'],
        correctOptionIndex: 0,
      },
      {
        points: 200,
        questionTextEn: 'In what year did Kuwait\'s national team win its only Asian Cup title?',
        questionTextAr: 'في أي عام حقق منتخب الكويت لقبه الوحيد في كأس آسيا؟',
        optionsEn: ['1980', '1976', '1984', '1990'],
        optionsAr: ['١٩٨٠م', '١٩٧٦م', '١٩٨٤م', '١٩٩٠م'],
        correctOptionIndex: 0,
      },
      {
        points: 400,
        questionTextEn: 'Which is the only World Cup edition Kuwait\'s national team has qualified for?',
        questionTextAr: 'ما هي النسخة الوحيدة من كأس العالم التي تأهل إليها منتخب الكويت؟',
        optionsEn: ['Spain 1982', 'Mexico 1986', 'Italy 1990', 'France 1998'],
        optionsAr: ['إسبانيا ١٩٨٢', 'المكسيك ١٩٨٦', 'إيطاليا ١٩٩٠', 'فرنسا ١٩٩٨'],
        correctOptionIndex: 0,
      },
      {
        points: 400,
        questionTextEn: 'Which Kuwaiti player scored the team\'s first-ever World Cup goal?',
        questionTextAr: 'من هو اللاعب الكويتي الذي سجل أول هدف للمنتخب في تاريخ مشاركاته بكأس العالم؟',
        optionsEn: ['Faisal Al-Dakhil', 'Badr Al-Mutawa', 'Jassem Yaqoub', 'Mouayad Al-Haddad'],
        optionsAr: ['فيصل الدخيل', 'بدر المطوع', 'جاسم يعقوب', 'مؤيد الحداد'],
        correctOptionIndex: 0,
      },
      {
        points: 600,
        questionTextEn: 'How many times has Kuwait\'s national team won the Arabian Gulf Cup?',
        questionTextAr: 'كم عدد المرات التي فاز فيها منتخب الكويت بكأس الخليج العربي؟',
        optionsEn: ['10 titles', '8 titles', '9 titles', '12 titles'],
        optionsAr: ['١٠ ألقاب', '٨ ألقاب', '٩ ألقاب', '١٢ لقباً'],
        correctOptionIndex: 0,
      },
      {
        points: 600,
        questionTextEn: 'Who is Kuwait\'s national football team\'s all-time top scorer?',
        questionTextAr: 'من هو الهداف التاريخي لمنتخب الكويت لكرة القدم؟',
        optionsEn: ['Badr Al-Mutawa', 'Faisal Al-Dakhil', 'Jassem Yaqoub', 'Bashar Abdullah'],
        optionsAr: ['بدر المطوع', 'فيصل الدخيل', 'جاسم يعقوب', 'بشار عبدالله'],
        correctOptionIndex: 0,
      },
    ],
  },
];

async function main() {
  await ensureAdminToken();
  console.log('Verifying admin token...');
  const me = await api('GET', '/admin/auth/me', null, ADMIN_TOKEN);
  console.log('Logged in as admin:', me.admin?.email || JSON.stringify(me));

  const schoolPassword = process.env.SCHOOL_PASSWORD || SCHOOL.password;

  console.log(`\nCreating school "${SCHOOL.nameEn}" (${SCHOOL.contactEmail})...`);
  let school;
  try {
    school = await api('POST', '/admin/schools', {
      nameEn: SCHOOL.nameEn,
      nameAr: SCHOOL.nameAr,
      contactEmail: SCHOOL.contactEmail,
      password: schoolPassword,
      isActive: true,
    }, ADMIN_TOKEN);
    console.log(`  created school id ${school.id}`);
  } catch (err) {
    if (!/already uses this contact email/i.test(err.message)) throw err;
    console.log('  school already exists — reusing it and resetting its password to the one this script uses.');
    const schools = await api('GET', '/admin/schools', null, ADMIN_TOKEN);
    school = (Array.isArray(schools) ? schools : schools.rows || schools.items || []).find(
      (s) => (s.contactEmail || s.contact_email) === SCHOOL.contactEmail
    );
    if (!school) throw new Error(`Could not find existing school with email ${SCHOOL.contactEmail} in the list`);
    await api('PATCH', `/admin/schools/${school.id}`, { password: schoolPassword }, ADMIN_TOKEN);
    console.log(`  reusing school id ${school.id}, password reset`);
  }

  console.log(`\nLogging in AS the school (so quizzes are created as its own private content)...`);
  const schoolLogin = await api('POST', '/admin/auth/login', {
    identifier: process.env.SCHOOL_EMAIL || SCHOOL.contactEmail,
    password: schoolPassword,
  }, false);
  const SCHOOL_TOKEN = schoolLogin.accessToken;
  console.log('School login OK.');

  console.log('\nChecking for quizzes this school already has (so reruns don\'t duplicate)...');
  const existingQuizzes = await api('GET', '/admin/quizzes', null, SCHOOL_TOKEN);
  const existingTitles = new Set(
    (Array.isArray(existingQuizzes) ? existingQuizzes : existingQuizzes.rows || existingQuizzes.items || []).map(
      (q) => q.titleEn || q.title_en
    )
  );

  let totalQuestions = 0;
  for (const quizDef of QUIZZES) {
    if (existingTitles.has(quizDef.titleEn)) {
      console.log(`\nSkipping "${quizDef.titleEn}" — a quiz with this title already exists for this school.`);
      continue;
    }
    console.log(`\nCreating quiz "${quizDef.titleEn}"...`);
    const quiz = await api('POST', '/admin/quizzes', {
      titleEn: quizDef.titleEn,
      titleAr: quizDef.titleAr,
      isActive: true,
    }, SCHOOL_TOKEN);
    console.log(`  created quiz id ${quiz.id}`);

    let sortOrder = 0;
    for (const q of quizDef.questions) {
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
      }, SCHOOL_TOKEN);
      totalQuestions++;
    }
    console.log(`  added ${quizDef.questions.length} questions`);
  }

  console.log(`\nDone — school "${SCHOOL.nameEn}" (id ${school.id}) now has ${QUIZZES.length} quizzes and ${totalQuestions} questions.`);
  console.log(`School login: ${SCHOOL.contactEmail} / ${process.env.SCHOOL_PASSWORD || SCHOOL.password}`);
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
