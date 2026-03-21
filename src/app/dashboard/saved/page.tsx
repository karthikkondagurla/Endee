import Link from "next/link";
import NewsCard, { Article } from "@/components/NewsCard";
import MasonryLayout from "@/components/MasonryLayout";

export default async function SavedArticlesPage() {
    const breakpointColumnsObj = {
        default: 3,
        1024: 2,
        768: 1
    };

    // Fetch the user's profile to get their saved_articles and API key locally
    let rawSavedArticles = [];
    let apiKey = "";

    try {
        if (typeof window !== "undefined") {
            const storedArticles = localStorage.getItem("saved_articles");
            if (storedArticles) {
                rawSavedArticles = JSON.parse(storedArticles);
            }
            apiKey = localStorage.getItem("groq_api_key") || "";
        }
    } catch (err) {
        console.error("Error reading saved articles", err);
    }

    // Sort so newest saved are first (assuming they are appended to the array originally)
    // If they have publish dates, we can sort by that instead
    const savedArticles = [...rawSavedArticles].reverse();

    return (
        <main className="flex-1 overflow-y-auto relative h-full">
            {/* Sticky Header Context */}
            <div className="sticky top-0 z-30 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-8 py-4 flex items-center justify-between transition-all duration-300">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                        <Link href="/dashboard" className="hover:text-primary transition-colors">Home</Link>
                        <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                        <span className="text-slate-900 dark:text-white font-medium">Saved Collection</span>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">Saved Articles</h1>
                </div>

                <div className="flex items-center gap-3">
                    <button className="p-2 text-slate-500 hover:text-primary hover:bg-primary/10 rounded-full transition-colors" title="Search Saved">
                        <span className="material-symbols-outlined">search</span>
                    </button>
                </div>
            </div>

            <div className="max-w-5xl mx-auto p-8 space-y-10 pb-20">

                {/* Header Description */}
                <div className="mb-8">
                    <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed max-w-2xl">
                        Your personal reading list. Articles saved here are available for deep AI analysis and referencing.
                    </p>
                </div>

                {/* Filtered Stream Layout */}
                <div className="space-y-4">
                    <div className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                        <button className="text-sm font-bold text-slate-900 dark:text-white border-b-2 border-primary pb-2 -mb-2.5">All Saved</button>
                        <button className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 transition-colors pb-2">AI Summarized</button>
                    </div>

                    {savedArticles.length === 0 ? (
                        <div className="py-20 flex flex-col items-center justify-center text-center">
                            <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-700 mb-4">bookmarks</span>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No articles saved yet</h3>
                            <p className="text-slate-500 max-w-md">
                                When you read an interesting article, click the "Save Article" button in the reader to add it to your collection.
                            </p>
                            <Link href="/dashboard" className="mt-6 px-6 py-2.5 bg-primary text-white rounded-full font-bold shadow-subtle hover:shadow-float transition-all">
                                Discover News
                            </Link>
                        </div>
                    ) : (
                        <MasonryLayout
                            breakpointCols={breakpointColumnsObj}
                            className="pigeon-masonry-grid"
                            columnClassName="pigeon-masonry-grid_column"
                        >
                            {/* Article Feed */}
                            {savedArticles.map((article: Article, i: number) => (
                                <div key={`${article.link}-${i}`}>
                                    <NewsCard article={article} groqApiKey={apiKey} />
                                </div>
                            ))}
                        </MasonryLayout>
                    )}
                </div>
            </div>
        </main>
    );
}
