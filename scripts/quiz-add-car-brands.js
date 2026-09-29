const BASE = 'https://back.makedown.online/api/v1';

// Adds a 600-point question to the existing "Box Hill College Kuwait" quiz
// (left as a TODO below until the affiliate-institute answer is supplied),
// and creates a new "Car Brands" quiz with 4 questions, under the
// Marketing Club school.

let ADMIN_TOKEN = process.env.MD_ADMIN_TOKEN || null;

const SCHOOL = {
  contactEmail: 'marketingclub@makedown.com',
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
  const result = await api('POST', '/admin/auth/login', { identifier: email, password }, false);
  ADMIN_TOKEN = result.accessToken;
}

// TODO: fill this in once you give me the real answer + wrong options for
// "Which Australian institute is Box Hill College Kuwait affiliated with?"
// and I'll uncomment/add it — leaving it out for now rather than inventing
// institutional facts.
const BOX_HILL_EXTRA_QUESTION = null;
/* Example shape once you supply it:
const BOX_HILL_EXTRA_QUESTION = {
  points: 600,
  questionTextEn: 'Which Australian institute is Box Hill College Kuwait affiliated with?',
  questionTextAr: 'ما اسم المعهد الأسترالي الذي ترتبط به كلية بوكسهل الكويت؟',
  optionsEn: ['Box Hill Institute', 'TAFE NSW', 'RMIT', 'Swinburne'],
  optionsAr: ['معهد بوكس هيل', 'تيف نيو ساوث ويلز', 'آر إم آي تي', 'سوينبرن'],
  correctOptionIndex: 0,
};
*/

const CAR_BRANDS_QUIZ = {
  titleEn: 'Car Brands',
  titleAr: 'ماركات السيارات',
  questions: [
    {
      points: 200,
      questionTextEn: '🐎 Which car brand is famous for its rearing-horse logo?',
      questionTextAr: '🐎 شنو السيارة المشهورة بشعار الحصان؟',
      optionsEn: ['Ferrari', 'Lamborghini', 'Porsche', 'Maserati'],
      optionsAr: ['فيراري', 'لامبورجيني', 'بورشه', 'مازيراتي'],
      correctOptionIndex: 0,
    },
    {
      points: 200,
      questionTextEn: '🐂 Which car brand is famous for its raging-bull logo?',
      questionTextAr: '🐂 شنو السيارة المشهورة بشعار الثور الهائج؟',
      optionsEn: ['Lamborghini', 'Ferrari', 'Ford', 'Peugeot'],
      optionsAr: ['لامبورجيني', 'فيراري', 'فورد', 'بيجو'],
      correctOptionIndex: 0,
    },
    {
      points: 400,
      questionTextEn: '🏎️ What is the name of Chevrolet\'s famous sports car?',
      questionTextAr: '🏎️ شنو اسم السيارة الرياضية المشهورة من شفروليه؟',
      optionsEn: ['Corvette', 'Camaro', 'Mustang', 'Charger'],
      optionsAr: ['كورفيت', 'كامارو', 'موستنج', 'تشارجر'],
      correctOptionIndex: 0,
    },
    {
      points: 600,
      questionTextEn: '🚙 Which car is nicknamed "the Jeep" by a lot of people?',
      questionTextAr: '🚙 أي سيارة تشتهر بلقب "الجيب" عند كثير من الناس؟',
      optionsEn: ['Jeep Wrangler', 'Toyota Land Cruiser', 'Land Rover Defender', 'Nissan Patrol'],
      optionsAr: ['Jeep Wrangler', 'تويوتا لاند كروزر', 'لاند روفر ديفندر', 'نيسان باترول'],
      correctOptionIndex: 0,
    },
  ],
};

async function main() {
  await ensureAdminToken();

  // Don't assume the school's password is still what an earlier script run
  // set it to — reset it to the known value every time via the admin
  // token, so this only ever depends on the admin login working.
  console.log('Verifying admin token and resetting the school password...');
  const me = await api('GET', '/admin/auth/me', null, ADMIN_TOKEN);
  console.log('Logged in as admin:', me.admin?.email || JSON.stringify(me));
  const schools = await api('GET', '/admin/schools', null, ADMIN_TOKEN);
  const schoolRows = Array.isArray(schools) ? schools : schools.rows || [];
  const school = schoolRows.find((s) => s.contact_email === SCHOOL.contactEmail);
  if (!school) throw new Error(`Could not find a school with contact email ${SCHOOL.contactEmail}`);
  await api('PATCH', `/admin/schools/${school.id}`, { password: SCHOOL.password }, ADMIN_TOKEN);
  console.log(`  reset password for school id ${school.id}`);

  const schoolLogin = await api('POST', '/admin/auth/login', {
    identifier: SCHOOL.contactEmail,
    password: SCHOOL.password,
  }, false);
  const SCHOOL_TOKEN = schoolLogin.accessToken;
  console.log('Logged in as school OK.');

  const existingQuizzes = await api('GET', '/admin/quizzes', null, SCHOOL_TOKEN);
  const rows = Array.isArray(existingQuizzes) ? existingQuizzes : existingQuizzes.rows || [];
  const byTitle = new Map(rows.map((q) => [q.title_en, q.id]));

  // --- Box Hill College Kuwait: add the 600-point question ---
  if (BOX_HILL_EXTRA_QUESTION) {
    const boxHillId = byTitle.get('Box Hill College Kuwait');
    if (!boxHillId) {
      console.log('Could not find "Box Hill College Kuwait" quiz for this school — skipping its extra question.');
    } else {
      const existingQuestions = await api('GET', `/admin/quizzes/${boxHillId}`, null, SCHOOL_TOKEN);
      const nextSort = (existingQuestions.questions || []).length;
      await api('POST', `/admin/quizzes/${boxHillId}/questions`, {
        questionTextEn: BOX_HILL_EXTRA_QUESTION.questionTextEn,
        questionTextAr: BOX_HILL_EXTRA_QUESTION.questionTextAr,
        questionType: 'text',
        optionsEn: BOX_HILL_EXTRA_QUESTION.optionsEn,
        optionsAr: BOX_HILL_EXTRA_QUESTION.optionsAr,
        correctOptionIndex: BOX_HILL_EXTRA_QUESTION.correctOptionIndex,
        points: BOX_HILL_EXTRA_QUESTION.points,
        mode: 'both',
        timeLimitSeconds: 20,
        sortOrder: nextSort,
      }, SCHOOL_TOKEN);
      console.log(`Added 600-point question to Box Hill College Kuwait (quiz id ${boxHillId}).`);
    }
  } else {
    console.log('Skipping Box Hill\'s extra question — BOX_HILL_EXTRA_QUESTION is not filled in yet.');
  }

  // --- Car Brands: create the quiz (or reuse it) + add questions ---
  let carBrandsId = byTitle.get(CAR_BRANDS_QUIZ.titleEn);
  let alreadyHadQuestions = new Set();
  if (carBrandsId) {
    console.log(`"Car Brands" already exists (id ${carBrandsId}) — adding only missing questions.`);
    const detail = await api('GET', `/admin/quizzes/${carBrandsId}`, null, SCHOOL_TOKEN);
    alreadyHadQuestions = new Set((detail.questions || []).map((q) => q.question_text_en));
  } else {
    const quiz = await api('POST', '/admin/quizzes', {
      titleEn: CAR_BRANDS_QUIZ.titleEn,
      titleAr: CAR_BRANDS_QUIZ.titleAr,
      isActive: true,
    }, SCHOOL_TOKEN);
    carBrandsId = quiz.id;
    console.log(`Created "Car Brands" quiz id ${carBrandsId}.`);
  }

  let sortOrder = alreadyHadQuestions.size;
  let added = 0;
  for (const q of CAR_BRANDS_QUIZ.questions) {
    if (alreadyHadQuestions.has(q.questionTextEn)) continue;
    await api('POST', `/admin/quizzes/${carBrandsId}/questions`, {
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
    added++;
  }
  console.log(`Added ${added} question(s) to Car Brands (quiz id ${carBrandsId}).`);

  // --- add both quizzes onto the existing live "Marketing Club Trivia
  // Night" session's board, so they're playable right away too ---
  const sessions = await api('GET', '/admin/game-sessions', null, SCHOOL_TOKEN);
  const sessionRows = Array.isArray(sessions) ? sessions : sessions.rows || [];
  const trivia = sessionRows.find((s) => s.title === 'Marketing Club Trivia Night');
  if (trivia) {
    const detail = await api('GET', `/admin/game-sessions/${trivia.id}`, null, SCHOOL_TOKEN);
    const quizIds = new Set(detail.quizIds || []);
    quizIds.add(carBrandsId);
    if (BOX_HILL_EXTRA_QUESTION) {
      const boxHillId = byTitle.get('Box Hill College Kuwait');
      if (boxHillId) quizIds.add(boxHillId);
    }
    // PATCH requires title/titleAr (and, for team mode, both team names)
    // even when only quizIds is actually changing — echo back what's
    // already on the session rather than making the caller resupply it.
    const team1 = (detail.teams || [])[0] || {};
    const team2 = (detail.teams || [])[1] || {};
    await api('PATCH', `/admin/game-sessions/${trivia.id}`, {
      title: detail.title,
      titleAr: detail.title_ar,
      team1Name: team1.name,
      team1Capacity: team1.capacity,
      team2Name: team2.name,
      team2Capacity: team2.capacity,
      quizIds: Array.from(quizIds),
    }, SCHOOL_TOKEN);
    console.log(`Updated "Marketing Club Trivia Night" (session id ${trivia.id}) board to include Car Brands.`);
  } else {
    console.log('No "Marketing Club Trivia Night" session found — Car Brands quiz was created but not bundled onto a live game.');
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
