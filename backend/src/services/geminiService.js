import storage from './storage.js';
import { ingestStudyMaterials } from './ingestion.js';
import { getQAModel, getDialogueModel, getSummaryModel, getSuggestModel } from '../config/gemini.js';

const REFUSAL = 'I don\'t have information about this topic in the provided study material.';

function textCitesMaterial(text, material) {
  try {
    const t = (text || '').toLowerCase();
    const citesVideo =
      /youtube\s+video/i.test(text || '') ||
      /\b(?:\d{1,2}):\d{2}(?:\s*-\s*\d{1,2}:\d{2})?\b/.test(text || '') ||
      /\byoutube\b/i.test(text || '');
    const citesPage = /page\s+\d+\s*\(physical\)/i.test(t);
    const citesNamed = Array.isArray(material?.sources)
      ? material.sources.some((name) => {
        const safe = String(name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return safe && new RegExp(safe, 'i').test(text || '');
      })
      : false;
    return citesVideo || citesPage || citesNamed;
  } catch {
    return false;
  }
}

function enforceGrounding(text, material, mode = 'qa') {
  // For dialogue mode, be more lenient - allow greetings and conversational responses
  if (mode === 'dialogue') {
    // Check if it's a greeting or small talk (short, no academic content)
    const isGreeting = /^(hello|hi|hey|good morning|good afternoon|good evening|nice to meet you|thank you|thanks|bye|goodbye)/i.test(text.trim());
    const isShort = text.trim().split(' ').length < 15;

    // Allow greetings and short conversational responses without citation requirement
    if (isGreeting || (isShort && !text.includes('?'))) {
      return { answer: text.trim(), isGrounded: true };
    }

    // For longer academic responses, check for citations but don't enforce strictly
    const hasCitations = textCitesMaterial(text, material);
    return { answer: text.trim(), isGrounded: hasCitations };
  }

  // For Q&A mode, enforce strict grounding
  const grounded = text && text.trim() !== REFUSAL && textCitesMaterial(text, material);
  if (!grounded) {
    return { answer: REFUSAL, isGrounded: false };
  }
  return { answer: text.trim(), isGrounded: true };
}

/**
 * Build the system instructions.
 * @param {string} type - 'qa' or 'dialogue'
 */
function buildSystemInstructions(type = 'qa') {
  const base = `
You are a professional academic tutor. Provide clear, accurate, and well-structured responses based STRICTLY on the provided study materials.

MANDATORY RESPONSE RULES:
1. **Formatting**:
   - NEVER start with a greeting or "Okay" or "Sure".
   - Use meaningful headings (e.g., "## Key Concepts") to structure your answer.
   - Use short paragraphs (max 3-4 sentences).
   - Use bullet points for lists.
   - NO emojis except 📄 for PDF/Text citations and 🎥 for YouTube citations.
   - Maintain an academic, professional tone suitable for exams.

2. **Citations & Source Grounding**:
   - Citations MUST appear AFTER the complete sentence or paragraph. NEVER inside a sentence.
   - Group citations at the end of sections when possible.
   - Use ONLY these formats:
     - 📄 Source: Page X (Physical)  (for PDFs)
     - 🎥 Source: MM:SS – MM:SS (YouTube) (for Videos, use approximate timestamp ranges)
   - NEVER cite page numbers or timestamps not present in the source.

3. **Source Restriction (STRICT)**:
   - Answer ONLY using the provided study materials.
   - If the answer is not in the materials, respond EXACTLY:
     "I don't have information about this topic in the provided study material."
   - Do NOT use external knowledge to fill gaps.

4. **Content Quality**:
   - Prioritize clarity over verbosity.
   - Place examples in a separate "## Examples" section.
   - End with a concise "## Conclusion".
`.trim();

  if (type === 'dialogue') {
    return `${base}

DIALOGUE MODE EXCEPTIONS:
- You are a friendly tutor. You MAY use greetings/small talk at the START of the conversation.
- Once academic topics start, switch to the STRICT formatting rules above.
- If the user says "Hello" or "Hi", respond naturally (e.g., "Hello! I'm ready to help you study.").
- For academic questions, apply the Citation and Source Restriction rules strictly.
`;
  }

  // Default QA mode
  return base;
}

/**
 * Ensure study material is loaded.
 */
async function requireMaterial() {
  let material = storage.getStudyMaterial();
  const activeSources = storage.getSources();

  const signature = (sources) => {
    try {
      return (sources || [])
        .map((s) => [s.type, s.name, s.url, s.fileUri].filter(Boolean).join(':'))
        .sort()
        .join('|');
    } catch {
      return '';
    }
  };

  const materialSourceNames = material?.stats?.sources || material?.sources || [];
  const sigActive = signature(activeSources);
  const sigMaterial = Array.isArray(materialSourceNames)
    ? materialSourceNames.slice().sort().join('|')
    : '';

  const needsIngest =
    !material ||
    (!material.context && !material.contextParts) ||
    (activeSources && activeSources.length > 0 && sigActive !== sigMaterial);

  if (needsIngest) {
    if (activeSources && activeSources.length > 0) {
      console.log('[Material] (Re)ingesting for active notebook', {
        activeNotebookId: storage.getStats().activeNotebookId,
        sourceCount: activeSources.length,
        sources: activeSources.map(s => ({ type: s.type, name: s.name })),
      });
      const m = await ingestStudyMaterials(activeSources);
      storage.setStudyMaterial(m);
      return m;
    }
    if (storage.isDefaultActive()) {
      console.log('[Material] Default notebook has no sources; using environment fallbacks if present');
      const m = await ingestStudyMaterials(null);
      storage.setStudyMaterial(m);
      return m;
    }
    const error = new Error('Study material not ingested yet');
    error.statusCode = 400;
    throw error;
  }

  return material;
}

/**
 * Helper to get context parts for prompt
 */
function getContextParts(material) {
  if (material.contextParts) {
    return material.contextParts;
  }
  // Legacy support
  return [{ text: material.context }];
}

function normalizeParts(parts) {
  const out = [];
  for (const p of parts || []) {
    if (p && p.fileData && p.fileData.mimeType && p.fileData.fileUri) {
      out.push({ fileData: { mimeType: p.fileData.mimeType, fileUri: p.fileData.fileUri } });
    } else if (p && typeof p.text === 'string' && p.text.trim().length > 0) {
      out.push({ text: p.text });
    }
  }
  return out;
}
/**
 * Grounded Q&A mode.
 */
export async function askQuestion(question) {
  const material = await requireMaterial();
  const model = getQAModel();

  const systemPrompt = buildSystemInstructions('qa');
  const contextParts = getContextParts(material);
  const normalized = normalizeParts(contextParts);

  // Construct multimodal prompt
  // Parts: [System Instructions, ...Context Parts, Student Question]
  const parts = [{ text: systemPrompt }, ...normalized, { text: `\nStudent Question: ${question}` }];

  console.log("FINAL GEMINI PARTS (ask):", parts.map(p => Object.keys(p)));
  const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
  const raw = result.response.text().trim();

  const enforced = enforceGrounding(raw, material);

  const answerPayload = {
    question,
    answer: enforced.answer,
    isGrounded: enforced.isGrounded,
    sources: material.sources,
  };

  storage.addQAEntry(answerPayload);

  return answerPayload;
}

async function answerUsingMaterial(question) {
  const material = await requireMaterial();
  const model = getQAModel();
  const systemPrompt = buildSystemInstructions('qa');
  const contextParts = getContextParts(material);
  const normalized = normalizeParts(contextParts);
  const parts = [{ text: systemPrompt }, ...normalized, { text: `\nStudent Question: ${question}` }];
  const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
  const raw = result.response.text().trim();
  const enforced = enforceGrounding(raw, material);
  return {
    question,
    answer: enforced.answer,
    isGrounded: enforced.isGrounded,
    sources: material.sources,
  };
}

/**
 * Dialogue mode.
 */
export async function dialogueTurn(message) {
  const material = await requireMaterial();
  const model = getDialogueModel();

  const history = storage.getHistory();
  const systemPrompt = buildSystemInstructions('dialogue');
  const contextParts = getContextParts(material);
  const normalized = normalizeParts(contextParts);

  // Log for debugging
  console.log(`[Dialogue] Context parts: ${contextParts.length}, History: ${history.length}`);

  const historyText = history
    .map(
      (h, idx) =>
        `Turn ${idx + 1} - Student: ${h.studentMessage}\nTutor: ${h.teacherResponse}\n`,
    )
    .join('\n');

  const parts = [
    { text: systemPrompt },
    ...normalized,
    { text: `\nConversation so far:\n${historyText || '(no previous turns)'}` },
    { text: `\nNew student message: ${message}\nRespond as a friendly tutor in a conversational style. Keep it brief.` }
  ];

  console.log("FINAL GEMINI PARTS (dialogue):", parts.map(p => Object.keys(p)));
  const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
  const raw = result.response.text().trim();
  const enforced = enforceGrounding(raw, material, 'dialogue'); // Pass 'dialogue' mode

  const entry = {
    studentMessage: message,
    teacherResponse: enforced.answer,
    isGrounded: enforced.isGrounded,
    sources: material.sources,
    conversationLength: history.length + 1,
  };

  storage.addToHistory(entry);

  return entry;
}

/**
 * Summary mode.
 */
export async function generateSummary() {
  const material = await requireMaterial();
  const model = getSummaryModel();

  const systemPrompt = buildSystemInstructions('qa'); // Use QA strictness for summary
  const allContextParts = getContextParts(material);
  const contextParts = allContextParts;
  const normalized = normalizeParts(contextParts);

  const summaryInstructions = `
Task: Create a comprehensive, exam-focused study summary from ALL provided materials.

STRUCTURE (Return as strict JSON):
{
  "overview": "string (3-5 sentences providing a comprehensive introduction to the topic)",
  "concepts": ["array of 8-12 detailed concept explanations with proper citations"],
  "examTips": ["array of 8-12 specific, actionable exam preparation tips"]
}

DETAILED REQUIREMENTS:

1. **Overview** (3-5 sentences):
   - Provide a thorough introduction to the main topic
   - Synthesize information from ALL sources (PDFs and YouTube videos)
   - Set context for the detailed concepts that follow

2. **Concepts** (8-12 items):
   - Each concept should be a complete, detailed explanation (2-3 sentences)
   - Cover ALL major topics from the study materials
   - Include specific examples and details from the sources
   - Proper citations: "(Page X)" for PDFs, "(YouTube: [Video Title])" for videos
   - Ensure concepts are exam-relevant and comprehensive

3. **Exam Tips** (8-12 items):
   - Specific, actionable study strategies
   - Reference actual content from the materials
   - Include what to memorize, understand, and practice
   - Highlight common exam question types related to this material

CITATION FORMAT:
- PDF: "📄 Page X (Physical)" - use ONLY actual physical page numbers
- YouTube: "🎥 MM:SS – MM:SS (YouTube)" or "(video title)"
- Be specific and accurate with all citations

CRITICAL:
- Use information from ALL provided sources
- Be detailed and comprehensive, not brief
- Maintain academic professionalism
- Return ONLY valid JSON, no markdown fences, no extra text
`.trim();

  const parts = [{ text: systemPrompt }, ...normalized, { text: summaryInstructions }];

  console.log("FINAL GEMINI PARTS (summary):", parts.map(p => Object.keys(p)));
  const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
  const raw = result.response.text().trim();

  function extractJson(text) {
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      return cleaned.substring(start, end + 1);
    }
    return cleaned;
  }
  const jsonText = extractJson(raw);

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    console.error("JSON Parse Error:", err, "Raw Text:", raw);
    const retryParts = [
      { text: systemPrompt },
      ...normalized,
      { text: summaryInstructions + "\nReturn ONLY strict JSON with keys overview, concepts, examTips. No code fences, no prose, no markdown." },
    ];
    try {
      const retryResult = await model.generateContent({ contents: [{ role: 'user', parts: retryParts }] });
      const retryRaw = retryResult.response.text().trim();
      const retryJsonText = extractJson(retryRaw);
      parsed = JSON.parse(retryJsonText);
    } catch (err2) {
      console.error("JSON Parse Error (Retry):", err2);
      parsed = {
        overview: "Could not parse summary. Please try again.",
        concepts: ["Error parsing concepts"],
        examTips: ["Error parsing tips"],
        raw_debug: raw,
      };
    }
  }

  return {
    summary: parsed,
    isGrounded: true,
    sources: material.sources,
  };
}

/**
 * Generate suggested questions based on study material.
 */
/**
 * Generate suggested questions based on study material.
 */
export async function generateSuggestedQuestions(options = {}) {
  // 1. Check Cache
  const cached = storage.getSuggestedQuestions();
  // Do NOT regenerate if they already exist, unless forced
  if (!options.force && cached && cached.length > 0) {
    console.log('[Gemini] Returning cached suggested questions.');
    return { questions: cached };
  }

  // 2. Validate Sources
  let material;
  try {
    // We expect material to be available or ingestible
    material = await requireMaterial();
  } catch (err) {
    // If ingestion fails or no material
    console.warn('[Gemini] Suggestion generation skipped: No material.', err.message);
    const msg = "Suggested questions are not available because no study material has been ingested.";
    return { questions: [msg] };
  }

  if (!material || !material.sources || material.sources.length === 0) {
    const msg = "Suggested questions are not available because no study material has been ingested.";
    return { questions: [msg] };
  }

  const model = getSuggestModel();
  const systemPrompt = buildSystemInstructions('qa');
  const contextParts = getContextParts(material);
  const normalized = normalizeParts(contextParts);

  // 3. Construct Prompt with Strict Rules
  const parts = [
    { text: systemPrompt },
    ...normalized,
    {
      text: `
Task: Generate exactly 5-7 high-quality, exam-oriented suggested questions based on the provided study materials.

RULES:
1. **Quantity**: Return exactly 5, 6, or 7 questions.
2. **Relevance**: Questions must be strictly derived from the provided sources (PDFs/Videos).
3. **Quality**:
   - Clear, unambiguous, and exam-suitable.
   - Avoid generic questions like "What is this file about?".
   - Focus on key concepts, definitions, and relationships.
4. **Format**:
   - Return ONLY a JSON array of strings.

Example:
["What defines an oligopoly?", "How is the kinked demand curve derived?", "Compare Perfect Competition and Monopoly."]
`.trim()
    }
  ];

  console.log("FINAL GEMINI PARTS (suggest):", parts.map(p => Object.keys(p)));
  if (parts.length > 200) {
    console.warn("Too many parts for suggestion, truncating to last 20 + prompt");
    // Keep system prompt + last 20 source chunks + prompt. A primitive truncation strategy.
    // Ideally we should rely on Gemini's large context.
  }

  const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
  const raw = result.response.text().trim();

  // 4. Parse Response - Model is in JSON mode, so it should be valid JSON
  let questions = [];
  try {
    questions = JSON.parse(raw);
  } catch (e) {
    console.error("JSON Parse Error (Suggest):", e, "Raw output:", raw);
    // Even in JSON mode, sometimes models output nothing or fail.
    questions = ["Review the summary of the material."];
  }

  // Ensure 5-7 limit and type check
  if (!Array.isArray(questions)) questions = [];
  questions = questions.filter(q => typeof q === 'string' && q.trim().length > 5);

  if (questions.length > 7) questions = questions.slice(0, 7);

  // 5. Cache Results
  if (questions.length > 0) {
    storage.setSuggestedQuestions(questions);
  }

  return { questions };
}

/**
 * Simple connectivity check for /api/test-gemini.
 */
export async function testGeminiConnection() {
  const model = getQAModel();
  const result = await model.generateContent('Say "ok" if you are available.');
  const text = result.response.text().toLowerCase();
  const connected = text.includes('ok');

  return {
    connected,
    model: model.model || 'gemini-2.5-flash',
    rawResponse: text,
  };
}
