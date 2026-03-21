"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { Article } from "@/components/NewsCard";

interface ReaderContextProps {
    isReaderOpen: boolean;
    currentArticle: Article | null;
    groqApiKey?: string;
    openReader: (article: Article, groqApiKey?: string) => void;
    closeReader: () => void;
}

const ReaderContext = createContext<ReaderContextProps | undefined>(undefined);

export function ReaderProvider({ children }: { children: ReactNode }) {
    const [isReaderOpen, setIsReaderOpen] = useState(false);
    const [currentArticle, setCurrentArticle] = useState<Article | null>(null);
    const [groqApiKey, setGroqApiKey] = useState<string | undefined>(undefined);

    const openReader = (article: Article, key?: string) => {
        setCurrentArticle(article);
        setGroqApiKey(key);
        setIsReaderOpen(true);
    };

    const closeReader = () => {
        setIsReaderOpen(false);
        // We don't immediately clear the article to allow for exit animations if needed
        setTimeout(() => setCurrentArticle(null), 300);
    };

    return (
        <ReaderContext.Provider value={{ isReaderOpen, currentArticle, groqApiKey, openReader, closeReader }}>
            {children}
        </ReaderContext.Provider>
    );
}

export function useReader() {
    const context = useContext(ReaderContext);
    if (!context) {
        throw new Error("useReader must be used within a ReaderProvider");
    }
    return context;
}
