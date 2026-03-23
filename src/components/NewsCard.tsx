"use client";

import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { useReader } from "@/context/ReaderContext";

export interface Article {
    title: string;
    link: string;
    pubDate: string;
    sourceName: string;
    contentSnippet?: string;
    topic?: string;
    rank?: number;
    imageUrl?: string;
    description?: string;
    similarity?: number; // Cosine similarity score from Endee (0–1)
}

interface NewsCardProps {
    article: Article;
    groqApiKey?: string;
}

export default function NewsCard({ article, groqApiKey }: NewsCardProps) {
    const publishedAt = new Date(article.pubDate);
    const timeAgo = formatDistanceToNow(publishedAt, { addSuffix: true });

    const { openReader } = useReader();

    // AI State
    const [summary, setSummary] = useState<string[]>([]);
    const [sentiment, setSentiment] = useState<string | null>(null);
    const [isLoadingAI, setIsLoadingAI] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

    // Find Similar (Endee) state
    const [similarArticles, setSimilarArticles] = useState<Article[]>([]);
    const [isLoadingSimilar, setIsLoadingSimilar] = useState(false);
    const [showSimilar, setShowSimilar] = useState(false);
    const [similarError, setSimilarError] = useState<string | null>(null);

    const handleSummarize = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (!groqApiKey) return;
        setIsLoadingAI(true);
        setAiError(null);

        try {
            const res = await fetch("/api/summarize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    apiKey: groqApiKey,
                    title: article.title,
                    link: article.link,
                    contentSnippet: article.contentSnippet
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to summarize.");

            setSummary(data.short_summary || []);
            setSentiment(data.sentiment);
        } catch (err: any) {
            console.error("Summarization error:", err);
            setAiError(err.message);
        } finally {
            setIsLoadingAI(false);
        }
    };

    const handleFindSimilar = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (showSimilar) {
            setShowSimilar(false);
            return;
        }

        setIsLoadingSimilar(true);
        setSimilarError(null);

        try {
            const res = await fetch('/api/endee/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: article.title, topK: 4 }),
            });
            const data = await res.json();

            // Exclude the current article from results
            const filtered = (data.results || []).filter((r: Article) => r.link !== article.link);
            setSimilarArticles(filtered.slice(0, 3));
            setShowSimilar(true);
        } catch (err: any) {
            setSimilarError('Could not load similar articles.');
        } finally {
            setIsLoadingSimilar(false);
        }
    };

    const aiSummary = summary.length > 0 ? { bullets: summary, sentiment } : null;
    const isSummarizing = isLoadingAI;

    return (
        <article className="break-inside-avoid bg-white/70 dark:bg-card-dark/70 backdrop-blur-xl rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group border border-white/60 dark:border-slate-700/50 flex flex-col h-full">
            <div className="p-5 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-3">
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-slate-200/50 dark:border-slate-700/50">
                        {article.topic || "News"}
                    </span>
                    {article.similarity !== undefined && article.similarity > 0 && (
                        <span className="bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                            <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>psychology</span>
                            {Math.round(article.similarity * 100)}% match
                        </span>
                    )}
                </div>
                <h2
                    className="text-[17px] font-extrabold text-slate-900 dark:text-slate-100 leading-snug tracking-tight mb-2 group-hover:text-primary transition-colors cursor-pointer"
                    onClick={() => openReader(article, groqApiKey)}
                >
                    {article.title}
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-[13px] leading-relaxed line-clamp-3 mb-4">
                    {article.contentSnippet}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium mb-4">
                    <span className="text-slate-800 dark:text-slate-300">{article.sourceName}</span>
                    <span>•</span>
                    <span>{timeAgo}</span>
                </div>

                {/* Find Similar (Endee) Panel */}
                {showSimilar && similarArticles.length > 0 && (
                    <div className="mb-3 space-y-2 bg-violet-50/60 dark:bg-violet-900/10 border border-violet-200/50 dark:border-violet-700/30 rounded-2xl p-3">
                        <p className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>link</span>
                            Related Articles
                        </p>
                        {similarArticles.map((rel, i) => (
                            <a
                                key={i}
                                href={rel.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-[12px] text-slate-700 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 transition-colors line-clamp-2 leading-snug"
                            >
                                <span className="font-semibold">{rel.sourceName && `${rel.sourceName} — `}</span>
                                {rel.title}
                            </a>
                        ))}
                    </div>
                )}
                {showSimilar && similarArticles.length === 0 && !isLoadingSimilar && (
                    <p className="text-[11px] text-slate-400 mb-3 italic">No similar articles indexed yet. Add more topics first.</p>
                )}
                {similarError && (
                    <p className="text-[11px] text-amber-600 mb-3">{similarError}</p>
                )}

                {/* Action Buttons Row */}
                <div className="pt-4 border-t border-slate-100/50 dark:border-slate-800/50 mt-auto">
                    {!aiSummary && !aiError && !isSummarizing ? (
                        <div className="flex items-center justify-between gap-2">
                            {/* Find Similar Button */}
                            <button
                                onClick={handleFindSimilar}
                                disabled={isLoadingSimilar}
                                title="Find semantically similar articles via Endee"
                                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all bg-violet-100/80 text-violet-600 hover:bg-violet-200/80 hover:scale-105 active:scale-95 dark:bg-violet-900/20 dark:text-violet-400 disabled:opacity-50"
                            >
                                {isLoadingSimilar
                                    ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: '14px' }}>progress_activity</span>
                                    : <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{showSimilar ? 'link_off' : 'link'}</span>
                                }
                                {showSimilar ? 'Hide' : 'Find Similar'}
                            </button>

                            {/* Summarize Button */}
                            <button
                                onClick={handleSummarize}
                                disabled={!groqApiKey}
                                title={!groqApiKey ? "Add Groq API Key to enable" : "Summarize with AI"}
                                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${groqApiKey
                                    ? "bg-primary/10 text-primary hover:bg-primary/20 hover:scale-105 active:scale-95"
                                    : "bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-500"
                                    }`}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>auto_awesome</span>
                                Summarize
                            </button>
                        </div>
                    ) : isSummarizing ? (
                        <div className="flex items-center justify-center gap-2 text-primary font-medium text-xs py-1">
                            <span className="material-symbols-outlined animate-spin" style={{ fontSize: '18px' }}>progress_activity</span>
                            Analyzing...
                        </div>
                    ) : aiError ? (
                        <div className="text-red-500 text-xs font-medium bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl">
                            {aiError}
                        </div>
                    ) : aiSummary ? (
                        <div className="space-y-3">
                            {/* Find Similar row still available after summary */}
                            <button
                                onClick={handleFindSimilar}
                                disabled={isLoadingSimilar}
                                className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-violet-100/80 text-violet-600 hover:bg-violet-200/80 active:scale-95 dark:bg-violet-900/20 dark:text-violet-400 disabled:opacity-50 transition-all mb-2"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>{showSimilar ? 'link_off' : 'link'}</span>
                                {showSimilar ? 'Hide Similar' : 'Find Similar'}
                            </button>

                            <div className="bg-slate-50/50 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-inner">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[11px] font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1">
                                        <span className="material-symbols-outlined text-primary" style={{ fontSize: '14px' }}>auto_awesome</span>
                                        AI Summary
                                    </span>
                                    {aiSummary.sentiment && (
                                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${aiSummary.sentiment === "Positive" ? "bg-emerald-100 text-emerald-800" :
                                            aiSummary.sentiment === "Negative" ? "bg-red-100 text-red-800" :
                                                "bg-slate-200 text-slate-600"
                                            }`}>
                                            {aiSummary.sentiment}
                                        </span>
                                    )}
                                </div>
                                <ul className="space-y-2">
                                    {aiSummary.bullets.map((bullet, i) => (
                                        <li key={i} className="text-[13px] text-slate-700 dark:text-slate-300 flex items-start gap-2">
                                            <span className="text-primary mt-0.5">•</span>
                                            <span className="leading-relaxed">{bullet}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </article>
    );
}
