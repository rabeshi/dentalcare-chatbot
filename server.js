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
  locate: 'location',
  located: 'location',
  location: 'address',
  locatedat: 'address',
  directions: 'address',
  kid: 'children',
  kids: 'children',
  child: 'children',
  booking: 'book',
  booked: 'book',
  appointment: 'appointments',
  appointments: 'appointments',
  emergency: 'urgent',
  emergencies: 'urgent',
  hours: 'hours',
  open: 'hours',
  payment: 'insurance',
  payments: 'insurance',
  cost: 'pricing',
  price: 'pricing',
  prices: 'pricing'
};
const OUT_OF_SCOPE_RESPONSE = 'I can only answer questions that are directly covered in the DentalCare knowledge base. Please ask about DentalCare services, policies, appointments, hours, insurance, or the dental guidance included on this site.';

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
      const text = `${doc.title} ${doc.content}`.toLowerCase();
      const uniqueTerms = [...new Set(qterms)];
      const score = uniqueTerms.reduce((sum, term) => sum + (text.includes(term) ? 1 : 0), 0);
      return { ...doc, score };
    })
    .sort((a, b) => b.score - a.score);
}

app.post('/api/qa', async (req, res) => {
  const question = (req.body.question || '').trim();
  if (!question) {
    return res.status(400).json({ error: 'Question is required.' });
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
    const answer = json.response?.trim() || 'No answer from model.';
    return res.json({ question, context, answer });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log(`Dentistry RAG app running at http://localhost:3000 using ${OLLAMA_MODEL} via ${OLLAMA_BASE_URL}`);
});
