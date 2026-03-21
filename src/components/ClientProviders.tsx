"use client";

import React, { ReactNode } from "react";
import { ReaderProvider } from "@/context/ReaderContext";
import ReaderModal from "@/components/ReaderModal/ReaderModal";

export default function ClientProviders({ children }: { children: ReactNode }) {
    return (
        <ReaderProvider>
            {children}
            <ReaderModal />
        </ReaderProvider>
    );
}
