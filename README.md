# Pigeon × Endee — AI-Powered News Intelligence

**Live Frontend (Vercel):** [https://endee-blue.vercel.app](https://endee-blue.vercel.app)
**Live Vector DB (Render):** [https://endee-oss-latest.onrender.com/api/v1/health](https://endee-oss-latest.onrender.com/api/v1/health)

This project is a submission for **ENDEE OC.41989.2026.58432**. It is built on top of a forked version of the official [Endee Vector Database](https://github.com/endee-io/endee).

---

## 1. Project Overview & Problem Statement

**The Problem:** Traditional news aggregation relies heavily on exact keyword matching and chronological sorting. This leads to noise, missed semantic connections, and an overwhelming amount of raw data that lacks synthesis or personalized discoverability.

**The Solution:** **Pigeon** is an AI-powered news intelligence platform that turns the internet's noise into a personal intelligence feed. By converting articles into 384-dimensional vector embeddings and storing them in the **Endee open-source vector database**, Pigeon enables:
- Finding articles by meaning, not just exact keywords.
- Grounding AI answers in real-time news (eliminating hallucinations).
- Discovering related reads automatically based on semantic similarity.

---

## 2. Explanation of How Endee is Used

Pigeon heavily relies on the **Endee Vector Database** to power four core AI/ML use cases. All vectors are generated using the `all-MiniLM-L6-v2` transformer model (384 dimensions) and stored using Endee's high-performance HNSW index with INT8 quantization.

### Use Case 1: Semantic Search
Instead of matching keywords, Pigeon converts the user's search query into a vector and performs a `cosine` similarity search in Endee. 
*Example: Searching "chip shortage impact" will find articles titled "TSMC cuts semiconductor output forecast" because they are semantically close in the vector space.*

### Use Case 2: RAG (Retrieval-Augmented Generation)
When a user asks a question via the "Ask AI" panel, Pigeon embeds the question, queries Endee for the top-5 most relevant articles, and injects that context into the Groq LLM (Llama 3.1 8B). This ensures the AI's answer is strictly grounded in recent news and fully cited.

### Use Case 3: Article Recommendations
When viewing the Semantic Results tab, Pigeon surfaces similar articles automatically. Because Endee returns exact distance scores, the UI can confidently display related content without any manual tagging.

### Use Case 4: Agentic AI Workflows
Pigeon features a Daily Digest Agent powered by Vercel CRON. Every 24 hours, the agent autonomously:
1. Fetches the latest RSS feeds.
2. Embeds the articles and **upserts them into Endee**.
3. **Retrieves** the top 10 most relevant articles per topic via Endee vector search.
4. Generates a structured daily briefing via Groq LLM.

---

## 3. System Design and Technical Approach

### Architecture Diagram
```
┌─────────────────────────────────────────────────────┐
│                    USER BROWSER                      │
│              Next.js Frontend (React)                │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────┐
│              VERCEL (Next.js API Routes)             │
│  - /api/news          → fetch RSS + Endee upsert     │
│  - /api/endee/search  → generate embedding + search  │
│  - /api/rag           → Endee retrieve + Groq stream │
│  - /api/cron/digest   → Autonomous agentic loop      │
└────────────┬──────────────────────┬─────────────────┘
             │                      │
      ┌──────▼──────┐        ┌──────▼──────────┐
      │  Groq API   │        │  Endee DB        │
      │ (Llama 3.1) │        │ (Render Web Svc) │
      │  RAG Gen    │        │  pigeon_articles │
      └─────────────┘        └─────────────────┘
```

### Tech Stack
- **Frontend & API:** Next.js 16 (App Router), React, Tailwind CSS 4
- **Vector Database:** Endee (Open Source C++ Vector DB) deployed via Docker
- **Embedding Model:** `@xenova/transformers` (`all-MiniLM-L6-v2`) running serverlessly
- **LLM Provider:** Groq (Llama 3.1 8B) for high-speed RAG and summarization
- **Deployment:** Vercel (Frontend/APIs) and Render.com (Endee DB)

---

## 4. Setup and Execution Instructions

### Local Development Setup

**1. Clone the repository**
```bash
git clone https://github.com/karthikkondagurla/Endee.git
cd Endee
```

**2. First-Time Setup (Docker)**
The project includes a unified setup script to build the Endee C++ engine and the Next.js app locally using Docker Compose.
```bash
chmod +x setup.sh
./setup.sh
```

**3. Environment Variables**
Copy the example environment file and fill in your Groq API key:
```bash
cp .env.example .env.local
```
Edit `.env.local`:
```env
GROQ_API_KEY=gsk_your_groq_api_key
ENDEE_URL=http://localhost:8080/api/v1
CRON_SECRET=your_random_secret
DIGEST_TOPICS=artificial intelligence,startups,climate tech
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**4. Start the Full Stack**
To start both the Next.js app and the local Endee vector database container:
```bash
docker compose up -d
```
- The Pigeon App will be running at: `http://localhost:3000`
- The Endee DB will be running at: `http://localhost:8080`

*Alternatively, if you only want to run Endee in Docker and Next.js natively, you can run `make endee` followed by `npm install && npm run dev`.*

### Deployment Notes
The live version uses a distributed architecture:
1. **Endee** was built into a Docker image (`infra/Dockerfile`) and pushed to Docker Hub, then deployed as a Web Service on **Render.com**.
2. **Next.js** was deployed to **Vercel** (`.vercelignore` is used to skip the heavy C++ build files).
3. Vercel environment variables point to the Render Endee instance URL.

---

> **Note on Mandatory Steps**: This project was built on top of a fork of the official `endee-io/endee` repository, and the official repo has been starred as required by the assignment guidelines.
