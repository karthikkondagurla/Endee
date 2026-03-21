import { NextResponse } from "next/server";
import { fetchRSS } from "@/utils/fetchRSS";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const rawTopic = searchParams.get("topic");

    if (!rawTopic) {
        return NextResponse.json(
            { error: "Must provide a 'topic' query parameter" },
            { status: 400 }
        );
    }

    try {
        // Use the shared fetchRSS utility which includes OGS metadata (images + descriptions)
        const articles = await fetchRSS([rawTopic]);

        return NextResponse.json({ articles });
    } catch (error) {
        console.error("Error fetching RSS feed:", error);
        return NextResponse.json(
            { error: "Failed to fetch news feed" },
            { status: 500 }
        );
    }
}
