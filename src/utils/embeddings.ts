import type { Pipeline } from '@xenova/transformers';

// Cache the pipeline on the Node.js server process (singleton pattern)
let embeddingPipeline: Pipeline | null = null;

/**
 * Generates a 384-dimensional embedding vector for the given text using
 * the all-MiniLM-L6-v2 model running fully locally on the server.
 * The model is downloaded (~23 MB) on first call and cached afterwards.
 */
export async function getEmbedding(text: string): Promise<number[]> {
    if (!embeddingPipeline) {
        // Dynamic import to avoid issues with Next.js bundler (server-only)
        const { pipeline } = await import('@xenova/transformers');
        embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }

    const output = await (embeddingPipeline as any)(text, { pooling: 'mean', normalize: true });
    // output.data is a Float32Array – convert to plain number[]
    return Array.from(output.data as Float32Array);
}

/**
 * Generates embeddings for multiple texts in parallel (batched).
 */
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(t => getEmbedding(t)));
}
