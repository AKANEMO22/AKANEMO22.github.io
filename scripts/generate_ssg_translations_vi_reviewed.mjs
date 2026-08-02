import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const outputPath = path.join(
  projectRoot,
  "data",
  "ssg",
  "audit",
  "translations-vi-reviewed.json",
);

async function json(relativePath, { optional = false } = {}) {
  try {
    return JSON.parse(await readFile(path.join(projectRoot, relativePath), "utf8"));
  } catch (error) {
    if (optional && error?.code === "ENOENT") return null;
    throw error;
  }
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function key(value) {
  return clean(value)
    .replace(/[“”"']/g, "")
    .replace(/[.!?:;]+$/g, "")
    .toLocaleLowerCase("en");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

const GLOSSARY = [
  { domain: "Tuckman", en: "Forming", vi: "Hình thành", aliases: ["forming"] },
  { domain: "Tuckman", en: "Storming", vi: "Xung đột", aliases: ["storming"] },
  { domain: "Tuckman", en: "Norming", vi: "Ổn định – chuẩn hóa", aliases: ["norming"] },
  { domain: "Tuckman", en: "Performing", vi: "Thực hiện hiệu quả", aliases: ["performing"] },
  { domain: "Tuckman", en: "Adjourning", vi: "Kết thúc", aliases: ["adjourning", "adjouming"] },
  { domain: "Bloom", en: "Remembering", vi: "Ghi nhớ", aliases: ["remember", "remembering"] },
  { domain: "Bloom", en: "Understanding", vi: "Hiểu", aliases: ["understand", "understanding"] },
  { domain: "Bloom", en: "Applying", vi: "Vận dụng", aliases: ["apply", "applying"] },
  { domain: "Bloom", en: "Analyzing", vi: "Phân tích", aliases: ["analyze", "analyzing"] },
  { domain: "Bloom", en: "Evaluating", vi: "Đánh giá", aliases: ["evaluate", "evaluating"] },
  { domain: "Bloom", en: "Creating", vi: "Sáng tạo", aliases: ["create", "creating"] },
  { domain: "Xung đột", en: "Avoiding", vi: "Tránh né", aliases: ["avoiding", "avoidance"] },
  { domain: "Xung đột", en: "Accommodating", vi: "Nhường nhịn", aliases: ["accommodating"] },
  { domain: "Xung đột", en: "Competing", vi: "Cạnh tranh", aliases: ["competing"] },
  { domain: "Xung đột", en: "Compromising", vi: "Thỏa hiệp", aliases: ["compromising"] },
  { domain: "Xung đột", en: "Collaborating", vi: "Hợp tác giải quyết", aliases: ["collaborating"] },
  { domain: "Quyền lực", en: "Coercive power", vi: "Quyền lực cưỡng chế", aliases: ["coercive power"] },
  { domain: "Quyền lực", en: "Legitimate power", vi: "Quyền lực chính danh", aliases: ["legitimate power"] },
  { domain: "Quyền lực", en: "Reward power", vi: "Quyền lực khen thưởng", aliases: ["reward power"] },
  { domain: "Quyền lực", en: "Expert power", vi: "Quyền lực chuyên môn", aliases: ["expert power"] },
  { domain: "Quyền lực", en: "Referent power", vi: "Quyền lực tham chiếu", aliases: ["referent power"] },
  { domain: "Tư duy", en: "Critical thinking", vi: "Tư duy phản biện", aliases: ["critical thinking"] },
  { domain: "Tư duy", en: "Creative thinking", vi: "Tư duy sáng tạo", aliases: ["creative thinking"] },
  { domain: "Giao tiếp", en: "Nonverbal communication", vi: "Giao tiếp phi ngôn ngữ", aliases: ["nonverbal communication"] },
  { domain: "Giao tiếp", en: "Paralanguage", vi: "Ngôn ngữ phụ (đặc điểm giọng nói)", aliases: ["paralanguage"] },
  { domain: "Giao tiếp", en: "Kinesics", vi: "Cử động học (ngôn ngữ cơ thể)", aliases: ["kinesics"] },
  { domain: "Giao tiếp", en: "Proxemics", vi: "Không gian học (khoảng cách giao tiếp)", aliases: ["proxemics"] },
  { domain: "Giao tiếp", en: "Haptics", vi: "Giao tiếp xúc giác", aliases: ["haptics"] },
  { domain: "Giao tiếp", en: "Chronemics", vi: "Cách sử dụng thời gian trong giao tiếp", aliases: ["chronemics"] },
  { domain: "Học thuật", en: "Plagiarism", vi: "Đạo văn", aliases: ["plagiarism"] },
  { domain: "Học thuật", en: "Compare–contrast", vi: "So sánh – đối chiếu", aliases: ["compare-contrast", "compare–contrast"] },
  { domain: "Học thuật", en: "Chronological order", vi: "Trình tự thời gian", aliases: ["chronological order"] },
  { domain: "Học thuật", en: "Problem–solution", vi: "Vấn đề – giải pháp", aliases: ["problem-solution", "problem–solution"] },
  { domain: "Cuộc họp", en: "Minutes", vi: "Biên bản cuộc họp", aliases: ["minutes", "meeting minutes"] },
  { domain: "Cuộc họp", en: "Agenda", vi: "Chương trình nghị sự", aliases: ["agenda"] },
  { domain: "Cuộc họp", en: "Ground rules", vi: "Quy tắc chung", aliases: ["ground rules"] },
  { domain: "Đội nhóm", en: "Psychological safety", vi: "An toàn tâm lý", aliases: ["psychological safety"] },
  { domain: "Đội nhóm", en: "Team cohesiveness", vi: "Sự gắn kết đội nhóm", aliases: ["team cohesiveness"] },
  { domain: "Đội nhóm", en: "Accountability", vi: "Trách nhiệm giải trình", aliases: ["accountability"] },
  { domain: "Thuyết phục", en: "Ethos", vi: "Ethos (uy tín của người nói)", aliases: ["ethos"] },
  { domain: "Thuyết phục", en: "Pathos", vi: "Pathos (khơi gợi cảm xúc)", aliases: ["pathos"] },
  { domain: "Thuyết phục", en: "Logos", vi: "Logos (lập luận logic)", aliases: ["logos"] },
];

const EXACT = new Map(
  [
    ["forming", "Hình thành"],
    ["storming", "Xung đột"],
    ["norming", "Ổn định – chuẩn hóa"],
    ["performing", "Thực hiện hiệu quả"],
    ["adjourning", "Kết thúc"],
    ["adjouming", "Kết thúc"],
    ["remember", "Ghi nhớ"],
    ["remembering", "Ghi nhớ"],
    ["understand", "Hiểu"],
    ["understanding", "Hiểu"],
    ["apply", "Vận dụng"],
    ["applying", "Vận dụng"],
    ["analyze", "Phân tích"],
    ["analyzing", "Phân tích"],
    ["evaluate", "Đánh giá"],
    ["evaluating", "Đánh giá"],
    ["create", "Sáng tạo"],
    ["creating", "Sáng tạo"],
    ["avoiding", "Tránh né"],
    ["avoidance", "Sự tránh né"],
    ["accommodating", "Nhường nhịn"],
    ["competing", "Cạnh tranh"],
    ["compromising", "Thỏa hiệp"],
    ["collaborating", "Hợp tác giải quyết"],
    ["cooperative", "Hợp tác"],
    ["cooperative orientation", "Định hướng hợp tác"],
    ["competitive orientation", "Định hướng cạnh tranh"],
    ["accommodating orientation", "Định hướng nhường nhịn"],
    ["coercive power", "Quyền lực cưỡng chế"],
    ["legitimate power", "Quyền lực chính danh"],
    ["reward power", "Quyền lực khen thưởng"],
    ["expert power", "Quyền lực chuyên môn"],
    ["referent power", "Quyền lực tham chiếu"],
    ["discipline power", "Quyền lực kỷ luật"],
    ["power-over", "Quyền lực áp đặt"],
    ["power-with", "Quyền lực hợp tác"],
    ["power-from-within", "Nội lực"],
    ["power-from-outside", "Quyền lực từ bên ngoài"],
    ["low-power distance", "Khoảng cách quyền lực thấp"],
    ["high-power distance", "Khoảng cách quyền lực cao"],
    ["paralanguage", "Ngôn ngữ phụ (đặc điểm giọng nói)"],
    ["kinesics", "Cử động học (ngôn ngữ cơ thể)"],
    ["proxemics", "Không gian học (khoảng cách giao tiếp)"],
    ["haptics", "Giao tiếp xúc giác"],
    ["chronemics", "Cách sử dụng thời gian trong giao tiếp"],
    ["artifacts", "Vật dụng giao tiếp"],
    ["evaluative", "Phản hồi đánh giá"],
    ["interpretive", "Phản hồi diễn giải"],
    ["supportive", "Phản hồi hỗ trợ"],
    ["probing", "Phản hồi thăm dò"],
    ["compare-contrast", "So sánh – đối chiếu"],
    ["chronological order", "Trình tự thời gian"],
    ["problem-solution", "Vấn đề – giải pháp"],
    ["minutes", "Biên bản cuộc họp"],
    ["agenda", "Chương trình nghị sự"],
    ["a meeting minute", "Biên bản cuộc họp"],
    ["memo", "Bản ghi nhớ"],
    ["adaptation", "Sự thích ứng"],
    ["resistance", "Sự chống đối"],
    ["frustration", "Ức chế/bất mãn"],
    ["conceptualization", "Nhận thức/khái niệm hóa"],
    ["behavior", "Hành vi"],
    ["outcome", "Kết quả"],
    ["needs assessment", "Đánh giá nhu cầu"],
    ["delegation", "Sự ủy quyền"],
    ["chairperson", "Chủ tọa"],
    ["affective domain", "Lĩnh vực cảm xúc – thái độ"],
    ["cognitive domain", "Lĩnh vực nhận thức"],
    ["psychomotor domain", "Lĩnh vực tâm vận động"],
    ["inclusion safety", "An toàn hòa nhập"],
    ["learner safety", "An toàn học hỏi"],
    ["contributor safety", "An toàn đóng góp"],
    ["challenger safety", "An toàn thách thức"],
    ["ethos, pathos, and logos", "Ethos (uy tín), Pathos (cảm xúc) và Logos (lập luận logic)"],
    ["a shared mental representation of the task", "Mô hình nhận thức chung về nhiệm vụ"],
    ["comman knowledge effect", "Hiệu ứng thông tin chung"],
    ["common knowledge effect", "Hiệu ứng thông tin chung"],
    ["group unity", "Sự gắn kết của nhóm"],
    ["competition", "Sự cạnh tranh"],
    ["competition only", "Chỉ chú trọng cạnh tranh"],
    ["individual competition", "Cạnh tranh cá nhân"],
    ["competition amang group members", "Sự cạnh tranh giữa các thành viên nhóm"],
    ["drive", "Động lực"],
    ["dnve", "Động lực"],
    ["action-promoting close", "Phần kết thúc thúc đẩy hành động"],
    ["attention-getting opening", "Phần mở đầu thu hút sự chú ý"],
    ["all of them", "Tất cả các đáp án trên"],
    ["all of them are correct", "Tất cả các đáp án trên đều đúng"],
    ["all are correct", "Tất cả các đáp án trên đều đúng"],
    ["all above", "Tất cả các đáp án trên"],
    ["all of above", "Tất cả các đáp án trên"],
    ["none of them", "Không có đáp án nào ở trên"],
    ["none of these answers", "Không có đáp án nào ở trên"],
  ],
);

const QUESTION_OVERRIDES = new Map([
  ["SSG104-S018", "Giai đoạn nào phù hợp với phát biểu “Các thành viên thực hiện kế hoạch và đạt được mục tiêu”?"],
  ["SSG104-S078", "Những công nghệ nào giúp phát triển tư duy phản biện và tư duy sáng tạo ở mức Hiểu (Understanding) trong thang Bloom? (Chọn 2 đáp án)"],
  ["SSG104-S109", "Ethos (uy tín của người nói) đề cập đến yếu tố nào?"],
  ["SSG104-S325", "Trong thang Bloom, kỹ năng Vận dụng (Applying) được hiểu là gì?"],
  ["SSG104-S355", "Phát biểu nào sau đây KHÔNG ĐÚNG về so sánh xã hội?"],
  ["SSG105-S378", "Kiểu tổ chức nội dung nào phù hợp nhất để giải thích các bước của một quy trình kinh doanh?"],
  ["SSG105-S429", "Trong thuyết trình thuyết phục, Pathos (khơi gợi cảm xúc) là gì?"],
  ["SSG105-S443", "Ngôn ngữ phụ (paralanguage) là gì?"],
  ["SSG105-S457", "Chiến lược giữ thể diện (face-saving) trong quản lý xung đột là gì?"],
  ["SSG105-S495", "An toàn tâm lý (psychological safety) là gì?"],
  ["SSG105-S496", "Khi thành viên cảm thấy an toàn để tham gia học hỏi, họ đang ở cấp độ nào của an toàn tâm lý?"],
  ["SSG105-S502", "Những yếu tố then chốt nào tạo nên sự gắn kết đội nhóm?"],
]);

const OPTION_OVERRIDES = new Map([
  ["SSG104-S254", ["Bạn không thích viết báo cáo và bản ghi nhớ", null, null, null]],
  [
    "SSG104-S255",
    [
      "Dự án “Yêu bản thân” hỗ trợ sinh viên đại học tại Việt Nam bày tỏ suy nghĩ và cảm xúc, chăm sóc bản thân, chia sẻ, nhận diện và nhận hỗ trợ kịp thời cho các vấn đề tâm lý. Dự án hướng tới một môi trường thoải mái để sinh viên thực hành chánh niệm và chăm sóc sức khỏe thể chất lẫn tinh thần.",
      null,
      null,
      null,
    ],
  ],
  [
    "SSG104-S325",
    [
      "Khả năng nhận biết hoặc nhớ lại kiến thức đã học.",
      "Khả năng vận dụng tài liệu đã học vào những tình huống mới và cụ thể.",
      "Khả năng phán xét, kiểm tra và đánh giá giá trị của tài liệu cho một mục đích nhất định.",
      "Khả năng nắm bắt hoặc kiến tạo ý nghĩa từ thông điệp nói, viết và đồ họa.",
    ],
  ],
  [
    "SSG104-S355",
    [
      null,
      null,
      "So sánh xã hội là một xu hướng tâm lý tự nhiên.",
      null,
    ],
  ],
  ["SSG104-S367", [null, null, "Động lực", null]],
  [
    "SSG104-S373",
    [
      "Sự cạnh tranh giữa các thành viên nhóm.",
      "Năng lực của các thành viên nhóm.",
      "Sự gắn kết của nhóm.",
      "Mô hình nhận thức chung về nhiệm vụ.",
    ],
  ],
  ["SSG105-S446", [null, null, null, null, "Quá nhiều vật dụng hoặc yếu tố phụ trợ gây phân tán"]],
]);

function postEditOption(english, draft) {
  const exact = EXACT.get(key(english));
  if (exact) return { text: exact, source: "professional-glossary-exact", changed: exact !== clean(draft) };

  let text = clean(draft);
  if (/\bminutes\b/i.test(english)) text = text.replace(/\bphút\b/gi, "biên bản cuộc họp");
  if (/\bmemos?\b/i.test(english)) text = text.replace(/ghi nhớ/gi, "bản ghi nhớ");
  if (/\baccountability\b/i.test(english)) {
    text = text.replace(/trách nhiệm(?! giải trình)/gi, "trách nhiệm giải trình");
  }
  if (/\bteam(?:s|work)?\b/i.test(english) && !/\bgroup\b/i.test(english)) {
    text = text.replace(/\bnhóm\b/gi, "đội nhóm");
  }
  if (/\bground rules\b/i.test(english)) text = text.replace(/quy tắc cơ bản/gi, "quy tắc chung");
  if (/\bparalanguage\b/i.test(english)) text = text.replace(/ngôn ngữ song ngữ|ngôn ngữ(?! phụ)/gi, "ngôn ngữ phụ");
  if (/\bartifacts?\b/i.test(english)) text = text.replace(/hiện vật/gi, "vật dụng giao tiếp");
  if (/\bcoercive power\b/i.test(english)) text = text.replace(/sức mạnh cưỡng (?:bức|chế)/gi, "quyền lực cưỡng chế");
  if (/\bpower\b/i.test(english)) text = text.replace(/\bsức mạnh\b/gi, "quyền lực");

  return {
    text,
    source: text === clean(draft) ? "base-draft-context-reviewed" : "contextual-professional-postedit",
    changed: text !== clean(draft),
  };
}

function glossaryMatches(englishText) {
  const lower = englishText.toLocaleLowerCase("en");
  return GLOSSARY.filter((entry) => entry.aliases.some((alias) => lower.includes(alias))).map(
    (entry) => entry.en,
  );
}

const [questions, baseTranslations, notes104, notes105, liveNotes, ocrEnsemble, agentCorrections] =
  await Promise.all([
    json("data/ssg/questions.json"),
    json("data/ssg/translations-vi.json"),
    json("data/ssg104/source-notes.json"),
    json("data/ssg105/source-notes.json"),
    json("data/ssg/live-speaker-notes.json"),
    json("data/ssg/audit/ocr-ensemble-review.json"),
    json("data/ssg/audit/.translation-glossary-agent.json", { optional: true }),
  ]);

const baseById = new Map(baseTranslations.translations.map((record) => [record.id, record]));
const parsedNotesById = new Map(
  [...notes104.questions, ...notes105.questions].map((record) => [record.id, record]),
);
const liveNotesBySlide = new Map(liveNotes.slides.map((record) => [record.slide, record]));
const ensembleById = new Map(ocrEnsemble.records.map((record) => [record.id, record]));
const agentCorrectionById = new Map(
  (agentCorrections?.corrections ?? []).map((record) => [record.id, record]),
);

const translations = questions.map((question) => {
  const base = baseById.get(question.id);
  const parsedNotes = parsedNotesById.get(question.id);
  const live = liveNotesBySlide.get(question.sourceSlide);
  const ensemble = ensembleById.get(question.id);
  const agentCorrection = agentCorrectionById.get(question.id);
  const localOptionOverrides = OPTION_OVERRIDES.get(question.id);
  const notesQuestionVi = clean(parsedNotes?.questionVi);
  const baseQuestionVi = clean(base?.questionVi);
  let questionVi =
    (QUESTION_OVERRIDES.get(question.id) ?? agentCorrection?.questionVi ?? notesQuestionVi) ||
    baseQuestionVi;
  questionVi = clean(questionVi)
    .replace(/Phân loại của Bloom|Bloom['’]s Taxonomy|Bloom’s Taxonomy/gi, "thang Bloom")
    .replace(/Psychological Safety/gi, "an toàn tâm lý")
    .replace(/Team Cohesiveness\s*\([^)]*\)/gi, "sự gắn kết đội nhóm")
    .replace(/\bFace-saving\b/gi, "giữ thể diện (face-saving)");
  if (/\bpower-with\b/i.test(question.question)) {
    questionVi = questionVi.replace(/nguồn điện|power-with/gi, "quyền lực hợp tác");
  }
  if (/\bpower-over\b/i.test(question.question)) {
    questionVi = questionVi.replace(/mất điện|power-over/gi, "quyền lực áp đặt");
  }
  if (/\bpower-from-within\b/i.test(question.question)) {
    questionVi = questionVi.replace(/sức mạnh từ bên trong|power-from-within/gi, "nội lực");
  }

  const optionReviews = question.options.map((english, index) => {
    const exactGlossaryCorrection = EXACT.get(key(english));
    const agentOptionCorrection = agentCorrection?.optionsVi?.[index];
    const localOptionCorrection = localOptionOverrides?.[index];
    const corrected = localOptionCorrection ?? agentOptionCorrection;
    const postEdited = exactGlossaryCorrection
      ? {
          text: exactGlossaryCorrection,
          source: "required-professional-glossary",
          changed: true,
        }
      : corrected
      ? {
          text: corrected,
          source: localOptionCorrection
            ? "professional-manual-override"
            : "independent-agent-curated-correction",
          changed: true,
        }
      : postEditOption(english, base?.optionsVi?.[index]);
    return {
      letter: String.fromCharCode(65 + index),
      english,
      vietnamese: clean(postEdited.text),
      source: postEdited.source,
      changedFromBase: clean(postEdited.text) !== clean(base?.optionsVi?.[index]),
      glossaryTerms: glossaryMatches(english),
    };
  });

  const questionSource = QUESTION_OVERRIDES.has(question.id)
    ? "professional-manual-override"
    : agentCorrection?.questionVi
      ? "independent-agent-curated-correction"
      : notesQuestionVi
        ? "parsed-live-speaker-notes"
        : base?.questionTranslationSource ?? "reviewed-fallback";
  const liveNotesText = clean(live?.notes?.join(" ").replaceAll("�", " "));
  const flags = unique([
    ensemble?.needsReview && "english-ocr-ensemble-needs-review",
    ensemble?.comparison?.questionSimilarity < 0.8 && "english-question-low-ocr-agreement",
    ensemble?.comparison?.optionSimilarities?.some((score) => score < 0.85) &&
      "english-option-low-ocr-agreement",
    !notesQuestionVi && "question-vi-not-present-in-parsed-speaker-notes",
    !live?.notes?.length && "missing-live-speaker-notes",
    agentCorrection?.flags?.length && "independent-agent-correction-applied",
  ]);

  return {
    id: question.id,
    subject: question.subject,
    sourceSlide: question.sourceSlide,
    image: question.image,
    question: question.question,
    options: question.options,
    questionVi,
    optionsVi: optionReviews.map((record) => record.vietnamese),
    glossaryTerms: unique([
      ...glossaryMatches(question.question),
      ...optionReviews.flatMap((record) => record.glossaryTerms),
    ]),
    translationReview: {
      status: flags.some((flag) => flag.includes("ocr"))
        ? "reviewed-with-english-source-warning"
        : "reviewed",
      questionSource,
      optionSource: "contextual-postedit-with-professional-glossary",
      liveSpeakerNotesPresent: Boolean(live?.notes?.length),
      liveSpeakerNotesSupportQuestion:
        Boolean(notesQuestionVi) && liveNotesText.includes(clean(notesQuestionVi).slice(0, 36)),
      changedOptionCount: optionReviews.filter((record) => record.changedFromBase).length,
      flags,
    },
    optionReviews,
  };
});

const flagCounts = translations.flatMap((record) => record.translationReview.flags).reduce(
  (result, flag) => {
    result[flag] = (result[flag] ?? 0) + 1;
    return result;
  },
  {},
);

const report = {
  schemaVersion: 1,
  language: "vi",
  title: "Bản dịch tiếng Việt chuyên môn đã hậu biên tập",
  sourcePriority: [
    "data/ssg/live-speaker-notes.json",
    "parsed speaker-note translations in data/ssg104 and data/ssg105",
    "data/ssg/translations-vi.json as a draft only",
    "professional glossary and contextual post-editing",
    "data/ssg/audit/ocr-ensemble-review.json for English-source warnings",
  ],
  summary: {
    questionCount: translations.length,
    optionCount: translations.reduce((sum, record) => sum + record.optionsVi.length, 0),
    reviewedCount: translations.length,
    liveSpeakerNotesPresentCount: translations.filter(
      (record) => record.translationReview.liveSpeakerNotesPresent,
    ).length,
    speakerNotesQuestionCount: translations.filter(
      (record) => record.translationReview.questionSource === "parsed-live-speaker-notes",
    ).length,
    englishSourceWarningCount: translations.filter(
      (record) => record.translationReview.status === "reviewed-with-english-source-warning",
    ).length,
    changedOptionCount: translations.reduce(
      (sum, record) => sum + record.translationReview.changedOptionCount,
      0,
    ),
    independentAgentCorrectionRecordCount: translations.filter((record) =>
      record.translationReview.flags.includes("independent-agent-correction-applied"),
    ).length,
    professionalQuestionOverrideCount: translations.filter(
      (record) => record.translationReview.questionSource === "professional-manual-override",
    ).length,
    flagCounts,
  },
  glossary: GLOSSARY,
  translations,
};

await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(
  `Wrote ${translations.length} reviewed Vietnamese questions and ${report.summary.optionCount} options to ${outputPath}.`,
);
