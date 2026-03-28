# Dentistry RAG Website

A family dentistry website with a chatbot that uses retrieval-augmented generation (RAG) over a local JSON knowledge base.

## Local setup

1. Install dependencies:
   - `npm install`
2. Start Ollama locally:
   - `ollama serve`
3. Make sure your model is available:
   - `ollama pull mistral:latest`
4. Start the app:
   - `npm start`
5. Open `http://localhost:3000`

By default, the app uses:
- `OLLAMA_MODEL=mistral:latest`
- `OLLAMA_BASE_URL=http://127.0.0.1:11434/api`

## Ollama Cloud

This app can also use Ollama Cloud instead of a local Ollama instance.

Set these environment variables:

- `OLLAMA_API_KEY=your_ollama_api_key`
- `OLLAMA_MODEL=your_model_name`

Optional:

- `OLLAMA_BASE_URL=https://ollama.com/api`

When `OLLAMA_API_KEY` is present, the app defaults to Ollama Cloud. Otherwise it falls back to local Ollama.

## Vercel notes

The frontend can be deployed to Vercel. For the chatbot to work on Vercel, do not use local `127.0.0.1:11434`; instead configure:

- `OLLAMA_API_KEY`
- `OLLAMA_MODEL`

in your Vercel project environment variables.

## Features

- Homepage for a family dentistry practice
- Local JSON knowledge base in `data/knowledgebase.json`
- Simple keyword retrieval for RAG context assembly
- Chatbot answer generation through local Ollama or Ollama Cloud
