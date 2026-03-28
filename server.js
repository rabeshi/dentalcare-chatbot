import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const KB_PATH = path.join(__dirname, 'data', 'knowledgebase.json');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'ministral-3:3b';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || (process.env.OLLAMA_API_KEY ? 'https://ollama.com/api' : 'http://127.0.0.1:11434/api');
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'at', 'be', 'by', 'can', 'do', 'for', 'from', 'get', 'has',
  'how', 'i', 'if', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'our', 'the',
  'to', 'us', 'we', 'what', 'when', 'where', 'who', 'why', 'with', 'you', 'your'
]);
const TERM_NORMALIZATIONS = {
  adress: 'address',
  addres: 'address',
  addresses: 'address',
  locate: 'location',
  located: 'location',
  location: 'address',
  locatedat: 'address',
  directions: 'address',
  clinic: 'dentalcare',
  kid: 'children',
  kids: 'children',
  child: 'children',
  cavities: 'cavity',
  cavity: 'cavity',
  decay: 'cavity',
  decays: 'cavity',
  tooth: 'teeth',
  teeth: 'teeth',
  booking: 'book',
  booked: 'book',
  visit: 'appointments',
  appointment: 'appointments',
  appointments: 'appointments',
  emergency: 'urgent',
  emergencies: 'urgent',
  hours: 'hours',
  open: 'hours',
  opened: 'hours',
  opening: 'hours',
  closing: 'hours',
  time: 'hours',
  payment: 'insurance',
  payments: 'insurance',
  cost: 'pricing',
  price: 'pricing',
  prices: 'pricing'
};
const OUT_OF_SCOPE_RESPONSE = 'I can only answer questions that are directly covered in the DentalCare knowledge base. Please ask about DentalCare services, policies, appointments, hours, insurance, or the dental guidance included on this site.';
const CTA_MESSAGES = {
  book: 'If this applies to you, please book an appointment with DentalCare so a dentist can examine you in person.',
  urgent: 'If you are experiencing this now, please contact DentalCare immediately for urgent guidance and scheduling.',
  admin: 'If you would like help with scheduling, insurance, or next steps, please contact DentalCare directly.'
};
const GRATITUDE_PATTERNS = [
  /^thanks!?$/i,
  /^thank you!?$/i,
  /^thank you so much!?$/i,
  /^appreciate it!?$/i,
  /^thanks, appreciate it!?$/i
];

function getOllamaHeaders() {
  const headers = { 'Content-Type': 'application/json' };

  if (process.env.OLLAMA_API_KEY) {
    headers.Authorization = `Bearer ${process.env.OLLAMA_API_KEY}`;
  }

  return headers;
}

function loadKnowledgeBase() {
  try {
    const raw = fs.readFileSync(KB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

function normalizeTerm(term) {
  return TERM_NORMALIZATIONS[term] || term;
}

function isGratitudeMessage(query) {
  return GRATITUDE_PATTERNS.some((pattern) => pattern.test(query.trim()));
}

function extractQueryTerms(query) {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((term) => normalizeTerm(term))
    .filter((term) => term.length > 2 && !STOPWORDS.has(term));
}

function rankDocs(query, docs) {
  const qterms = extractQueryTerms(query);
  return docs
    .map((doc) => {
      const keywords = Array.isArray(doc.keywords) ? doc.keywords.join(' ') : '';
      const text = `${doc.title} ${doc.content} ${keywords}`.toLowerCase();
      const uniqueTerms = [...new Set(qterms)];
      const score = uniqueTerms.reduce((sum, term) => sum + (text.includes(term) ? 1 : 0), 0);
      return { ...doc, score };
    })
    .sort((a, b) => b.score - a.score);
}

function chooseCtaType(topDocs) {
  if (topDocs.some((doc) => doc.ctaType === 'urgent')) {
    return 'urgent';
  }

  if (topDocs.some((doc) => doc.ctaType === 'book')) {
    return 'book';
  }

  if (topDocs.some((doc) => doc.ctaType === 'admin')) {
    return 'admin';
  }

  return null;
}

function appendCta(answer, ctaType) {
  if (!ctaType) {
    return answer;
  }

  const normalizedAnswer = answer.toLowerCase();
  const ctaMessage = CTA_MESSAGES[ctaType];

  if (
    normalizedAnswer.includes('book an appointment') ||
    normalizedAnswer.includes('contact dentalcare immediately') ||
    normalizedAnswer.includes('contact the clinic directly')
  ) {
    return answer;
  }

  return `${answer}\n\n${ctaMessage}`;
}

app.post('/api/qa', async (req, res) => {
  const question = (req.body.question || '').trim();
  if (!question) {
    return res.status(400).json({ error: 'Question is required.' });
  }

  if (isGratitudeMessage(question)) {
    return res.json({
      question,
      context: '',
      answer: 'You are welcome. If you have another question about DentalCare services, appointments, or dental guidance, I am happy to help.'
    });
  }

  const docs = loadKnowledgeBase();
  const qterms = extractQueryTerms(question);

  if (qterms.length === 0) {
    return res.json({ question, context: '', answer: OUT_OF_SCOPE_RESPONSE });
  }

  const ranked = rankDocs(question, docs);
  const topDocs = ranked.slice(0, 3).filter((d) => d.score > 0);

  if (topDocs.length === 0) {
    return res.json({ question, context: '', answer: OUT_OF_SCOPE_RESPONSE });
  }

  const context = topDocs.map((doc, i) => `${i + 1}. ${doc.title}: ${doc.content}`).join('\n\n');
  const ctaType = chooseCtaType(topDocs);

  const prompt = `You are Dental AI, the helpful chatbot for DentalCare clinic. Answer only with facts that are explicitly supported by the provided context. Do not use outside knowledge, training data, or assumptions. If the context does not fully answer the question, say that you do not have that information in the DentalCare knowledge base and invite the user to contact the clinic directly. Keep responses concise, caring, and professional.

Context:
${context}

Question: ${question}

Answer:`;

  try {
    const resp = await fetch(`${OLLAMA_BASE_URL}/generate`, {
      method: 'POST',
      headers: getOllamaHeaders(),
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        max_tokens: 300,
        temperature: 0.05,
        stream: false,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(500).json({ error: `Ollama error: ${err}` });
    }

    const json = await resp.json();
    const answer = appendCta(json.response?.trim() || 'No answer from model.', ctaType);
    return res.json({ question, context, answer });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log(`Dentistry RAG app running at http://localhost:3000 using ${OLLAMA_MODEL} via ${OLLAMA_BASE_URL}`);
});
