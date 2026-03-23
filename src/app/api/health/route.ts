import { NextResponse } from 'next/server';

/**
 * GET /api/health
 * Used by Docker healthcheck and container orchestrators.
 * Returns a simple JSON with status, uptime, and environment.
 */
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        service: 'pigeon-app',
        uptime: Math.floor(process.uptime()),
        nodeEnv: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
    });
}
