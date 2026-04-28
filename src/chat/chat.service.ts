import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { ChatDto } from './dto/chat-payload.dto';
import OpenAI from 'openai';
import { CaseUtil } from 'src/utils/case-util';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { EmbeddingService } from 'src/embedding/embedding.service';
import { TextUtil } from 'src/utils/text-util';
import { CHAT_SYSTEM_PROMPT, CHAT_USER_PROMPT } from 'src/common/constants/prompts';

/**
 * Service handling chat operations, AI response generation, and search.
 */
@Injectable()
export class ChatService {
    private openai: OpenAI;

    private defaultResponse = `Oops! It seems I'm having trouble generating a response at the moment. 
    This might be due to a temporary issue on my end. Please try asking your question again, or let me know if there's anything else I can assist you with. 
    Thank you for your patience!`;

    constructor(
        private readonly databaseService: DatabaseService,
        @Inject(CACHE_MANAGER)
        private cacheManager: Cache,
        private readonly configService: ConfigService,
        private readonly embeddingService: EmbeddingService,
    ) {
        this.openai = new OpenAI({
            apiKey: this.configService.get<string>('OPENAI_API_KEY'),
        });
    }

    /**
     * Generates a chat response using OpenAI based on the provided question and context results.
     * @param question The user's question.
     * @param result Context results from the database.
     * @param personality Desired personality of the AI.
     * @param description Project description.
     * @returns AI-generated response string.
     */
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
                        content: CHAT_SYSTEM_PROMPT(personality, description),
                    },
                    {
                        role: 'user',
                        content: CHAT_USER_PROMPT(question, formattedAnswers),
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

    /**
     * Retrieves the description for a project, with caching support.
     * @param projectId ID of the project.
     * @returns Project description string.
     */
    async getProjectDescription(projectId: number): Promise<string> {
        const supportEmail = this.configService.get<string>('SUPPORT_EMAIL') || 'info@gmail.com';
        const defaultDesc = `You are an internal assistant supporting the Voice team. You assist internal users (not customers) with clear, concise, and context-aware answers related to mortgage, real estate, or financial services. You speak as a member of the team and always use "we," "our," and "us" instead of referring to Bot in third person. If unsure, politely suggest reaching out via our contact page. Contact info is ${supportEmail}.`
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

    /**
     * Performs a semantic search for the user's message and returns relevant answers or an AI-generated response.
     * @param dto Chat data including message, project, and session details.
     * @returns Search results including the response and sources.
     */
    async search(dto: ChatDto) {
        const { topic, stage, newMessage, messages, isEnhanced, projectId, userId, sessionId, personality = 'professional' } = dto;

        const context = messages
            ?.filter((msg) => msg.role === 'user' || msg.role === 'assistant')
            .slice(-5) // Limit context to last 5 messages
            .map((msg) => TextUtil.cleanText(msg.content))
            .join(' [SEP] ') || '';

        const input = context ? `${context} [SEP] ${TextUtil.cleanText(newMessage)}` : TextUtil.cleanText(newMessage);

        const newMessageEmbedding = await this.embeddingService.generateEmbedding(input, '');
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
          ) as relevance`, [embeddingArrayString, newMessage, newMessage, embeddingArrayString, newMessage, newMessage])
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

    /**
     * Saves chat history and creates a new session if necessary.
     * @returns The ID of the session.
     */
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

            const embedding = await this.embeddingService.generateEmbedding(question, answer)
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

    /**
     * Retrieves a chat session by its title.
     * @param title Session title.
     * @returns The session object or null.
     */
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

    /**
     * Retrieves a chat session and its associated chats by session ID.
     * @param id Session ID.
     * @returns The session object with chats or null.
     */
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

    /**
     * Retrieves recent chat sessions for a given user.
     * @param userId User ID.
     * @returns List of recent sessions.
     */
    async getRecentSessionsByUser(userId: number): Promise<any[]> {
        const knex = this.databaseService.getKnex();
        const sessions = await knex('session')
            .select('id', 'title', 'user_id', 'created_at')
            .where('user_id', userId)
            .orderBy('created_at', 'desc')
            .limit(20);
        return sessions;
    }

    /**
     * Searches for chat sessions based on a keyword using semantic similarity.
     * @param keyword Search keyword.
     * @returns List of matching sessions.
     */
    async searchSessionByKeyword(keyword: string): Promise<any[]> {
        const knex = this.databaseService.getKnex();
        try {
            const input = TextUtil.cleanText(keyword);
            const keywordEmbedding = await this.embeddingService.generateEmbedding(input, '');
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

    /**
     * Retrieves all chat sessions with optional semantic search and pagination.
     * @param searchText Search text for filtering.
     * @param page Page number for pagination.
     * @returns List of sessions.
     */
    async getAllSessions(searchText: string, page: number): Promise<any[]> {
        const knex = this.databaseService.getKnex();
        let embeddingArrayString = null;
        const limit = 10;
        const offset = (page - 1) * limit;

        try {
            if (searchText && searchText.trim()) {
                const cleanedSearchText = TextUtil.cleanText(searchText);
                const newMessageEmbedding = await this.embeddingService.generateEmbedding(cleanedSearchText, '');
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
