<p align="center">
  <picture>
      <source media="(prefers-color-scheme: dark)" srcset="docs/assets/logo-dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="docs/assets/logo-light.svg">
      <img height="100" alt="Endee" src="docs/assets/logo-dark.svg">
  </picture>
</p>

<p align="center">
    <b>High-performance open-source vector database for AI search, RAG, semantic search, and hybrid retrieval.</b>
</p>

<p align="center">
    <a href="./docs/getting-started.md"><img src="https://img.shields.io/badge/Quick_Start-Local_Setup-success?style=flat-square" alt="Quick Start"></a>
    <a href="https://docs.endee.io/quick-start"><img src="https://img.shields.io/badge/Docs-Quick_Start-success?style=flat-square" alt="Docs"></a>
    <a href="https://github.com/endee-io/endee/blob/master/LICENSE"><img src="https://img.shields.io/github/license/endee-io/endee?style=flat-square" alt="License"></a>
    <a href="https://discord.gg/5HFGqDZQE3"><img src="https://img.shields.io/badge/Discord-Join_Chat-5865F2?logo=discord&style=flat-square" alt="Discord"></a>
    <a href="https://endee.io/"><img src="https://img.shields.io/badge/Website-Endee-111111?style=flat-square" alt="Website"></a>
    <!-- <a href="https://endee.io/benchmarks"><img src="https://img.shields.io/badge/Benchmarks-Coming_Soon-1F8B4C?style=flat-square" alt="Benchmarks"></a> -->
    <!-- <a href="https://endee.io/cloud"><img src="https://img.shields.io/badge/Cloud-Coming_Soon-2496ED?style=flat-square" alt="Cloud"></a> -->
</p>

<p align="center">
<strong><a href="./docs/getting-started.md">Quick Start</a> • <a href="#why-endee">Why Endee</a> • <a href="#use-cases">Use Cases</a> • <a href="#features">Features</a> • <a href="#api-and-clients">API and Clients</a> • <a href="#docs-and-links">Docs</a> • <a href="#community-and-contact">Contact</a></strong>
</p>

# Endee: Open-Source Vector Database for AI Search

**Endee** is a high-performance open-source vector database built for AI search and retrieval workloads. It is designed for teams building **RAG pipelines**, **semantic search**, **hybrid search**, recommendation systems, and filtered vector retrieval APIs that need production-oriented performance and control.

Endee combines vector search with filtering, sparse retrieval support, backup workflows, and deployment flexibility across local builds and Docker-based environments. The project is implemented in C++ and optimized for modern CPU targets, including AVX2, AVX512, NEON, and SVE2.

If you want the fastest path to evaluate Endee locally, start with the [Getting Started guide](./docs/getting-started.md) or the hosted docs at [docs.endee.io](https://docs.endee.io/quick-start).

## Why Endee

- Built as a dedicated vector database for AI applications, search systems, and retrieval-heavy workloads.
- Supports dense vector retrieval plus sparse search capabilities for hybrid search use cases.
- Includes payload filtering for metadata-aware retrieval and application-specific query logic.
- Ships with operational features already documented in this repo, including backup flows and runtime observability.
- Offers flexible deployment paths: local scripts, manual builds, Docker images, and prebuilt registry images.

## Getting Started

The full installation, build, Docker, runtime, and authentication instructions are in [docs/getting-started.md](./docs/getting-started.md).

Fastest local path:

```bash
chmod +x ./install.sh ./run.sh
./install.sh --release --avx2
./run.sh
```

The server listens on port `8080`. For detailed setup paths, supported operating systems, CPU optimization flags, Docker usage, and authentication examples, use:

- [Getting Started](./docs/getting-started.md)
- [Hosted Quick Start Docs](https://docs.endee.io/quick-start)

## Use Cases

### RAG and AI Retrieval

Use Endee as the retrieval layer for question answering, chat assistants, copilots, and other RAG applications that need fast vector search with metadata-aware filtering.

### Agentic AI and AI Agent Memory

Use Endee as the long-term memory and context retrieval layer for AI agents built with frameworks like LangChain, CrewAI, AutoGen, and LlamaIndex. Store and retrieve past observations, tool outputs, conversation history, and domain knowledge mid-execution with low-latency filtered vector search, so your autonomous agents get the right context without stalling their reasoning loop.

### Semantic Search

Build semantic search experiences for documents, products, support content, and knowledge bases using vector similarity search instead of exact keyword-only matching.

### Hybrid Search

Combine dense retrieval, sparse vectors, and filtering to improve relevance for search workflows where both semantic understanding and term-level precision matter.

### Recommendations and Matching

Support recommendation, similarity matching, and nearest-neighbor retrieval workflows across text, embeddings, and other high-dimensional representations.

## Features

- **Vector search** for AI retrieval and semantic similarity workloads.
- **Hybrid retrieval support** with sparse vector capabilities documented in [docs/sparse.md](./docs/sparse.md).
- **Payload filtering** for structured retrieval logic documented in [docs/filter.md](./docs/filter.md).
- **Backup APIs and flows** documented in [docs/backup-system.md](./docs/backup-system.md).
- **Operational logging and instrumentation** documented in [docs/logs.md](./docs/logs.md) and [docs/mdbx-instrumentation.md](./docs/mdbx-instrumentation.md).
- **CPU-targeted builds** for AVX2, AVX512, NEON, and SVE2 deployments.
- **Docker deployment options** for local and server environments.

## API and Clients

Endee exposes an HTTP API for managing indexes and serving retrieval workloads. The current repo documentation and examples focus on running the server directly and calling its API endpoints.

Current developer entry points:

- [Getting Started](./docs/getting-started.md) for local build and run flows
- [Hosted Docs](https://docs.endee.io/quick-start) for product documentation
- [Release Notes 1.0.0](https://github.com/endee-io/endee/releases/tag/1.0.0) for recent platform changes

## Docs and Links

- [Getting Started](./docs/getting-started.md)
- [Hosted Documentation](https://docs.endee.io/quick-start)
- [Release Notes](https://github.com/endee-io/endee/releases/tag/1.0.0)
- [Sparse Search](./docs/sparse.md)
- [Filtering](./docs/filter.md)
- [Backups](./docs/backup-system.md)

## Community and Contact

- Join the community on [Discord](https://discord.gg/5HFGqDZQE3)
- Visit the website at [endee.io](https://endee.io/)
- For trademark or branding permissions, contact [enterprise@endee.io](mailto:enterprise@endee.io)

## Contributing

We welcome contributions from the community to help make vector search faster and more accessible for everyone.

- Submit pull requests for fixes, features, and improvements
- Report bugs or performance issues through GitHub issues
- Propose enhancements for search quality, performance, and deployment workflows

## License

Endee is open source software licensed under the **Apache License 2.0**. See the [LICENSE](./LICENSE) file for full terms.

## Trademark and Branding

“Endee” and the Endee logo are trademarks of Endee Labs.

The Apache License 2.0 does not grant permission to use the Endee name, logos, or branding in a way that suggests endorsement or affiliation.

If you offer a hosted or managed service based on this software, you must use your own branding and avoid implying it is an official Endee service.

## Third-Party Software

This project includes or depends on third-party software components licensed under their respective open-source licenses. Use of those components is governed by their own license terms.


# Frontend (Endee-Pigeon) README


# Pigeon: AI-Powered Industry Tracker 🕊️🐦

**🟢 Live Deployment:** [pigeon-news.vercel.app](https://pigeon-news.vercel.app/)

## 📸 Product Screenshots

<div align="center">
  <img src="public/screenshots/dashboard.png" alt="The Stream Dashboard" width="800" style="border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom: 20px;" />
  <p><em>The main Pigeon Stream, fetching news for saved topics via advanced RSS parsing & filtering.</em></p>

  <img src="public/screenshots/modal.png" alt="AI Summarization Reader Modal" width="600" style="border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom: 20px;" />
  <p><em>The Reader Modal leveraging the Groq API (Llama 3) to instantly read and summarize an article.</em></p>
</div>

Pigeon is a fast, intelligent, and highly automated news tracker designed to help you stay ahead in your industry. Built with rapid AI prototyping and agentic workflows, it curates, fetches, and interacts with real-time data seamlessly.

## 🚀 Built for the AI Product Engineer Mindset

This project was built from the ground up using modern AI development tools and an "agentic first" workflow. It perfectly embodies the principles of vibe coding, rapid prototyping, and shipping AI features quickly. 

### Why this project matches the role:
*   **AI-Assisted Development:** Entirely scaffolded, designed, and coded using **Google Antigravity** (an advanced AI coding agent) and **Google Stitch** (for UI/UX generation).
*   **Rapid Prototyping:** Transitioned from a raw PRD directly to a working, polished Next.js product in hours, reflecting the ability to iterate quickly based on real-world needs.
*   **LLM Integrations & Structured Outputs:** Integrates with the **Groq API** (Llama models) for structured, lightning-fast article summarizations.
*   **Agentic Workflows & Tool Use:** The development process involved using AI agents (Antigravity) that could reason, plan, call tools (like Context7 for live documentation), and execute complex refactoring tasks autonomously.
*   **API & System Interaction:** The app interacts with external RSS feeds, Google News, caching layers, and Supabase (PostgreSQL) databases for a complete end-to-end data flow.

## 🛠️ Tech Stack & AI Ecosystem

*   **Framework:** Next.js 14 (App Router), React, TypeScript
*   **Styling:** Tailwind CSS (Glassmorphism, High-end UI refined by AI Skills)
*   **Backend & Auth:** Supabase (Database, Row Level Security, Auth)
*   **AI & LLMs:** Groq / Llama 3 (for AI Summarization)
*   **AI Developer Environment:**
    *   **Google Antigravity:** Used for pair programming, full-stack implementation, and debugging.
    *   **Google Stitch:** Used for rapid UI prototyping and generative component design.
    *   **Context7 MCP:** Used for fetching up-to-date documentation directly into the agent's context.

## 💡 Key Features

*   **Custom Topic Tracking:** Users can add multiple industry keywords (e.g., "Generative AI", "Shipping", "Lithium") to follow.
*   **Live Stream & Feed:** Fetches and aggregates real-time news dynamically via Google News RSS parsing.
*   **AI Summarizer Modal:** Users can click on an article to instantly generate a concise bullet-point summary using Groq's fast inference API.
*   **Masonry Layout & Polished UI:** A responsive, bento-grid/masonry design featuring modern aesthetics, hover effects, and dark mode support.
*   **Bring Your Own Key (BYOK):** Securely save a Groq API key to your Supabase profile to unlock AI features.

---

## 💻 Running the Project Locally

First, clone the repository and install the dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
```

Set up your `.env.local` file with your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🤝 The Development Process (Vibe Coding at its best)

1.  **PRD Generation:** Used AI to outline the core problem, user flows, and database schemas before writing a single line of code.
2.  **UI/UX Design:** Stitch generated the visual guidelines, exact color tokens, and layout structures. We applied a specific "UI/UX Pro Max" intelligence skill to ensure a premium look.
3.  **Agentic Execution:** Antigravity operated autonomously to set up Supabase auth, write the RSS fetching logic, and integrate the Groq API for summarization.
4.  **Debugging & Shipping:** Leveraged Context7 to pull live documentation when solving edge cases (like RSS parsing failures), resulting in rapid iteration and deployment to Vercel.

*Built for speed, efficiency, and intelligence.*
