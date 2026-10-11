const BASE = 'https://back.makedown.online/api/v1';

// Either set MD_ADMIN_TOKEN directly, or set ADMIN_EMAIL + ADMIN_PASSWORD
// and this script logs in for you.
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

// --- Category -------------------------------------------------------------
// Source: 3 "Make Carnival" PDF quiz packs the client sent for import.
// Points were capped at 4 tiers (200/400/600/800) in the PDFs, but this
// API only accepts 200/400/600 (anything else silently becomes 200) — so
// every 800-point "hard" question below has been remapped to 600, per the
// user's explicit choice (not a guess).
const CATEGORY = { nameEn: 'Make Carnival', nameAr: 'ميك كارنفال' };

// --- Quizzes ----------------------------------------------------------------
const QUIZZES = [
  {
    titleEn: 'Guess the Country',
    titleAr: 'خمّن الدولة',
    descriptionEn: "Flags and famous landmarks from around the world — 16 questions in two rounds.",
    descriptionAr: 'أعلام ومعالم شهيرة حول العالم - ١٦ سؤالاً على جولتين.',
    difficulty: 'medium',
    questions: [
      { points: 200, questionTextEn: 'Which country does this flag belong to?', questionTextAr: 'لأي دولة ينتمي هذا العلم؟', optionsEn: ['China', 'Japan', 'South Korea', 'Vietnam'], optionsAr: ['الصين', 'اليابان', 'كوريا الجنوبية', 'فيتنام'], correctOptionIndex: 1 },
      { points: 200, questionTextEn: 'Which country does this flag belong to?', questionTextAr: 'لأي دولة ينتمي هذا العلم؟', optionsEn: ['UAE', 'Jordan', 'Kuwait', 'Palestine'], optionsAr: ['الإمارات', 'الأردن', 'الكويت', 'فلسطين'], correctOptionIndex: 2 },
      { points: 400, questionTextEn: 'Which country does this flag belong to?', questionTextAr: 'لأي دولة ينتمي هذا العلم؟', optionsEn: ['Ireland', 'Mexico', 'Italy', 'Hungary'], optionsAr: ['أيرلندا', 'المكسيك', 'إيطاليا', 'المجر'], correctOptionIndex: 2 },
      { points: 400, questionTextEn: 'Which country does this flag belong to?', questionTextAr: 'لأي دولة ينتمي هذا العلم؟', optionsEn: ['Tunisia', 'Turkey', 'Pakistan', 'Algeria'], optionsAr: ['تونس', 'تركيا', 'باكستان', 'الجزائر'], correctOptionIndex: 1 },
      { points: 600, questionTextEn: 'Which country does this flag belong to?', questionTextAr: 'لأي دولة ينتمي هذا العلم؟', optionsEn: ['Norway', 'Finland', 'Sweden', 'Denmark'], optionsAr: ['النرويج', 'فنلندا', 'السويد', 'الدنمارك'], correctOptionIndex: 2 },
      { points: 600, questionTextEn: 'Which country does this flag belong to?', questionTextAr: 'لأي دولة ينتمي هذا العلم؟', optionsEn: ['Japan', 'Bangladesh', 'Palau', 'Pakistan'], optionsAr: ['اليابان', 'بنغلاديش', 'بالاو', 'باكستان'], correctOptionIndex: 1 },
      { points: 600, questionTextEn: 'Which country does this flag belong to?', questionTextAr: 'لأي دولة ينتمي هذا العلم؟', optionsEn: ['Qatar', 'Bahrain', 'Peru', 'Austria'], optionsAr: ['قطر', 'البحرين', 'بيرو', 'النمسا'], correctOptionIndex: 1 },
      { points: 600, questionTextEn: 'Which country does this flag belong to?', questionTextAr: 'لأي دولة ينتمي هذا العلم؟', optionsEn: ['Ivory Coast', 'Ireland', 'Italy', 'India'], optionsAr: ['ساحل العاج', 'أيرلندا', 'إيطاليا', 'الهند'], correctOptionIndex: 1 },
      { points: 200, questionTextEn: 'Which country is home to this famous tower?', questionTextAr: 'أي دولة تحتضن هذا البرج الشهير؟', optionsEn: ['Italy', 'France', 'Spain', 'UK'], optionsAr: ['إيطاليا', 'فرنسا', 'إسبانيا', 'بريطانيا'], correctOptionIndex: 1 },
      { points: 200, questionTextEn: 'Which country is home to these pyramids?', questionTextAr: 'أي دولة تحتضن هذه الأهرامات؟', optionsEn: ['Egypt', 'Mexico', 'Sudan', 'Morocco'], optionsAr: ['مصر', 'المكسيك', 'السودان', 'المغرب'], correctOptionIndex: 0 },
      { points: 400, questionTextEn: 'Kangaroos and koalas live in the wild in which country?', questionTextAr: 'في أي دولة تعيش حيوانات الكنغر والكوالا في البرية؟', optionsEn: ['New Zealand', 'South Africa', 'Australia', 'Brazil'], optionsAr: ['نيوزيلندا', 'جنوب أفريقيا', 'أستراليا', 'البرازيل'], correctOptionIndex: 2 },
      { points: 400, questionTextEn: 'In which country is the Taj Mahal?', questionTextAr: 'في أي دولة يقع تاج محل؟', optionsEn: ['Pakistan', 'India', 'Iran', 'Turkey'], optionsAr: ['باكستان', 'الهند', 'إيران', 'تركيا'], correctOptionIndex: 1 },
      { points: 600, questionTextEn: 'Machu Picchu is in which country?', questionTextAr: 'في أي دولة تقع ماتشو بيتشو؟', optionsEn: ['Peru', 'Chile', 'Bolivia', 'Colombia'], optionsAr: ['بيرو', 'تشيلي', 'بوليفيا', 'كولومبيا'], correctOptionIndex: 0 },
      { points: 600, questionTextEn: 'Ottawa is the capital of which country?', questionTextAr: 'أوتاوا هي عاصمة أي دولة؟', optionsEn: ['USA', 'Canada', 'Australia', 'New Zealand'], optionsAr: ['الولايات المتحدة', 'كندا', 'أستراليا', 'نيوزيلندا'], correctOptionIndex: 1 },
      { points: 600, questionTextEn: 'The ancient city of Petra is in which country?', questionTextAr: 'مدينة البتراء الأثرية تقع في أي دولة؟', optionsEn: ['Saudi Arabia', 'Jordan', 'Egypt', 'Lebanon'], optionsAr: ['السعودية', 'الأردن', 'مصر', 'لبنان'], correctOptionIndex: 1 },
      { points: 600, questionTextEn: 'Volcanoes, glaciers, the Northern Lights and the Blue Lagoon. Which country?', questionTextAr: 'براكين، أنهار جليدية، الأضواء الشمالية، والبحيرة الزرقاء. أي دولة؟', optionsEn: ['Norway', 'Greenland', 'Iceland', 'Finland'], optionsAr: ['النرويج', 'غرينلاند', 'آيسلندا', 'فنلندا'], correctOptionIndex: 2 },
    ],
  },
  {
    titleEn: 'Kuwait Food Challenge',
    titleAr: 'تحدي الأكل الكويتي',
    descriptionEn: "Kuwaiti dishes and Kuwait's most famous restaurants — 16 questions in two rounds.",
    descriptionAr: 'أكلات كويتية وأشهر مطاعم الكويت - ١٦ سؤالاً على جولتين.',
    difficulty: 'medium',
    questions: [
      { points: 200, questionTextEn: "Kuwait's famous spiced rice dish with chicken or meat is called…", questionTextAr: 'طبق الأرز المتبّل الشهير في الكويت مع الدجاج أو اللحم يُسمى…', optionsEn: ['Machboos', 'Biryani', 'Kabsa', 'Mansaf'], optionsAr: ['مجبوس', 'برياني', 'كبسة', 'منسف'], correctOptionIndex: 0 },
      { points: 200, questionTextEn: 'Which Kuwaiti breakfast is sweet vermicelli with an omelette on top?', questionTextAr: 'أي فطور كويتي يتكون من شعيرية حلوة مع عجة فوقها؟', optionsEn: ['Balaleet', 'Harees', 'Jireesh', 'Gers Ogaily'], optionsAr: ['بلاليط', 'هريس', 'جريش', 'قرص عقيلي'], correctOptionIndex: 0 },
      { points: 400, questionTextEn: 'What is Gers Ogaily?', questionTextAr: 'ما هو قرص عقيلي؟', optionsEn: ['A soup', 'A cake', 'A drink', 'A rice dish'], optionsAr: ['شوربة', 'كيكة', 'مشروب', 'طبق أرز'], correctOptionIndex: 1 },
      { points: 400, questionTextEn: 'Harees is mainly made from which two ingredients?', questionTextAr: 'من أي مكوّنين رئيسيين يُصنع الهريس؟', optionsEn: ['Rice and fish', 'Wheat and meat', 'Lentils and bread', 'Dates and milk'], optionsAr: ['أرز وسمك', 'قمح ولحم', 'عدس وخبز', 'تمر وحليب'], correctOptionIndex: 1 },
      { points: 600, questionTextEn: 'In Mutabbaq Zubaidi, what is "Zubaidi"?', questionTextAr: 'في طبق مطبق زبيدي، ما هو "الزبيدي"؟', optionsEn: ['A spice', 'A fish', 'A rice type', 'A bread'], optionsAr: ['بهار', 'سمك', 'نوع أرز', 'خبز'], correctOptionIndex: 1 },
      { points: 600, questionTextEn: 'What is Daqoos?', questionTextAr: 'ما هو الدقوس؟', optionsEn: ['A tomato sauce', 'A sweet', 'A bread', 'A coffee'], optionsAr: ['صلصة طماطم', 'حلى', 'خبز', 'قهوة'], correctOptionIndex: 0 },
      { points: 600, questionTextEn: 'What is "loomi" in Kuwaiti cooking?', questionTextAr: 'ما هو "اللومي" في الطبخ الكويتي؟', optionsEn: ['Dried black lime', 'Black pepper', 'Burnt onion', 'Dried date'], optionsAr: ['ليمون أسود مجفف', 'فلفل أسود', 'بصل محروق', 'تمر مجفف'], correctOptionIndex: 0 },
      { points: 600, questionTextEn: 'On which night do kids in Kuwait go door to door collecting sweets?', questionTextAr: 'في أي ليلة يطوف الأطفال في الكويت على المنازل لجمع الحلويات؟', optionsEn: ['Eid night', 'Gergean', 'National Day', 'New Year'], optionsAr: ['ليلة العيد', 'قرقيعان', 'اليوم الوطني', 'رأس السنة'], correctOptionIndex: 1 },
      { points: 200, questionTextEn: 'Mais Alghanim on Gulf Road is next to which landmark?', questionTextAr: 'مطعم ميس الغانم على شارع الخليج يقع بجانب أي معلم؟', optionsEn: ['Liberation Tower', 'Kuwait Towers', 'The Avenues', 'Souq Mubarakiya'], optionsAr: ['برج التحرير', 'أبراج الكويت', 'الأفنيوز', 'سوق المباركية'], correctOptionIndex: 1 },
      { points: 200, questionTextEn: 'Slider Station is famous for serving mini burgers on a…', questionTextAr: 'مطعم سلايدر ستيشن مشهور بتقديم البرغر الصغير على…', optionsEn: ['Train', 'Conveyor belt', 'Rooftop', 'Boat'], optionsAr: ['قطار', 'سير ناقل', 'سطح المبنى', 'قارب'], correctOptionIndex: 1 },
      { points: 400, questionTextEn: 'Freej Swaileh is known for which kind of food?', questionTextAr: 'فريج صويلح معروف بأي نوع من الأكل؟', optionsEn: ['Italian', 'Traditional Kuwaiti', 'Japanese', 'Mexican'], optionsAr: ['إيطالي', 'كويتي تقليدي', 'ياباني', 'مكسيكي'], correctOptionIndex: 1 },
      { points: 400, questionTextEn: 'Which dessert is a favorite at Mais Alghanim?', questionTextAr: 'أي حلى هو المفضل في ميس الغانم؟', optionsEn: ['Umm Ali', 'Tiramisu', 'Cheesecake', 'Brownies'], optionsAr: ['أم علي', 'تيراميسو', 'تشيز كيك', 'براوني'], correctOptionIndex: 0 },
      { points: 600, questionTextEn: 'Freej Swaileh opened a branch in which area of London?', questionTextAr: 'فريج صويلح افتتح فرعاً في أي منطقة من لندن؟', optionsEn: ['Soho', 'Knightsbridge', 'Camden', 'Brixton'], optionsAr: ['سوهو', 'نايتسبريدج', 'كامدن', 'بريكستون'], correctOptionIndex: 1 },
      { points: 600, questionTextEn: 'Who founded Slider Station and Burger Boutique?', questionTextAr: 'من أسس سلايدر ستيشن وبرغر بوتيك؟', optionsEn: ['Basil Al Salem', 'Jarrah Al Buloushi', 'Ali Al Ebrahim', 'Sheikh Majed Al-Sabah'], optionsAr: ['باسل السالم', 'جراح البلوشي', 'علي الإبراهيم', 'الشيخ ماجد الصباح'], correctOptionIndex: 0 },
      { points: 600, questionTextEn: 'In what year did Mais Alghanim open?', questionTextAr: 'في أي عام افتتح مطعم ميس الغانم؟', optionsEn: ['1953', '1975', '1990', '2005'], optionsAr: ['1953', '1975', '1990', '2005'], correctOptionIndex: 0 },
      { points: 600, questionTextEn: "Kuwait's Kout Food Group has run which global brand in Kuwait since 1997?", questionTextAr: 'مجموعة كوت الكويتية للأغذية تدير أي علامة عالمية في الكويت منذ عام 1997؟', optionsEn: ["McDonald's", 'Burger King', 'KFC', 'Starbucks'], optionsAr: ['ماكدونالدز', 'برجر كنج', 'كنتاكي', 'ستاربكس'], correctOptionIndex: 1 },
    ],
  },
  {
    titleEn: 'Makeup Challenge',
    titleAr: 'تحدي المكياج',
    descriptionEn: 'Makeup basics and the stories behind famous beauty brands — 16 questions in two rounds.',
    descriptionAr: 'أساسيات المكياج وقصص أشهر ماركات التجميل - ١٦ سؤالاً على جولتين.',
    difficulty: 'medium',
    questions: [
      { points: 200, questionTextEn: 'What is this egg-shaped sponge used for?', questionTextAr: 'ما استخدام هذه الإسفنجة بيضاوية الشكل؟', optionsEn: ['Blending foundation', 'Washing dishes', 'Painting nails', 'Cleaning brushes'], optionsAr: ['توزيع كريم الأساس', 'غسل الصحون', 'طلاء الأظافر', 'تنظيف الفرش'], correctOptionIndex: 0 },
      { points: 200, questionTextEn: 'Where do you put this product?', questionTextAr: 'أين يُستخدم هذا المنتج؟', optionsEn: ['Lips', 'Eyelashes', 'Nails', 'Cheeks'], optionsAr: ['الشفاه', 'الرموش', 'الأظافر', 'الخدود'], correctOptionIndex: 1 },
      { points: 400, questionTextEn: 'What does a primer do?', questionTextAr: 'ما وظيفة البرايمر؟', optionsEn: ['Removes makeup', 'Helps makeup last longer', 'Adds color to lips', 'Curls lashes'], optionsAr: ['يزيل المكياج', 'يساعد المكياج على الثبات لفترة أطول', 'يضيف لوناً للشفاه', 'يجعّد الرموش'], correctOptionIndex: 1 },
      { points: 400, questionTextEn: 'Which product adds glow to the high points of your face?', questionTextAr: 'أي منتج يضيف توهجاً للنقاط البارزة في الوجه؟', optionsEn: ['Highlighter', 'Concealer', 'Eyeliner', 'Lip liner'], optionsAr: ['الهايلايتر', 'الكونسيلر', 'الآيلاينر', 'محدد الشفاه'], correctOptionIndex: 0 },
      { points: 600, questionTextEn: 'What does SPF stand for?', questionTextAr: 'ماذا يعني اختصار SPF؟', optionsEn: ['Super Pink Finish', 'Sun Protection Factor', 'Skin Perfect Formula', 'Soft Powder Foundation'], optionsAr: ['سوبر بينك فينيش', 'عامل الحماية من الشمس', 'تركيبة البشرة المثالية', 'كريم أساس بودرة ناعمة'], correctOptionIndex: 1 },
      { points: 600, questionTextEn: 'What is contour used for?', questionTextAr: 'ما استخدام الكونتور؟', optionsEn: ['Adding shadows to shape the face', 'Covering pimples', 'Coloring eyebrows', 'Removing shine'], optionsAr: ['إضافة ظلال لتحديد ملامح الوجه', 'تغطية البثور', 'تلوين الحواجب', 'إزالة اللمعان'], correctOptionIndex: 0 },
      { points: 600, questionTextEn: '"Glazed donut skin" was made famous by which celebrity?', questionTextAr: 'من هي المشهورة التي اشتهرت بإطلالة "بشرة الدونات اللامعة"؟', optionsEn: ['Kylie Jenner', 'Hailey Bieber', 'Selena Gomez', 'Rihanna'], optionsAr: ['كايلي جينر', 'هيلي بيبر', 'سيلينا غوميز', 'ريهانا'], correctOptionIndex: 1 },
      { points: 600, questionTextEn: 'Which color corrector cancels out blue or purple dark circles?', questionTextAr: 'أي مصحح لوني يُخفي الهالات السوداء الزرقاء أو البنفسجية؟', optionsEn: ['Green', 'Peach', 'Lavender', 'Yellow'], optionsAr: ['أخضر', 'خوخي', 'بنفسجي فاتح', 'أصفر'], correctOptionIndex: 1 },
      { points: 200, questionTextEn: 'Who founded Rare Beauty?', questionTextAr: 'من أسست علامة Rare Beauty؟', optionsEn: ['Selena Gomez', 'Rihanna', 'Kylie Jenner', 'Hailey Bieber'], optionsAr: ['سيلينا غوميز', 'ريهانا', 'كايلي جينر', 'هيلي بيبر'], correctOptionIndex: 0 },
      { points: 200, questionTextEn: 'Huda Beauty was started in which city?', questionTextAr: 'في أي مدينة تأسست Huda Beauty؟', optionsEn: ['London', 'Paris', 'Dubai', 'Kuwait City'], optionsAr: ['لندن', 'باريس', 'دبي', 'مدينة الكويت'], correctOptionIndex: 2 },
      { points: 400, questionTextEn: 'Which singer founded Fenty Beauty?', questionTextAr: 'أي مغنية أسست Fenty Beauty؟', optionsEn: ['Beyoncé', 'Rihanna', 'Ariana Grande', 'Lady Gaga'], optionsAr: ['بيونسيه', 'ريهانا', 'أريانا غراندي', 'ليدي غاغا'], correctOptionIndex: 1 },
      { points: 400, questionTextEn: 'What does the brand name e.l.f. stand for?', questionTextAr: 'ماذا يعني اسم العلامة التجارية e.l.f.؟', optionsEn: ['Every Lovely Face', 'Eyes Lips Face', 'Easy Look Fast', 'Extra Light Formula'], optionsAr: ['كل وجه جميل', 'عيون شفاه وجه', 'إطلالة سهلة وسريعة', 'تركيبة خفيفة إضافية'], correctOptionIndex: 1 },
      { points: 600, questionTextEn: 'How many foundation shades did Fenty Beauty launch with?', questionTextAr: 'بكم درجة لون أطلقت Fenty Beauty كريم الأساس الخاص بها؟', optionsEn: ['12', '25', '40', '100'], optionsAr: ['12', '25', '40', '100'], correctOptionIndex: 2 },
      { points: 600, questionTextEn: 'Which brand is famous for its "Pillow Talk" lipstick?', questionTextAr: 'أي علامة تجارية مشهورة بأحمر شفاه "Pillow Talk"؟', optionsEn: ['MAC', 'Charlotte Tilbury', 'NARS', 'Dior'], optionsAr: ['ماك', 'شارلوت تيلبري', 'نارس', 'ديور'], correctOptionIndex: 1 },
      { points: 600, questionTextEn: "What was Huda Beauty's first product?", questionTextAr: 'ما كان أول منتج أطلقته Huda Beauty؟', optionsEn: ['Lipstick', 'False lashes', 'Foundation', 'Perfume'], optionsAr: ['أحمر شفاه', 'رموش صناعية', 'كريم أساس', 'عطر'], correctOptionIndex: 1 },
      { points: 600, questionTextEn: "Which company bought Hailey Bieber's brand Rhode in 2025?", questionTextAr: 'أي شركة اشترت علامة Rhode الخاصة بهيلي بيبر عام 2025؟', optionsEn: ["L'Oréal", 'e.l.f. Beauty', 'Estée Lauder', 'Sephora'], optionsAr: ['لوريال', 'e.l.f. Beauty', 'إستي لودر', 'سيفورا'], correctOptionIndex: 1 },
    ],
  },
];

async function ensureCategory() {
  console.log(`\nLooking for existing "${CATEGORY.nameEn}" category...`);
  const existing = await api('GET', `/admin/game-categories?search=${encodeURIComponent(CATEGORY.nameEn)}&pageSize=50`);
  const match = (existing.rows || []).find((c) => c.name_en === CATEGORY.nameEn);
  if (match) {
    console.log(`  found existing category id ${match.id} — reusing it.`);
    return match.id;
  }
  console.log('  not found, creating it...');
  const created = await api('POST', '/admin/game-categories', { nameEn: CATEGORY.nameEn, nameAr: CATEGORY.nameAr, isActive: true });
  console.log(`  created category id ${created.id}`);
  return created.id;
}

async function main() {
  await ensureToken();
  console.log('Verifying token...');
  const me = await api('GET', '/admin/auth/me');
  console.log('Logged in as:', me.admin?.email || me.school?.email || JSON.stringify(me));

  const categoryId = await ensureCategory();

  for (const quizDef of QUIZZES) {
    console.log(`\nCreating quiz "${quizDef.titleEn}"...`);
    const quiz = await api('POST', '/admin/quizzes', {
      titleEn: quizDef.titleEn,
      titleAr: quizDef.titleAr,
      descriptionEn: quizDef.descriptionEn,
      descriptionAr: quizDef.descriptionAr,
      categoryId,
      difficulty: quizDef.difficulty,
      isActive: true,
    });
    console.log(`  created quiz id ${quiz.id}`);

    console.log(`  adding ${quizDef.questions.length} questions...`);
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
      });
    }
    console.log(`  done — quiz ${quiz.id} ("${quizDef.titleEn}") now has ${quizDef.questions.length} questions.`);
  }

  console.log('\nAll done.');
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
