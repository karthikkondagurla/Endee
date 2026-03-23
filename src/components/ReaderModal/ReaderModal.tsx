"use client";

import React, { useState, useEffect } from "react";
import { useReader } from "@/context/ReaderContext";
import { formatDistanceToNow } from "date-fns";


export default function ReaderModal() {
    const { isReaderOpen, currentArticle, groqApiKey, closeReader } = useReader();
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    // Metadata & AI State from backend
    const [summary, setSummary] = useState<string[]>([]);
    const [sentiment, setSentiment] = useState<string | null>(null);
    const [author, setAuthor] = useState<string | null>(null);
    const [isLoadingAI, setIsLoadingAI] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

    // Recommendations state
    const [recommendations, setRecommendations] = useState<any[]>([]);
    const [isLoadingRecs, setIsLoadingRecs] = useState(false);

    // Prevent body scroll when open
    useEffect(() => {
        if (isReaderOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
    }, [isReaderOpen]);

    // Fetch recommendations from Endee when article opens
    useEffect(() => {
        if (!currentArticle || !isReaderOpen) {
            setRecommendations([]);
            return;
        }
        let cancelled = false;
        setIsLoadingRecs(true);
        fetch('/api/endee/recommend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                articleLink: currentArticle.link,
                title: currentArticle.title,
                contentSnippet: currentArticle.contentSnippet,
            }),
        })
            .then(r => r.json())
            .then(data => { if (!cancelled) setRecommendations(data.results || []); })
            .catch(() => { if (!cancelled) setRecommendations([]); })
            .finally(() => { if (!cancelled) setIsLoadingRecs(false); });
        return () => { cancelled = true; };
    }, [currentArticle, isReaderOpen]);

    // Auto-fetch the full article summary and metadata on open
    useEffect(() => {
        if (!currentArticle) return;

        setIsSaved(false);
        setSummary([]);
        setSentiment(null);
        setAuthor(null);
        setAiError(null);

        // Define fetch inside effect to avoid dependency issues
        const fetchSummaryAndMetadata = async () => {
            if (!groqApiKey) {
                setAiError("Groq API Key is required to fetch full article contents.");
                return;
            }

            setIsLoadingAI(true);
            try {
                const res = await fetch("/api/summarize", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        apiKey: groqApiKey,
                        title: currentArticle.title,
                        link: currentArticle.link,
                        contentSnippet: currentArticle.contentSnippet
                    })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Failed to summarize.");

                setSummary(data.detailed_summary || []);
                setSentiment(data.sentiment || null);

                setAuthor(data.author || "Editorial Team");
            } catch (err: any) {
                console.error("Scraping/Summarization error:", err);
                setAiError(err.message);
            } finally {
                setIsLoadingAI(false);
            }
        };

        if (isReaderOpen) {
            fetchSummaryAndMetadata();
        }
    }, [currentArticle, isReaderOpen, groqApiKey]);

    if (!isReaderOpen || !currentArticle) return null;

    const publishedAt = new Date(currentArticle.pubDate);
    const formattedDate = formatDistanceToNow(publishedAt, { addSuffix: true });

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            closeReader();
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const savedArticlesStr = localStorage.getItem("saved_articles");
            const savedArticles = savedArticlesStr ? JSON.parse(savedArticlesStr) : [];
            const exists = savedArticles.some((a: any) => a.link === currentArticle.link);

            if (!exists) {
                const newSaved = [...savedArticles, currentArticle];
                localStorage.setItem("saved_articles", JSON.stringify(newSaved));
            }
            setIsSaved(true);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 md:p-12 animate-fade-in"
            onClick={handleBackdropClick}
        >
            <div className="bg-white dark:bg-card-dark w-full max-w-4xl max-h-full rounded-3xl shadow-2xl overflow-hidden flex flex-col relative animate-slide-up-subtle border border-slate-200 dark:border-slate-800">

                {/* Header (Sticky Close Button) */}
                <div className="absolute top-4 right-4 z-20 pointer-events-auto">
                    <button
                        onClick={closeReader}
                        className="p-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 shadow-subtle hover:scale-105 active:scale-95"
                    >
                        <span className="material-symbols-outlined block" style={{ fontSize: '24px' }}>close</span>
                    </button>
                </div>

                {/* Footer (Sticky Save Button) */}
                <div className="absolute bottom-6 right-6 z-20 pointer-events-auto">
                    <button
                        onClick={handleSave}
                        disabled={isSaving || isSaved}
                        className={`flex items-center gap-2 px-4 py-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur rounded-full transition-colors shadow-subtle hover:scale-105 active:scale-95 ${isSaved
                            ? "text-primary cursor-default"
                            : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700"
                            }`}
                    >
                        <span className="material-symbols-outlined block" style={{ fontSize: '20px' }}>
                            {isSaved ? "bookmark_added" : "bookmark_add"}
                        </span>
                        <span className="text-sm font-bold">{isSaving ? "Saving..." : isSaved ? "Saved" : "Save Article"}</span>
                    </button>
                </div>

                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto hide-scrollbar">

                    {/* Inner container mimicking Stitch constraints */}
                    <div className="max-w-3xl mx-auto px-6 pt-16 pb-20 sm:px-12 md:px-16">

                        {/* Centered Topic Tag */}
                        <div className="flex justify-center mb-8">
                            <span className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 text-xs font-mono font-bold uppercase tracking-[0.15em] px-4 py-1.5 rounded-full">
                                {currentArticle.topic || "NEWS"}
                            </span>
                        </div>

                        {/* Huge Title */}
                        <h1 className="text-4xl sm:text-5xl md:text-[56px] font-bold text-slate-900 dark:text-white leading-[1.05] tracking-tight mb-8 text-center text-balance font-display">
                            {currentArticle.title}
                        </h1>

                        {/* Metadata Row */}
                        <div className="flex flex-wrap items-center justify-center gap-3 text-sm md:text-base font-medium text-slate-500 dark:text-slate-400 mb-10">
                            {isLoadingAI && !author ? (
                                <div className="h-6 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                            ) : (
                                <>
                                    <div className="flex items-center gap-2">
                                        <img
                                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(author || 'Author')}&background=random`}
                                            alt={author || 'Author'}
                                            className="w-6 h-6 rounded-full"
                                        />
                                        <span className="text-slate-900 dark:text-slate-200">{author || 'Editorial'}</span>
                                    </div>
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                                    <a
                                        href={currentArticle.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:text-primary-dark transition-colors flex items-center gap-1"
                                    >
                                        {currentArticle.sourceName}
                                        <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                                    </a>
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                                    <span>{formattedDate}</span>
                                </>
                            )}
                        </div>

                        {/* Removed Massive Cover Image with Floating Action Bar */}
                        <div className="mb-8"></div>

                        {/* Body / AI Summary Content */}
                        <div className="prose prose-slate dark:prose-invert prose-lg md:prose-xl max-w-none prose-p:leading-relaxed prose-p:text-slate-700 dark:prose-p:text-slate-300">

                            {isLoadingAI ? (
                                <div className="space-y-6 animate-pulse">
                                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
                                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-11/12"></div>
                                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
                                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-4/5 pt-4"></div>
                                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
                                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-10/12"></div>
                                </div>
                            ) : aiError ? (
                                <div className="text-red-500 bg-red-50 dark:bg-red-900/20 p-6 rounded-2xl">
                                    <div className="font-bold flex items-center gap-2 mb-2">
                                        <span className="material-symbols-outlined">error</span>
                                        Summary Unavailable
                                    </div>
                                    <p className="text-sm">{aiError}</p>
                                    <p className="text-sm mt-4 text-slate-600 dark:text-slate-400">
                                        Original Snippet: {currentArticle.contentSnippet}
                                    </p>
                                </div>
                            ) : summary.length > 0 ? (
                                <>
                                    {sentiment && (
                                        <div className="flex justify-end mb-6">
                                            <span className={`text-xs font-mono font-bold uppercase tracking-wide px-3 py-1.5 rounded-full ${sentiment === "Positive" ? "bg-emerald-100 text-emerald-800" :
                                                sentiment === "Negative" ? "bg-red-100 text-red-800" :
                                                    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                                }`}>
                                                Sentiment: {sentiment}
                                            </span>
                                        </div>
                                    )}
                                    <div className="space-y-6">
                                        {summary.map((para, i) => (
                                            <p key={i}>{para}</p>
                                        ))}
                                    </div>
                                    <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 flex justify-center">
                                        <span className="flex items-center gap-2 text-xs font-mono text-slate-400 uppercase tracking-widest">
                                            <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                                            AI Generated Summary
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <p>{currentArticle.contentSnippet}</p>
                            )}

                        </div>

                        {/* Similar Articles Panel (Endee Recommendations) */}
                        {(isLoadingRecs || recommendations.length > 0) && (
                            <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800">
                                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">
                                    <span className="material-symbols-outlined text-violet-500" style={{ fontSize: '18px' }}>linked_services</span>
                                    Similar Articles
                                    <span className="text-[10px] font-mono text-violet-500 bg-violet-100 dark:bg-violet-900/30 px-2 py-0.5 rounded-full">Powered by Endee</span>
                                </h3>
                                {isLoadingRecs ? (
                                    <div className="space-y-3">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {recommendations.map((rec, i) => (
                                            <a
                                                key={i}
                                                href={rec.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50 hover:border-violet-300 dark:hover:border-violet-700 hover:bg-violet-50/50 dark:hover:bg-violet-900/10 transition-all group"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors line-clamp-2 leading-snug">
                                                        {rec.title}
                                                    </p>
                                                    <p className="text-[11px] text-slate-400 mt-0.5">{rec.sourceName}</p>
                                                </div>
                                                {rec.similarity !== undefined && (
                                                    <span className="flex-shrink-0 bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-[10px] font-bold px-2 py-1 rounded-full">
                                                        {Math.round(rec.similarity * 100)}%
                                                    </span>
                                                )}
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
}
