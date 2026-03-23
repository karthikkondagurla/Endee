# Pigeon — AI-Powered Industry Tracker 🐦

**Live Demo:** [https://endee-blue.vercel.app](https://endee-blue.vercel.app)  
**Vector DB URL (Endee):** [https://endee-oss-latest.onrender.com](https://endee-oss-latest.onrender.com)

Pigeon is an intelligent news and industry tracker that curates, digests, and makes news interactively searchable using Semantic Vector Search and RAG (Retrieval-Augmented Generation). 

This project was built as an assignment to demonstrate the integration of the **Endee Vector Database** in a practical, production-ready AI/ML application.

---

## 🎯 Project Overview & Problem Statement

**The Problem:**
Professionals and researchers face information overload. Every day, thousands of articles, blog posts, and press releases are published across various industries. Traditional keyword-based search is often inadequate for research because it misses the *context* and *meaning* behind the news. Users waste time manually sifting through feeds to find relevant trends or answers.

**The Solution:**
Pigeon solves this by automatically ingesting news articles across user-selected topics, embedding them into a high-dimensional vector space, and allowing users to:
1. **Semantically search** for concepts rather than exact keywords.
2. **Chat with the news (RAG)** to get instant, AI-generated answers grounded in the latest articles.
3. Automatically receive AI summaries of dense articles.

---

## 🏗️ System Design and Technical Approach

Pigeon is built on a modern serverless architecture, separating the stateless frontend/API layer from the stateful AI and database layers.

### Architecture Stack
* **Frontend:** Next.js 16 (React), Tailwind CSS, Vanilla styling.
* **Backend:** Next.js Serverless API routes (deployed on Vercel).
* **Vector Database:** [Endee](https://github.com/endee-io/endee) (Open-source vector DB, deployed on Render.com via Docker).
* **LLM & Inference:** Groq API (for blazing-fast Llama-3 inference and text summarization) + `@xenova/transformers` (for local embedding generation).

### Key Workflows
1. **Ingestion:** When a user visits the dashboard, articles are fetched based on their topics. The Next.js backend uses `all-MiniLM-L6-v2` to instantly generate 384-dimensional vector embeddings of the articles and upserts them into the Endee DB.
2. **Semantic Search:** User queries are embedded into vectors and sent to Endee to perform a high-speed cosine similarity search (k-NN) against the indexed articles.
3. **RAG (Retrieval-Augmented Generation):** Users ask a question. The system embeds the question, retrieves the top `K` most relevant articles from Endee, and constructs a prompt for the Groq LLM. The LLM streams back a conversational answer grounded purely in those retrieved articles.

---

## 🧠 How Endee is Used

Endee is the core intellectual engine of this project. It serves as the single source of truth for semantic context. 

Specifically, Endee is implemented to power three primary features:

1. **Semantic Search (`/api/endee/search`)**
   Whenever a user searches using the header UI, the query is embedded and sent to Endee using `client.search()`. Endee instantly returns the top-K closest vectors, allowing the app to render articles that match the visual and structural context of the query, not just exact keywords.

2. **RAG Context Retrieval (`/api/rag`)**
   For the "Ask AI" feature, Endee acts as the exact knowledge base. When a user asks "What are the latest AI chip trends?", Endee retrieves the closest historical articles. These articles are fed to the Groq LLM to prevent hallucinations, ensuring the AI only answers based on factual grounding.

3. **Dynamic Upsertion (`/api/endee/upsert`)**
   Endee handles real-time updates. As the app encounters new articles from RSS feeds or APIs, it streams them directly into the Endee instance (`client.upsert()`). The `pigeon_articles` index is configured to use the `cosine` space type with `INT8` precision for optimal memory usage and speed.

---

## ⚙️ Setup and Execution Instructions

### Prerequisites
* Node.js v20+
* Docker & Docker Compose (for the Endee Database)
* A free Groq API Key ([Get one here](https://console.groq.com/keys))

### Local Development Setup

**1. Clone the repository**
```bash
git clone https://github.com/YOUR_USERNAME/Endee.git
cd Endee
```

**2. Configure Environment Variables**
Copy the example environment file:
```bash
cp .env.example .env.local
```
Inside `.env.local`, add your Groq API key:
```env
GROQ_API_KEY=gsk_your_key_here
ENDEE_URL=http://localhost:8080/api/v1
```

**3. Start the Endee Vector Database (via Docker)**
Endee runs locally using Docker. We've included a setup script that builds the image from source and starts the DB:
```bash
# Make script executable and run
chmod +x setup.sh
./setup.sh

# Alternatively, just use docker compose:
docker compose up endee-oss -d
```
*Endee will now be running at `http://localhost:8080`.*

**4. Start the Next.js Application**
In a new terminal, install the dependencies and start the dev server:
```bash
# Install Node dependencies
npm install

# Start the dev server
npm run dev
```

**5. Access the App**
Open [http://localhost:3000](http://localhost:3000) in your browser. 
Add a few topics (e.g., "Technology", "Startups") to trigger the automatic ingestion of articles into your local Endee instance. You can then immediately start using the Semantic Search and RAG features!

---

> **Note to Evaluators:** Because this repository is a fork of the official Endee repo (as per the strict assignment guidelines), the pigeon application code resides within the same directory as the Endee source code. The Next.js app is located in `./src/app` while Endee's C++ source is in `./src/core`, `./src/server`, etc.
