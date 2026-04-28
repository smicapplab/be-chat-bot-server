import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { ChatDto } from './dto/chat-payload.dto';
import OpenAI from 'openai';
import { CaseUtil } from 'src/utils/case-util';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ChatService {
    private model;
    private modelInitialized = false;

    private openai: OpenAI;

    private defaultResponse = `Oops! It seems I'm having trouble generating a response at the moment. 
    This might be due to a temporary issue on my end. Please try asking your question again, or let me know if there's anything else I can assist you with. 
    Thank you for your patience!`;

    constructor(
        private readonly databaseService: DatabaseService,
        @Inject(CACHE_MANAGER)
        private cacheManager: Cache,
        private readonly configService: ConfigService,
    ) {
        this.initializeModel().catch((err) => {
            console.error('Model initialization failed:', err);
        });

        this.openai = new OpenAI({
            apiKey: this.configService.get<string>('OPENAI_API_KEY'),
        });
    }

    private async initializeModel() {
        const TransformersApi = Function('return import("@xenova/transformers")')();
        const { pipeline, env } = await TransformersApi;
        const embeddingModelName = 'Xenova/bge-large-en-v1.5';
        env.allowRemoteModels = true;

        try {
            // Initialize the embedding model
            this.model = await pipeline('feature-extraction', embeddingModelName);
            this.modelInitialized = true;
        } catch (error) {
            console.error("Error initializing models:", error);
            throw error;
        }
    }

    public async generateEmbedding(question: string, answer: string): Promise<number[]> {
        const combinedText = `${question} [SEP] ${answer}`;
        const result = await this.model(combinedText, { pooling: 'mean', normalize: true });
        return Array.from(result.data);
    }

    private personalities = {
        professional: `
      Use a polished, businesslike tone. Be formal, direct, and informative. Avoid slang or overly casual expressions
        `.trim(),

        conversational: `
      Speak naturally and clearly — like you're explaining something to a friend. Be warm, human, and easy to follow, while remaining professional
        `.trim(),

        playful: `
      Be friendly, lighthearted, and upbeat. You can use mild humor or informal phrasing, but still deliver accurate and helpful info
        `.trim(),

        harryPotter: `
      Adopt the tone of a wise and whimsical wizard from the world of Harry Potter and use Harry expressions. You may reference magical terms, speak with curiosity, and weave in charm, but keep answers relevant and helpful
        `.trim(),

        vision: `
      Speak like Vision from Marvel — articulate, composed, and intelligent. Use precise language and subtle wit and use marvel vision expressions. Sound deeply thoughtful and courteous
        `.trim(),

        olaf: `
      Respond with Olaf’s sweet, naive charm. Be bubbly, overly excited, and endearing, and use disney's olaf expressions while still answering the user's questions truthfully and helpfully
        `.trim(),
    };

    private async generateResponse(question: string, result: any[], personality: string, description: string): Promise<any> {
        try {

            // Format the answers into the prompt
            const formattedAnswers = result.map(
                (item, index) =>
                    `${index + 1}.\nQuestion: ${item.question_text}\nAnswer: ${item.answer_text}\nRelevance: ${item.relevance.toFixed(2)}`
            ).join('\n\n');

            const response = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `${this.personalities[personality]} ${description}`.trim(),
                    },
                    {
                        role: 'user',
                        content: `
                            The user asked: "${question}". 
    
                            Below are the possible answers retrieved from an embedding-based similarity search. Combine these answers into a single, coherent, and contextually appropriate response that directly addresses the user's question.
    
                            Here are some previously answered Q&A pairs related to the user's question:
                            ${formattedAnswers}
    
                            Use the most relevant answers to craft a clear, concise, and well-structured response. Do not include irrelevant information. If any information is contradictory, prioritize the more relevant and accurate response.
                        `,
                    },
                ],
                max_tokens: 2000,
                temperature: 0.7,
            });

            return response.choices[0].message?.content.trim();
        } catch (error) {
            console.error(`Failed to generate FAQ: ${error.message}`);
            return this.defaultResponse;
        }
    }

    async getProjectDescription(projectId: number): Promise<string> {
        const defaultDesc = 'You are an internal assistant supporting the Voice team. You assist internal users (not customers) with clear, concise, and context-aware answers related to mortgage, real estate, or financial services. You speak as a member of the team and always use "we," "our," and "us" instead of referring to Bot in third person. If unsure, politely suggest reaching out via our contact page. Contact info is info@gmail.com.'
        try {
            const cached = await this.cacheManager.get<string>(projectId.toString());
            if (cached) return cached;

            const knex = this.databaseService.getKnex();
            const project = await knex("project")
                .select("description")
                .where("id", projectId)
                .first();

            if (project) {
                await this.cacheManager.set(projectId.toString(), project.description, { ttl: 1800 } as any);
                return project.description;
            }

            return defaultDesc
        } catch (error) {
            return defaultDesc;
        }
    }

    async search(dto: ChatDto) {
        const { topic, stage, newMessage, messages, isEnhanced, projectId, userId, sessionId, personality = 'professional' } = dto;

        if (!this.modelInitialized) {
            throw new Error('Embedding model is not initialized');
        }

        const context = messages
            ?.filter((msg) => msg.role === 'user' || msg.role === 'assistant')
            .slice(-5) // Limit context to last 5 messages
            .map((msg) => this.cleanText(msg.content))
            .join(' [SEP] ') || '';

        const input = context ? `${context} [SEP] ${this.cleanText(newMessage)}` : this.cleanText(newMessage);

        const newMessageEmbedding = await this.generateEmbedding(input, '');
        const embeddingArrayString = `[${newMessageEmbedding.join(', ')}]`;
        const knex = this.databaseService.getKnex();

        try {
            const baseQuery = knex('question')
                .select(
                    'id',
                    'question_text',
                    'answer_text',
                    'source',
                    knex.raw('1 - (embedding <=> ?::vector(1024)) as similarity', [embeddingArrayString]),
                    knex.raw('GREATEST(similarity(lower(question_text), lower(?)), similarity(lower(answer_text), lower(?))) as text_similarity', [newMessage, newMessage]),
                    knex.raw('GREATEST(1 - EXTRACT(EPOCH FROM NOW() - created_at)/604800, 0) as recency_score'),
                    knex.raw(`(
              0.65 * (1 - (embedding <=> ?::vector(1024))) +
              0.25 * GREATEST(similarity(lower(question_text), lower(?)), similarity(lower(answer_text), lower(?))) +
              0.10 * GREATEST(1 - EXTRACT(EPOCH FROM NOW() - created_at)/604800, 0)
          ) as relevance`, [embeddingArrayString, newMessage, newMessage])
                );

            // Conditionally add project_id filter
            if (projectId !== null && projectId !== undefined) {
                baseQuery.where('project_id', projectId);
            }

            const cacheKey = `search:${projectId}:${newMessage}`;
            const cached = await this.cacheManager.get<{ success: boolean; response: string; source: string }>(cacheKey);
            if (cached) return cached;

            const results = await baseQuery.orderByRaw(`relevance DESC`).limit(20);
            const threshold = 0.3;
            const filtered = results.filter(r => parseFloat(r.relevance) >= threshold);
            const uniqueMap = new Map<string, any>();
            for (const row of filtered) {
                const key = row.answer_text.trim().toLowerCase();
                if (!uniqueMap.has(key)) {
                    uniqueMap.set(key, row);
                }
            }
            const filteredResults = Array.from(uniqueMap.values()).slice(0, 5);

            const sources = [...new Set(results.map(item => item.source))];
            let response = "";
            if (filteredResults.length === 0) {
                return { success: false, response: "I'm sorry, I couldn't find an exact answer to your question at the moment. Please feel free to rephrase it, or contact our support team — we're here to help!" };
            }

            if (isEnhanced) {
                const description = await this.getProjectDescription(projectId)
                response = await this.generateResponse(newMessage, filteredResults, personality, description)
            } else {
                response = filteredResults[0].answer_text
            }
            
            // save history
            let finalSessionId = sessionId
            if (projectId) {
                finalSessionId = await this.saveHistory(topic, stage, JSON.stringify(sources), newMessage, response, projectId, userId, sessionId, personality);
            }

            //await this.cacheManager.set(cacheKey, { success: true, response, source: JSON.stringify(sources) }, { ttl: 1800 });
            return { success: true, response, source: JSON.stringify(sources), sessionId: finalSessionId };
        } catch (error) {
            console.error('Error querying questions by relevance:', error);
            throw new Error('Failed to perform relevance search');
        }
    }

    async saveHistory(
        topic: string,
        stage: string,
        source: string,
        question: string,
        answer: string,
        projectId: number | null,
        userId: number | null,
        sessionId: number | null,
        personality: string,
    ): Promise<number> {
        try {
            const knex = this.databaseService.getKnex();
            let finalSessionId = sessionId;
            if (!sessionId) {
                const [newSession] = await knex('session')
                    .insert({
                        title: question,
                        user_id: userId ?? null,
                    })
                    .returning(['id']);

                finalSessionId = newSession.id;
            }

            const embedding = await this.generateEmbedding(question, answer)
            const embeddingArrayString = `[${embedding.join(',')}]`;

            await knex('chat').insert({
                topic,
                stage,
                source,
                question_text: question,
                answer_text: answer,
                project_id: projectId ?? null,
                user_id: userId ?? null,
                session_id: finalSessionId,
                embedding: knex.raw('?::vector(1024)', [embeddingArrayString]),
                personality,
            });

            return finalSessionId;
        } catch (error) {
            console.error(error);
        }
    }

    async getSessionByTitle(title: string): Promise<any | null> {
        const knex = this.databaseService.getKnex();
        try {
            const session = await knex('session')
                .select('*')
                .where('title', title)
                .orderBy('created_at', 'desc')
                .first();

            if (!session) {
                return null;
            }

            return CaseUtil.keysToCamelCase(session);

        } catch (error) {
            throw error;
        }
    }

    async getSessionById(id: number): Promise<any | null> {
        const knex = this.databaseService.getKnex();
        try {
            const session = await knex('session')
                .select('*')
                .where('id', id)
                .orderBy('created_at', 'desc')
                .first();

            if (!session) {
                return null;
            }

            const chats = await knex('chat')
                .select(
                    'id',
                    'topic',
                    'stage',
                    'source',
                    'question_text',
                    'answer_text',
                    'created_at',
                    'personality',
                )
                .where('session_id', session.id)
                .orderBy('created_at', 'desc');

            return CaseUtil.keysToCamelCase({
                ...session,
                chats,
            });

        } catch (error) {
            throw error;
        }
    }

    async getRecentSessionsByUser(userId: number): Promise<any[]> {
        const knex = this.databaseService.getKnex();
        const sessions = await knex('session')
            .select('id', 'title', 'user_id', 'created_at')
            .where('user_id', userId)
            .orderBy('created_at', 'desc')
            .limit(20);
        return sessions;
    }

    cleanText(input?: string): string {
        return (input ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    }

    async searchSessionByKeyword(keyword: string): Promise<any[]> {
        const knex = this.databaseService.getKnex();
        try {
            const input = this.cleanText(keyword);
            const keywordEmbedding = await this.generateEmbedding(input, '');
            const embeddingArrayString = `[${keywordEmbedding.join(', ')}]`;

            const results = await knex('chat')
                .select('session_id')
                .groupBy('session_id')
                .orderByRaw('MIN(embedding <=> ?::vector(1024))', [embeddingArrayString]) // most similar first
                .limit(20);

            const sessionIds = results.map(r => r.session_id);
            const sessions = await knex('session')
                .select('*')
                .whereIn('id', sessionIds);

            return sessions
        } catch (error) {
            console.error('Error in searchSessionByKeyword:', error);
            throw error;
        }
    }

    async getAllSessions(searchText: string, page: number): Promise<any[]> {
        const knex = this.databaseService.getKnex();
        let embeddingArrayString = null;
        const limit = 10;
        const offset = (page - 1) * limit;

        try {
            if (searchText && searchText.trim()) {
                const cleanedSearchText = this.cleanText(searchText);
                const newMessageEmbedding = await this.generateEmbedding(cleanedSearchText, '');
                embeddingArrayString = `[${newMessageEmbedding.join(', ')}]`;
            }

            let chatQuery = knex
                .select(
                    'chat.session_id',
                    'chat.question_text',
                    'chat.answer_text'
                )
                .from('chat');

            if (embeddingArrayString) {
                chatQuery.select(
                    knex.raw('1 - (chat.embedding <=> ?::vector(1024)) as vector_similarity', [embeddingArrayString]),
                    knex.raw(`GREATEST(
                        similarity(lower(chat.question_text), lower(?)), 
                        similarity(lower(chat.answer_text), lower(?))
                    ) as text_similarity`, [searchText, searchText])
                );
            }

            const query = knex
                .select(
                    'session.id',
                    'session.title',
                    'session.created_at as createDate',
                    knex.raw("app_user.first_name || ' ' || app_user.last_name as author")
                )
                .from('session')
                .join('app_user', 'app_user.id', '=', 'session.user_id')
                .leftJoin(chatQuery.as('chat_metrics'), 'session.id', 'chat_metrics.session_id');

            if (embeddingArrayString) {
                query.select(
                    knex.raw('MAX(chat_metrics.vector_similarity) as similarity'),
                    knex.raw('MAX(chat_metrics.text_similarity) as textSimilarity'),
                    knex.raw(`(
                        0.7 * MAX(chat_metrics.vector_similarity) +
                        0.3 * MAX(chat_metrics.text_similarity)
                    ) as relevance`)
                );
            }

            query.groupBy(
                'session.id',
                'session.title',
                'session.created_at',
                'author'
            );

            if (embeddingArrayString) {
                query.orderBy('relevance', 'desc');
            } else {
                query.orderBy('session.created_at', 'desc');
            }

            query.limit(limit).offset(offset);

            const sessions = await query;

            const threshold = 0.5;
            if (embeddingArrayString) {
                return sessions.filter(q => {
                    const relevanceValue = parseFloat(String(q.relevance || 0));
                    return !isNaN(relevanceValue) && relevanceValue >= threshold;
                });
            }

            return sessions;
        } catch (error) {
            console.error('Error in getAllSessions:', error);
            throw error;
        }
    }
}
