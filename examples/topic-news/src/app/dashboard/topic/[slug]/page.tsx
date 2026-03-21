import Link from "next/link";
import NewsCard from "@/components/NewsCard";
import { fetchRSS } from "@/utils/fetchRSS";
import MasonryLayout from "@/components/MasonryLayout";

// Mock Data for "Key Players" until we build an AI entity extractor
const MOCK_KEY_PLAYERS = [
    { name: "ASML", country: "Netherlands", initial: "A", color: "blue" },
    { name: "TSMC", country: "Taiwan", initial: "T", color: "red" },
    { name: "Intel", country: "USA", initial: "I", color: "blue" },
    { name: "Nikon", country: "Japan", initial: "N", color: "yellow" },
    { name: "Canon", country: "Japan", initial: "C", color: "purple" },
];

export default async function TopicPage({ params }: { params: Promise<{ slug: string }> }) {
    const breakpointColumnsObj = {
        default: 2,
        1024: 2,
        768: 1
    };
    // Decode the URL slug (e.g. "Semiconductor%20Lithography" -> "Semiconductor Lithography")
    const resolvedParams = await params;
    const topicName = decodeURIComponent(resolvedParams.slug);

    // In a fully local setup, the API key should ideally be passed from the client,
    // but since this is a server component we either skip AI features here 
    // or rely on a global environment variable if applicable locally.
    const apiKey = "";

    // Fetch news dynamically for this specific topic
    const articles = await fetchRSS([topicName]);

    return (
        <main className="flex-1 overflow-y-auto relative h-full">
            {/* Sticky Header Context */}
            <div className="sticky top-0 z-30 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-8 py-4 flex items-center justify-between transition-all duration-300">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                        <Link href="/dashboard" className="hover:text-primary transition-colors">Home</Link>
                        <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                        <span className="text-slate-900 dark:text-white font-medium">{topicName}</span>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight capitalize">{topicName}</h1>
                </div>

                <div className="flex items-center gap-3">
                    <button className="p-2 text-slate-500 hover:text-primary hover:bg-primary/10 rounded-full transition-colors" title="Search Topic">
                        <span className="material-symbols-outlined">search</span>
                    </button>
                    <button className="p-2 text-slate-500 hover:text-primary hover:bg-primary/10 rounded-full transition-colors" title="Topic Settings">
                        <span className="material-symbols-outlined">tune</span>
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-full text-slate-700 dark:text-slate-300 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <span>Unfollow</span>
                    </button>
                </div>
            </div>

            <div className="max-w-5xl mx-auto p-8 space-y-10 pb-20">
                {/* Hero Stats & Description */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-4">
                        <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed max-w-2xl">
                            Deep dive into the latest trends, market shifts, and breakthroughs related to {topicName}.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">#Latest</span>
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">#Trending</span>
                        </div>
                    </div>

                    {/* Stats Card */}
                    <div className="bg-white dark:bg-card-dark rounded-xl p-5 shadow-subtle border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500 mb-1">Activity Today</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold font-display text-slate-900 dark:text-white">24</span>
                                <span className="text-sm font-medium text-primary">Articles</span>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                            <span className="text-xs text-slate-400 font-mono">VS LAST WEEK</span>
                            <span className="flex items-center text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                                <span className="material-symbols-outlined text-[16px] mr-0.5">trending_up</span>
                                12%
                            </span>
                        </div>
                    </div>
                </div>

                {/* Key Players Widget (Horizontal Scroll) */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-display">Key Players</h3>
                        <button className="text-xs text-primary font-medium hover:underline">View All</button>
                    </div>
                    <div className="relative group">
                        <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2 mask-linear">
                            {MOCK_KEY_PLAYERS.map((player) => (
                                <div key={player.name} className="flex-shrink-0 flex items-center gap-3 bg-white dark:bg-card-dark p-3 rounded-xl border border-slate-200 dark:border-slate-800 min-w-[160px] cursor-pointer hover:shadow-md transition-shadow group/card">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold
                                        ${player.color === 'blue' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : ''}
                                        ${player.color === 'red' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : ''}
                                        ${player.color === 'yellow' ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400' : ''}
                                        ${player.color === 'purple' ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400' : ''}
                                    `}>
                                        {player.initial}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{player.name}</p>
                                        <p className="text-xs text-slate-500">{player.country}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Filtered Stream Layout */}
                <div className="space-y-4">
                    <div className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                        <button className="text-sm font-bold text-slate-900 dark:text-white border-b-2 border-primary pb-2 -mb-2.5">Latest News</button>
                        <button className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 transition-colors pb-2">Market Data</button>
                        <button className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 transition-colors pb-2">Regulatory</button>
                    </div>

                    {/* Trend Widget inside the feed stream */}
                    <MasonryLayout
                        breakpointCols={breakpointColumnsObj}
                        className="pigeon-masonry-grid"
                        columnClassName="pigeon-masonry-grid_column"
                    >
                        <div className="mb-6">
                            <article className="break-inside-avoid bg-white dark:bg-card-dark rounded-2xl shadow-subtle p-5 border border-slate-100 dark:border-slate-800 flex flex-col h-full">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <span className="bg-tag-finance text-tag-finance-text text-[11px] font-mono font-bold uppercase tracking-wide px-2 py-1 rounded-md">Market Data</span>
                                        <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-3">Trend Index</h2>
                                    </div>
                                    <div className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded text-xs font-bold flex items-center">
                                        <span className="material-symbols-outlined text-[14px] ml-1">arrow_upward</span>
                                        4.2%
                                    </div>
                                </div>

                                {/* Abstract Chart Representation */}
                                <div className="h-32 w-full flex items-end gap-1 px-2 mb-2 mt-auto">
                                    <div className="w-1/6 bg-slate-100 dark:bg-slate-800 h-[40%] rounded-t"></div>
                                    <div className="w-1/6 bg-slate-100 dark:bg-slate-800 h-[55%] rounded-t"></div>
                                    <div className="w-1/6 bg-slate-100 dark:bg-slate-800 h-[45%] rounded-t"></div>
                                    <div className="w-1/6 bg-slate-200 dark:bg-slate-700 h-[60%] rounded-t"></div>
                                    <div className="w-1/6 bg-primary/30 h-[75%] rounded-t"></div>
                                    <div className="w-1/6 bg-primary h-[90%] rounded-t relative group cursor-pointer">
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                            Peaking
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-between text-[10px] text-slate-400 font-mono uppercase">
                                    <span>Mon</span>
                                    <span>Tue</span>
                                    <span>Wed</span>
                                    <span>Thu</span>
                                    <span>Fri</span>
                                    <span>Sat</span>
                                </div>
                            </article>
                        </div>

                        {/* Article Feed */}
                        {articles.map((article, i) => (
                            <div key={i}>
                                <NewsCard article={article} groqApiKey={apiKey} />
                            </div>
                        ))}

                    </MasonryLayout>
                </div>
            </div>
        </main>
    );
}
