import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse';
import { QuestionResponseDto } from './dto/question.dto';
@Injectable()
export class UploadService {

    private model;
    private modelInitialized = false;

    constructor(
        private readonly databaseService: DatabaseService,
    ) {
        this.initializeModel().catch((err) => {
            console.error('Model initialization failed:', err);
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

    async uploadMulti(projectId: number, file: Express.Multer.File, user: any): Promise<void> {
        if (!this.modelInitialized) {
            throw new Error('Model not initialized');
        }

        try {
            const knex = this.databaseService.getKnex();
            const [insertedRow] = await knex('upload_history').insert({
                file_name: file.filename,
                uploaded_by: user.id,
                status: "Pending",
                project_id: projectId
            }).returning(['id']);

            const filePath = path.resolve(file.path);
            // Simulate file processing
            setImmediate(async () => {
                try {
                    // Read the file data
                    const fileData = fs.readFileSync(filePath);
                    // Process the CSV data in the background
                    await this.processCsvDataInBackground(projectId, fileData, insertedRow, user.id);

                    // Ensure the file exists before deleting
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath); // Delete the file after processing
                    } else {
                        console.error('File does not exist:', filePath);
                    }
                } catch (error) {
                    console.error('Error during file processing:', error);
                }
            });


        } catch (error) {
            console.error('Error during upload:', error.message);
            throw new Error('Failed to upload file');
        }

    }

    public async generateEmbedding(question: string, answer: string): Promise<number[]> {
        const combinedText = `${question} [SEP] ${answer}`;
        const result = await this.model(combinedText, { pooling: 'mean', normalize: true });
        return Array.from(result.data);
    }

    // Background processing function
    private async processCsvDataInBackground(projectId: number, data: Uint8Array, uploadHistory: any, userId: number) {
        const knex = this.databaseService.getKnex();
        try {
            const csvBuffer = Buffer.from(data); // If it's already a Uint8Array
            const parser = parse(csvBuffer, {
                columns: true,
                skip_empty_lines: true,
                relax_column_count: true,
                trim: true,
            });

            let line = 1;
            for await (const record of parser) {
                const { question, answer, stage, topic, source } = record;

                if (question && answer) {
                    if (["question", "query"].includes(question) || answer === "answer") {
                    } else {
                        console.log(line++, " : ", question)
                        const embedding: number[] = await this.generateEmbedding(question, answer);
                        await knex('question').insert({
                            question_text: question,
                            answer_text: answer,
                            embedding: knex.raw(`ARRAY[${embedding.join(',')}]::vector(1024)`),
                            upload_id: uploadHistory.id,
                            created_by: userId,
                            updated_by: userId,
                            project_id: projectId,
                            ...(stage ? { stage } : {}),
                            ...(topic ? { topic } : {}),
                            ...(source ? { source } : {}),
                        });

                    }
                }
            }

            await knex('upload_history')
                .update({
                    status: 'Done'
                })
                .where("id", uploadHistory.id)

        } catch (error) {
            await knex('upload_history')
                .update({
                    status: 'Errored'
                })
                .where("id", uploadHistory.id)

            console.error('Error processing CSV in background:', error.message);
        }
    }

    cleanText(input?: string): string {
        return (input ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    }

    async getUploadQuestions(
        fileHistId: number,
        searchText?: string,
        page: number = 1,
        limit: number = 10
    ): Promise<{ questions: QuestionResponseDto[]; total: number }> {
        try {
            const knex = this.databaseService.getKnex();
            let embeddingString = null;
            
            if (searchText && searchText.trim()) {
                const cleanedSearchText = this.cleanText(searchText);
                const newMessageEmbedding = await this.generateEmbedding(cleanedSearchText, '');
                embeddingString = `ARRAY[${newMessageEmbedding.join(', ')}]::vector(1024)`;
            }
    
            let baseQuery = knex('upload_history')
                .join('question', 'question.upload_id', '=', 'upload_history.id')
                .where('question.upload_id', fileHistId);
    
            let query = baseQuery.clone().select({
                fileId: 'upload_history.id',
                fileName: 'upload_history.file_name',
                id: 'question.id',
                question: 'question.question_text',
                answer: 'question.answer_text',
            });
            
            if (embeddingString) {
                query = query.select({
                    similarity: knex.raw(`1 - (embedding <=> ${embeddingString})`),
                    textSimilarity: knex.raw(`GREATEST(
                        similarity(lower(question_text), lower(?)), 
                        similarity(lower(answer_text), lower(?))
                    )`, [searchText, searchText]),
                    relevance: knex.raw(`(
                        0.7 * (1 - (embedding <=> ${embeddingString})) +
                        0.3 * GREATEST(
                            similarity(lower(question_text), lower(?)), 
                            similarity(lower(answer_text), lower(?))
                        )
                    )`, [searchText, searchText])
                });

                query = query.orderBy('relevance', 'desc');
            } else {
                query = query.orderBy('question.id', 'asc');
            }
    
            const countQuery = baseQuery.clone().count('question.id as total');
    
            const offset = (page - 1) * limit;
            query = query.offset(offset).limit(limit);
    
            const [questions, totalResult] = await Promise.all([
                query,
                countQuery.first()
            ]);
    
            const total = totalResult ? Number(totalResult.total) : 0;

            const threshold = 0.3; 
            let filteredQuestions = questions;
            
            if (embeddingString) {
                filteredQuestions = questions.filter(q => {
                    if ('relevance' in q && q.relevance !== undefined) {
                        const relevanceValue = typeof q.relevance === 'number'
                            ? q.relevance
                            : parseFloat(String(q.relevance));
                        return !isNaN(relevanceValue) && relevanceValue >= threshold;
                    }
                    return false; // No relevance property means it doesn't meet the threshold
                });

                if (filteredQuestions.length === 0 && total > 0) {
                    console.log("All results filtered due to low relevance");
                }
            }

            console.log(`Found ${total} questions, returning page ${page} (${filteredQuestions.length} items)`);
            return {
                questions: filteredQuestions,
                total: embeddingString ? filteredQuestions.length : total
            };
        } catch (error) {
            console.error("Error in getUploadQuestions:", error);
            throw new Error(`Failed to retrieve questions: ${error.message}`);
        }
    }

    async deleteUploadQuestions(fileHistId: number): Promise<{ success: boolean; message?: string }> {
        try {
            const knex = this.databaseService.getKnex();

            const deletedCount = await knex.transaction(async (trx) => {
                const res = await trx('question')
                    .where('upload_id', fileHistId)
                    .del();
                await trx('upload_history').where('id', fileHistId).del();
                return res;
            });

            console.log(`Successfully deleted ${deletedCount} questions with file historty upload_id ${fileHistId}`)
            return { success: true, message: `Successfully deleted file history including all ${deletedCount} questions` };
        } catch (error) {
            console.error(`Error deleting questions with upload_id ${fileHistId}:`, error);
            return {
                success: false,
                message: `Failed to delete questions: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
}
