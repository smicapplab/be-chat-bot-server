import { Injectable, OnModuleInit } from '@nestjs/common';

/**
 * Service for generating text embeddings using transformers.
 */
@Injectable()
export class EmbeddingService implements OnModuleInit {
    private model: any;
    private modelInitialized = false;

    async onModuleInit() {
        await this.initializeModel();
    }

    /**
     * Initializes the embedding model using @xenova/transformers.
     */
    private async initializeModel() {
        if (this.modelInitialized) return;

        try {
            const TransformersApi = await Function('return import("@xenova/transformers")')();
            const { pipeline, env } = TransformersApi;
            const embeddingModelName = 'Xenova/bge-large-en-v1.5';
            env.allowRemoteModels = true;

            console.log(`[EmbeddingService] Initializing model: ${embeddingModelName}`);
            this.model = await pipeline('feature-extraction', embeddingModelName);
            this.modelInitialized = true;
            console.log(`[EmbeddingService] Model initialized successfully.`);
        } catch (error) {
            console.error("[EmbeddingService] Error initializing models:", error);
            throw error;
        }
    }

    /**
     * Generates an embedding vector for the provided text(s).
     * @param text1 Primary text.
     * @param text2 Optional secondary text to be combined with [SEP].
     * @returns Array of numbers representing the embedding.
     */
    async generateEmbedding(text1: string, text2: string = ''): Promise<number[]> {
        if (!this.modelInitialized) {
            await this.initializeModel();
        }
        
        const combinedText = text2 ? `${text1} [SEP] ${text2}` : text1;
        const result = await this.model(combinedText, { pooling: 'mean', normalize: true });
        return Array.from(result.data);
    }
}
