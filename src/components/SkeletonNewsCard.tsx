"use client";

export default function SkeletonNewsCard() {
    return (
        <article className="break-inside-avoid bg-white dark:bg-card-dark rounded-2xl shadow-subtle border border-slate-100 dark:border-slate-800 p-5 overflow-hidden animate-pulse">
            <div className="flex justify-between items-start mb-3">
                <div className="h-6 w-20 bg-slate-200 dark:bg-slate-700 rounded-md"></div>
            </div>

            <div className="space-y-3 mb-4">
                <div className="h-6 w-3/4 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                <div className="h-6 w-1/2 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
            </div>

            <div className="space-y-2 mb-6">
                <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded"></div>
                <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded"></div>
                <div className="h-4 w-2/3 bg-slate-100 dark:bg-slate-800 rounded"></div>
            </div>

            <div className="flex items-center gap-2 mt-auto">
                <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded"></div>
                <div className="h-3 w-3 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                <div className="h-3 w-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
            </div>
        </article>
    );
}
