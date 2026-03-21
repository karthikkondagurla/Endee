"use client";

import { useState } from "react";
import { Search } from "lucide-react";

interface SearchBarProps {
    onAddTopic: (topic: string) => void;
    isLoading?: boolean;
}

export default function SearchBar({ onAddTopic, isLoading = false }: SearchBarProps) {
    const [query, setQuery] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = query.trim();
        if (trimmed && !isLoading) {
            onAddTopic(trimmed);
            setQuery("");
        }
    };

    return (
        <form onSubmit={handleSubmit} className="relative w-full max-w-2xl">
            <Search
                size={20}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors"
            />
            <input
                type="text"
                placeholder="Search topics (e.g. Lithium, AI, Shipping...)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={isLoading}
                className="w-full pl-12 pr-24 py-2.5 rounded-full bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200/60 dark:border-slate-700/60 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all shadow-inner text-[14px] disabled:opacity-50 disabled:cursor-not-allowed group"
            />
            <button
                type="submit"
                disabled={!query.trim() || isLoading}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 px-5 py-1.5 rounded-full text-[13px] font-bold transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isLoading ? "Adding..." : "Add"}
            </button>
        </form>
    );
}
