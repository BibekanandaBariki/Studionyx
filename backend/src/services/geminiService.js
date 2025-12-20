import storage from './storage.js';
import { getQAModel, getDialogueModel, getSummaryModel } from '../config/gemini.js';

/**
 * Build the system instructions.
 * Now purely instructions, no context placeholder.
 */
/**
 * Build the system instructions.
 * Now purely instructions, no context placeholder.
 * @param {string} type - 'qa' or 'dialogue'
 */
function buildSystemInstructions(type = 'qa') {
  const base = `
You are an expert economics tutor. Answer based on the provided study material (files/texts).

STRICT RULES:
1. Use ONLY information from the attached files (PDFs, Videos, Texts)
2. NO general knowledge or training data
3. NO assumptions beyond material
4. Always cite source provided
5. PAGE NUMBERS: If the PDF has printed page numbers (e.g. 100+) that differ from the physical page count (e.g. 9 pages), ALWAYS cite the physical page number (1-9) as "Page X (Physical)" to avoid confusion.
`.trim();

  if (type === 'dialogue') {
    return `${base}
5. You are having a voice conversation. Be friendly, concise, and conversational.
6. If the user greets you, greet them back naturally.
7. If the answer to a QUESTION is not in the material, say something like: "I checked the study material, but I couldn't find information about that specific topic."
8. Do not make up info.
`;
  }

  // Default QA strictness
  return `${base}
5. If answer not in material, respond EXACTLY: "I don't have information about this topic in the provided study material."
6. Be clear, concise, student-friendly
7. For exam tips, focus on material concepts
`;
}

/**
 * Ensure study material is loaded.
 */
function requireMaterial() {
  const material = storage.getStudyMaterial();
  // check for contextParts OR context (legacy)
  if (!material || (!material.context && !material.contextParts)) {
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

/**
 * Grounded Q&A mode.
 */
export async function askQuestion(question) {
  const material = requireMaterial();
  const model = getQAModel();

  const systemPrompt = buildSystemInstructions('qa');
  const contextParts = getContextParts(material);

  // Construct multimodal prompt
  // Parts: [System Instructions, ...Context Parts, Student Question]
  const prompt = [
    { text: systemPrompt },
    ...contextParts,
    { text: `\nStudent Question: ${question}` }
  ];

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  const isGrounded =
    text !== 'I don\'t have information about this topic in the provided study material.';

  const answerPayload = {
    question,
    answer: text,
    isGrounded,
    sources: material.sources,
  };

  storage.addQAEntry(answerPayload);

  return answerPayload;
}

/**
 * Dialogue mode.
 */
export async function dialogueTurn(message) {
  const material = requireMaterial();
  const model = getDialogueModel();

  const history = storage.getHistory();
  const systemPrompt = buildSystemInstructions('dialogue');
  const contextParts = getContextParts(material);

  // Log for debugging
  console.log(`[Dialogue] Context parts: ${contextParts.length}, History: ${history.length}`);

  const historyText = history
    .map(
      (h, idx) =>
        `Turn ${idx + 1} - Student: ${h.studentMessage}\nTutor: ${h.teacherResponse}\n`,
    )
    .join('\n');

  const prompt = [
    { text: systemPrompt },
    ...contextParts,
    { text: `\nConversation so far:\n${historyText || '(no previous turns)'}` },
    { text: `\nNew student message: ${message}\nRespond as a friendly tutor in a conversational style. Keep it brief.` }
  ];

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  const entry = {
    studentMessage: message,
    teacherResponse: text,
    conversationLength: history.length + 1,
  };

  storage.addToHistory(entry);

  return entry;
}

/**
 * Summary mode.
 */
export async function generateSummary() {
  const material = requireMaterial();
  const model = getSummaryModel();

  const systemPrompt = buildSystemInstructions('qa'); // Use QA strictness for summary
  const allContextParts = getContextParts(material);

  // Filter to use ONLY PDF (Drive) material for summary as requested
  const pdfContextParts = allContextParts.filter(
    (part) => part.inlineData && part.inlineData.mimeType === 'application/pdf'
  );

  // Fallback to all content if no PDF found (e.g. only YouTube loaded)
  const contextParts = pdfContextParts.length > 0 ? pdfContextParts : allContextParts;

  const summaryInstructions = `
Task: Create a compact, exam-focused study summary split into:
1) overview (2–3 sentences),
2) concepts (3–7 bullet points as short phrases),
3) examTips (3–7 actionable tips).

Respond as strict JSON with the following shape:
{
  "overview": "string",
  "concepts": ["string", "..."],
  "examTips": ["string", "..."]
}
`.trim();

  const prompt = [
    { text: systemPrompt },
    ...contextParts,
    { text: summaryInstructions }
  ];

  const result = await model.generateContent(prompt);
  const raw = result.response.text().trim();

  // Robust JSON extraction
  let jsonText = raw;
  
  // 1. Try to find content between ```json and ```
  const codeBlockMatch = raw.match(/```json\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    jsonText = codeBlockMatch[1];
  } else {
    // 2. Fallback: Find first '{' and last '}'
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      jsonText = raw.substring(start, end + 1);
    }
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    console.error("JSON Parse Error:", err, "Raw Text:", raw);
    parsed = {
      overview: "Could not parse summary. Please try again.",
      concepts: ["Error parsing concepts"],
      examTips: ["Error parsing tips"],
      raw_debug: raw // Optional: helps debug if it happens again
    };
  }

  return {
    summary: parsed,
  };
}

/**
 * Generate suggested questions based on study material.
 */
export async function generateSuggestedQuestions() {
  const material = requireMaterial();
  const model = getQAModel(); // Use QA model (Flash) for speed

  const systemPrompt = buildSystemInstructions();
  const contextParts = getContextParts(material);

  const prompt = [
    { text: systemPrompt },
    ...contextParts,
    {
      text: `
Task: Generate 4 short, distinct, exam-relevant questions based on the provided study material.
These questions should help a student explore the key concepts.
Keep them concise (under 10 words).

Respond as a strict JSON array of strings:
["Question 1?", "Question 2?", ...]
`.trim()
    }
  ];

  const result = await model.generateContent(prompt);
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




