import { NextResponse } from 'next/server';
import { getArticleIndex } from '@/utils/endeeClient';

/**
 * GET /api/endee/init
 * Ensures the pigeon_articles index exists in Endee.
 * Called once when the dashboard loads.
 */
export async function GET() {
    try {
        await getArticleIndex();
        return NextResponse.json({ ok: true, message: 'Endee index ready.' });
    } catch (err: any) {
        console.warn('[Endee] Server unreachable during init:', err.message);
        return NextResponse.json(
            { ok: false, error: 'Endee server is not running.' },
            { status: 503 }
        );
    }
}
