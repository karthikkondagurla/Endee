"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";

import NewsCard, { Article } from "@/components/NewsCard";
import SkeletonNewsCard from "@/components/SkeletonNewsCard";
import MasonryLayout from "@/components/MasonryLayout";

export default function DashboardPage() {
    const router = useRouter();

    const breakpointColumnsObj = {
        default: 3,
        1024: 2,
        768: 1
    };
    const [topics, setTopics] = useState<string[]>([]);
    const [articles, setArticles] = useState<Article[]>([]);

    const [isTopicsLoading, setIsTopicsLoading] = useState(true);
    const [isNewsLoading, setIsNewsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'latest' | 'trending'>('latest');

    // BYOK State
    const [groqApiKey, setGroqApiKey] = useState("");
    const [isSavingKey, setIsSavingKey] = useState(false);
    const [keySavedMessage, setKeySavedMessage] = useState("");

    // 2. Fetch Topics from localStorage
    const fetchTopics = useCallback(async () => {
        setIsTopicsLoading(true);

        try {
            const storedTopics = localStorage.getItem("user_topics");
            const userTopics = storedTopics ? JSON.parse(storedTopics) : [];

            if (userTopics.length === 0) {
                // If the user has no topics configured, they can add them via the search bar
                return;
            }

            setTopics(userTopics);
            const storedKey = localStorage.getItem("groq_api_key");
            if (storedKey) {
                setGroqApiKey(storedKey);
            }

            // If they have topics, fetch news immediately
            if (userTopics.length > 0) {
                fetchNews(userTopics);
            }
        } catch (err: any) {
            console.error("Error fetching topics:", err);
            setError("Failed to load topics.");
        } finally {
            setIsTopicsLoading(false);
        }
    }, [router]);

    useEffect(() => {
        fetchTopics();
    }, [fetchTopics]);

    // 3. Fetch News from our API Route
    const fetchNews = async (currentTopics: string[]) => {
        if (currentTopics.length === 0) {
            setArticles([]);
            return;
        }

        setIsNewsLoading(true);
        setError(null);
        let allArticles: Article[] = [];

        try {
            // Fetch news for each topic in parallel
            const promises = currentTopics.map(topic =>
                fetch(`/api/news?topic=${encodeURIComponent(topic)}`).then(res => res.json())
            );

            const results = await Promise.all(promises);

            results.forEach(result => {
                if (result.articles) {
                    allArticles = [...allArticles, ...result.articles];
                }
            });

            // We sort dynamically using useMemo in the render cycle
            setArticles(allArticles);

        } catch (err) {
            console.error("Failed to fetch news", err);
            setError("Failed to load your latest news feed.");
        } finally {
            setIsNewsLoading(false);
        }
    };

    // 4. Add a new topic
    const handleAddTopic = async (topic: string) => {
        if (topics.includes(topic)) return;

        const newTopics = [...topics, topic];
        setTopics(newTopics); // Optimistic UI update

        localStorage.setItem("user_topics", JSON.stringify(newTopics));
        fetchNews(newTopics);
    };

    // 5. Remove a topic
    const handleRemoveTopic = async (topicToRemove: string) => {
        const newTopics = topics.filter(t => t !== topicToRemove);
        setTopics(newTopics);

        localStorage.setItem("user_topics", JSON.stringify(newTopics));
        fetchNews(newTopics);
    };

    const handleSaveApiKey = async () => {
        setIsSavingKey(true);
        setKeySavedMessage("");

        try {
            localStorage.setItem("groq_api_key", groqApiKey);
            setKeySavedMessage("Key securely saved locally!");
            setTimeout(() => setKeySavedMessage(""), 3000);
        } catch (err) {
            console.error("Failed to save API Key:", err);
            setKeySavedMessage("Failed to save key.");
        } finally {
            setIsSavingKey(false);
        }
    };

    const displayedArticles = useMemo(() => {
        const sorted = [...articles];
        if (activeTab === 'latest') {
            sorted.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
        } else if (activeTab === 'trending') {
            sorted.sort((a, b) => (a.rank || 0) - (b.rank || 0));
        }
        return sorted;
    }, [articles, activeTab]);

    return (
        <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 antialiased overflow-hidden flex h-screen w-full">
            {/* Sidebar from Stitch */}
            <aside className="w-64 bg-white dark:bg-card-dark border-r border-slate-200 dark:border-slate-800 flex-shrink-0 flex flex-col justify-between z-20 h-full">
                <div className="flex flex-col h-full">
                    <div className="p-6">
                        <div className="flex flex-col mb-8">
                            <h1 className="text-slate-900 dark:text-white text-xl font-bold tracking-tight">Pigeon</h1>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">Industry Tracker</p>
                        </div>
                        <div className="space-y-1">
                            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-primary/10 text-primary font-medium transition-colors">
                                <span className="material-symbols-outlined text-primary fill-1" style={{ fontSize: '20px' }}>dashboard</span>
                                <span className="text-sm font-medium">The Stream</span>
                            </button>
                            <Link href="/dashboard/saved" className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group">
                                <span className="material-symbols-outlined text-slate-500 group-hover:text-primary transition-colors" style={{ fontSize: '20px' }}>bookmark</span>
                                <span className="text-sm font-medium">Saved</span>
                            </Link>
                        </div>
                        <div className="mt-8 relative h-64 overflow-y-auto hide-scrollbar">
                            <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 font-mono">Your Topics</p>
                            <div className="space-y-1">
                                {topics.length === 0 && !isTopicsLoading && (
                                    <p className="px-3 text-xs text-slate-500">No topics added.</p>
                                )}
                                {topics.map((topic) => (
                                    <div key={topic} className="flex items-center justify-between px-3 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group">
                                        <Link href={`/dashboard/topic/${encodeURIComponent(topic)}`} className="flex items-center gap-3 truncate cursor-pointer flex-1">
                                            <span className="material-symbols-outlined text-slate-400 group-hover:text-primary" style={{ fontSize: '20px' }}>tag</span>
                                            <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">{topic}</span>
                                        </Link>
                                        <button onClick={() => handleRemoveTopic(topic)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto relative h-full">
                {/* Sticky Header Container */}
                <div className="sticky top-0 z-30 bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl border-b border-white/40 dark:border-slate-800/60 px-8 py-4 flex items-center justify-between transition-all duration-300 shadow-sm">
                    <div className="flex flex-col">
                        <h1 className="text-[26px] tracking-tight font-extrabold text-slate-900 dark:text-white leading-tight">The Stream</h1>
                    </div>
                </div>

                <div className="max-w-5xl mx-auto p-8 space-y-10 pb-20">

                    {/* Top Controls Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Topic Search Box (Bento Style) */}
                        <div className="col-span-1 lg:col-span-2 bg-white/70 dark:bg-card-dark/70 backdrop-blur-xl rounded-2xl p-4 shadow-sm border border-white/60 dark:border-slate-700/50 flex flex-col justify-between">
                            <h3 className="text-[13px] font-extrabold text-slate-900 dark:text-white uppercase tracking-wider font-display mb-1.5">Add Topics</h3>
                            <SearchBar onAddTopic={handleAddTopic} isLoading={isTopicsLoading} />
                        </div>

                        {/* AI Config Box */}
                        <div className="col-span-1 bg-white/70 dark:bg-card-dark/70 backdrop-blur-xl rounded-2xl p-4 shadow-sm border border-white/60 dark:border-slate-700/50 flex flex-col justify-between shadow-inner">
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <h3 className="text-[13px] font-extrabold text-slate-900 dark:text-white uppercase tracking-wider font-display">Api settings</h3>
                                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border border-slate-200/50">Configure</span>
                                </div>
                                <p className="text-[11px] leading-tight text-slate-500 mb-1.5">Add your free Groq API key to unlock better experience</p>
                            </div>
                            <div className="mt-auto relative w-full pt-1">
                                <div className="flex gap-2 w-full">
                                    <input
                                        type="password"
                                        placeholder="gsk_..."
                                        value={groqApiKey}
                                        onChange={(e) => setGroqApiKey(e.target.value)}
                                        className="flex-1 w-full min-w-0 px-4 py-2 rounded-full border border-slate-200/60 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-md text-slate-900 dark:text-white font-mono text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all shadow-inner"
                                    />
                                    <button
                                        onClick={handleSaveApiKey}
                                        disabled={isSavingKey || !groqApiKey.startsWith("gsk_")}
                                        className="px-5 py-2 bg-primary text-white font-bold text-[13px] rounded-full hover:bg-primary/90 shadow-sm hover:shadow active:scale-95 disabled:opacity-50 transition-all whitespace-nowrap"
                                    >
                                        {isSavingKey ? "Saving..." : "Save"}
                                    </button>
                                </div>
                                {keySavedMessage && <span className="text-emerald-600 text-xs mt-2 block font-medium absolute">{keySavedMessage}</span>}
                            </div>
                        </div>
                    </div>

                    {/* Filtered Stream Masonry */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                            <button
                                onClick={() => setActiveTab('latest')}
                                className={`text-sm font-bold pb-2 -mb-2.5 transition-colors ${activeTab === 'latest' ? 'text-slate-900 dark:text-white border-b-2 border-primary' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
                            >Latest News</button>
                            <button
                                onClick={() => setActiveTab('trending')}
                                className={`text-sm font-bold pb-2 -mb-2.5 transition-colors ${activeTab === 'trending' ? 'text-slate-900 dark:text-white border-b-2 border-primary' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
                            >Trending</button>
                        </div>

                        {isNewsLoading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {[...Array(6)].map((_, i) => <SkeletonNewsCard key={i} />)}
                            </div>
                        ) : displayedArticles.length > 0 ? (
                            <MasonryLayout
                                breakpointCols={breakpointColumnsObj}
                                className="pigeon-masonry-grid"
                                columnClassName="pigeon-masonry-grid_column"
                            >
                                {displayedArticles.map((article, index) => (
                                    <div key={`${article.link}-${index}`}>
                                        <NewsCard article={article} groqApiKey={groqApiKey} />
                                    </div>
                                ))}
                            </MasonryLayout>
                        ) : (
                            !isTopicsLoading && topics.length > 0 && (
                                <p className="text-slate-500 font-medium text-sm">No recent news found for your topics.</p>
                            )
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
