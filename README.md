# Dentistry RAG Website

A minimal dentistry website with retrieval-augmented generation (RAG) backed by Ollama + Mistral.

## Setup

1. Start Ollama server (if not running):
   - `ollama serve`
2. Make sure `mistral:latest` is installed:
   - `ollama list` (should show `mistral:latest`)
3. Start this app:
   - `npm start`
4. Open http://localhost:3000

## Features

- Front-end question form
- Simple keyword retrieval from local dentistry knowledge base
- Mistral answer generation via Ollama API
