import storage from './storage.js';
import { ingestStudyMaterials } from './ingestion.js';
import { getQAModel, getDialogueModel, getSummaryModel } from '../config/gemini.js';

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
You are a professional economics tutor. Provide clear, accurate, and well-structured responses based STRICTLY on the provided study materials.

STRICT CITATION RULES:
1. **PDF Citations**: 
   - The source metadata will specify the physical page count (e.g., "Physical page count: 50")
   - Use ONLY page numbers within the specified range (e.g., 1-50)
   - Format: "(Page X)" where X is the actual physical page number
   - NEVER cite page numbers outside the provided range
   - NEVER make up or guess page numbers
   - If you're unsure about a specific page number, cite the source name instead: "(Source: [PDF Name])"
   - Example: If metadata says "Physical page count: 50", only cite pages 1-50

2. **YouTube Citations**:
   - Format: "(YouTube: [Video Title])" 
   - Include approximate timestamps when relevant: "(YouTube: [Video Title], ~0:30)"
   - Be specific about which video when multiple are provided

3. **General Rules**:
   - Use ONLY information from the attached sources
   - Do NOT use general knowledge beyond the provided sources
   - Do NOT assume facts not present in the material
   - If information is not in the material, explicitly state this

FORMATTING GUIDELINES:
1. **Structure**: Use clear paragraphs and bullet points for readability
2. **Professional Tone**: Academic yet accessible language
3. **Completeness**: Provide thorough explanations with relevant details
4. **Accuracy**: Double-check all citations and facts against the source material
`.trim();

  if (type === 'dialogue') {
    return `${base}

DIALOGUE MODE - ACT AS A HUMAN TUTOR:
- You are a friendly, conversational economics tutor having a natural dialogue with a student
- Respond naturally to greetings, introductions, and small talk (e.g., "Hello! Nice to meet you, Bibekananda!")
- Build rapport and encourage the student with positive, supportive language
- When discussing academic topics, ground your answers in the study material
- For greetings/small talk: respond naturally without requiring source material
- For academic questions: use the study material and cite sources
- Keep responses conversational but professional (2-4 paragraphs max)
- Use natural language, avoid overly formal structures
- If an academic question can't be answered from the material, say: "That's a great question! Unfortunately, I don't have information about that specific topic in the study material we're working with. Would you like to ask about something else from the material?"
- Remember previous conversation context and build on it
`;
  }

  // Default QA mode
  return `${base}

Q&A MODE:
- Provide comprehensive, well-structured answers
- Use bullet points for lists and key characteristics
- Include relevant examples from the material when available
- Cite sources inline throughout your response
- If the answer is not in the material, respond EXACTLY: "I don't have information about this topic in the provided study material."
`;
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
- PDF: "(Page X)" - use ONLY actual physical page numbers
- YouTube: "(YouTube: [Video Title])" or "(YouTube: [Video Title], ~timestamp)"
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
export async function generateSuggestedQuestions() {
  const material = await requireMaterial();
  const model = getQAModel(); // Use QA model (Flash) for speed

  const systemPrompt = buildSystemInstructions();
  const contextParts = getContextParts(material);
  const normalized = normalizeParts(contextParts);
  const parts = [
    { text: systemPrompt },
    ...normalized,
    {
      text: `
Task: Generate 6-8 comprehensive, exam-relevant questions that cover ALL provided study materials.

REQUIREMENTS:
1. **Source Coverage**: 
   - Include questions from EACH source (PDFs and YouTube videos)
   - Ensure balanced representation across all materials
   - Don't focus on just one source

2. **Question Quality**:
   - Each question should be clear, specific, and exam-relevant
   - Mix question types: definitions, explanations, applications, comparisons
   - Questions should require detailed answers (not yes/no)
   - Length: 8-15 words per question

3. **Diversity**:
   - Cover different topics and concepts from the material
   - Include both fundamental and advanced concepts
   - Vary difficulty levels

4. **Format**:
   - Return as a JSON array of strings
   - Each string is one complete question
   - Questions must end with a question mark
   - NO duplicate questions

EXAMPLE FORMAT:
["What are the key characteristics of an oligopoly market structure?", "How does game theory apply to oligopolistic competition?", "What is the kinked demand curve model and why does it occur?", ...]

Respond ONLY with the JSON array, no markdown fences, no extra text.
`.trim()
    }
  ];

  console.log("FINAL GEMINI PARTS (suggest):", parts.map(p => Object.keys(p)));
  const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
  const raw = result.response.text().trim();

  // Best-effort JSON extraction
  const jsonMatch = raw.match(/\[([\s\S]*?)\]/);
  const jsonText = jsonMatch ? jsonMatch[0] : raw;

  let questions = [];
  try {
    questions = JSON.parse(jsonText);
  } catch {
    // Fallback if JSON fails
    questions = [
      "What are the main concepts here?",
      "Can you summarize this material?",
      "What are the key exam topics?",
      "Explain the core theory."
    ];
  }

  // Ensure it's an array of strings
  if (!Array.isArray(questions)) {
    return ["Summarize the key points", "What is this material about?"];
  }

  const verified = [];
  for (const q of questions) {
    if (verified.length >= 4) break;
    if (typeof q !== 'string' || !q.trim()) continue;
    try {
      const res = await answerUsingMaterial(q.trim());
      if (res.isGrounded) {
        verified.push(q.trim());
      }
    } catch {
      // ignore failures
    }
  }

  const finalList = verified.length >= 4 ? verified.slice(0, 4) : verified.concat(questions.filter((q) => typeof q === 'string')).slice(0, 4);

  return { questions: finalList };
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
