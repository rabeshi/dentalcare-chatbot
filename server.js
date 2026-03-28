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

function rankDocs(query, docs) {
  const qterms = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return docs
    .map((doc) => {
      const text = `${doc.title} ${doc.content}`.toLowerCase();
      const score = qterms.reduce((sum, t) => sum + (text.includes(t) ? 1 : 0), 0);
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
  const ranked = rankDocs(question, docs);
  const topDocs = ranked.slice(0, 3).filter((d) => d.score > 0);
  const context = topDocs.map((doc, i) => `${i + 1}. ${doc.title}: ${doc.content}`).join('\n\n') || 'No direct knowledge found in local data.';

  const prompt = `You are Dental AI, the helpful chatbot for DentalCare clinic. Use this context to answer user questions about our services, policies, and dental care. Provide caring, reassuring, and professional responses. If the question is not related to DentalCare or dental care, politely decline to answer and suggest contacting the clinic for dental-related inquiries.

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
