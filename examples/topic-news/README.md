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
