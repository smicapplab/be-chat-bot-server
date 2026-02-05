import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DatabaseService } from 'src/database/database.service';
import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument } from 'pdf-lib';
import { FeatureType, StartDocumentAnalysisCommand, StartDocumentAnalysisCommandOutput, StartDocumentTextDetectionCommand, StartDocumentTextDetectionCommandOutput, TextractClient } from '@aws-sdk/client-textract';
import { SqsUtil } from 'src/utils/sqs-util';
import * as mammoth from 'mammoth';
import { OpenAI } from 'openai';
import { DocExtractContenUpdateDto, DocExtractDto, TrainingResponseDto } from './dto/training.dto';
import * as csv from 'fast-csv';
import { Response } from 'express';
import mime from 'mime-types';

const pLimit = require('p-limit');


@Injectable()
export class DocTrainService {
    private textractClient: TextractClient;
    private s3Client: S3Client;
    private readonly region = 'ap-southeast-1';

    private chatSourceFolder = "chat-source";
    private chatTrainFolder = "chat-train";

    private openaiKey: string;
    private openai: OpenAI;

    constructor(
        private readonly databaseService: DatabaseService,
    ) {
        const credentials = {
            accessKeyId: process.env.PRI_AWS_ACCESS_KEY,
            secretAccessKey: process.env.PRI_AWS_SECRET_KEY,
        }
        this.s3Client = new S3Client({
            region: this.region,
            credentials
        });

        this.textractClient = new TextractClient({
            region: this.region,
            credentials
        });

        this.openaiKey = process.env.OPENAI_API_KEY;
        this.openai = new OpenAI({
            apiKey: this.openaiKey, // Ensure this environment variable is set
        });

    }

    async uploadForTraining(file: Express.Multer.File, description: string, user: any): Promise<void> {
        try {
            setImmediate(async () => {
                try {
                    if (file.filename.endsWith("pdf")) {
                        await this.splitPdfFiles(file, description, user)
                    }

                    const ext = path.extname(file.filename).toLowerCase();
                    if ([".docx", ".doc"].includes(ext)) {
                        await this.processDocForQa(file, description, user);
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

    private cleanResponse = (response) => {
        // Remove common prefixes and suffixes
        return response.replace(/^'''json|```json|```|'''/g, "").trim();
    };

    private parseJSON = (response) => {
        try {
            const cleanedResponse = this.cleanResponse(response);
            return JSON.parse(cleanedResponse);
        } catch (error) {
            console.error("Error parsing JSON:", error.message);
            console.error("Raw Response:", response);
            return null; // Return null or handle the error as needed
        }
    };

    private processDocument = async (text: string, description: string) => {
        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-4o-mini", // gpt-4o Or "gpt-4o-mini" if you want faster and cheaper
                messages: [
                    {
                        role: 'system',
                        content: `
                        You are an AI assistant helping a mortgage company build a chatbot.
                        
                        You will receive the full text content from one page of a ${description ?? 'This is a seller guide for mortgage brokers detailing the eligibility requirements, documentation, and submission process for home loan funding.'}
                        
                        Your task is to:
                        1. Summarize the content of the page in 2–3 sentences.
                        2. Generate **relevant customer-style question-and-answer pairs** that someone might ask based on the document.

                        - Only generate questions that can be answered **directly from the content provided**.  
                        - Do **not invent or guess answers**.  
                        - If the page is dense, you may generate **up to 20 Q&A pairs**.  
                        - If there is less content, it's okay to return fewer — just ensure all are useful and factual.

                        Output in this JSON format:
                        {
                          "summary": "string",
                          "qa": [
                            { "q": "customer-style question here", "a": "document-based answer here" },
                            ...
                          ]
                        }
                        Do not invent answers. Only generate questions that can be answered from the provided text.
                              `.trim()
                    },
                    {
                        role: 'user',
                        content: text
                    }
                ],
                temperature: 0.3,
                max_tokens: 1000
            });

            const openaiResponse = response.choices[0].message.content;
            const parsedData = this.parseJSON(openaiResponse);
            return parsedData;
        } catch (error) {
            console.error("Error classifying document with OpenAI:", error);
            throw error;
        }
    };

    async processDocForQa(file: Express.Multer.File, description: string, user: any): Promise<void> {
        const knex = this.databaseService.getKnex();
        const sourceFileName = `${Date.now()}-${file.originalname}`
        try {
            const filePath = path.resolve(file.path);
            const fileData = fs.readFileSync(filePath);
            const contentType = mime.lookup(file.originalname) || 'application/octet-stream';
            const sourceUploadParams = {
                Bucket: process.env.AWS_PORTAL_BUCKET,
                Key: `${this.chatSourceFolder}/${sourceFileName}`,
                Body: fileData,
                ContentType: contentType,
            };

            await this.s3Client.send(new PutObjectCommand(sourceUploadParams));
            const [trainingId] = await knex("doc_training")
                .insert({
                    user_id: user.id,
                    stage: "INIT",
                    summary: null,
                    file_name: sourceFileName,
                    description,
                    pages: 0
                })
                .returning("id");

            const { value: fullText } = await mammoth.extractRawText({ buffer: fileData });
            const chunks = this.splitTextForOpenAI(fullText, 3000);

            let docSummary: string;
            for (let i = 0; i < chunks.length; i++) {
                const { summary, qa } = await this.processDocument(chunks[i], description);
                if (!docSummary) {
                    docSummary = summary
                }

                await knex('doc_extract')
                    .insert({
                        doc_training_id: trainingId.id ?? trainingId,
                        user_id: user.id,
                        job_id: `doc-${Date.now()}-${i + 1}`,
                        status: 'DONE',
                        summary,
                        file_name: sourceFileName,
                        generated_content: knex.raw('?::jsonb', [JSON.stringify(qa)]),
                        blocks: null,
                    })
            }

            await knex('doc_training')
                .where('id', trainingId.id ?? trainingId)
                .update({ stage: 'DONE' });

            fs.unlinkSync(filePath);
            console.log("Document processed...")
        } catch (error) {
            console.error(error)
        }
    }

    private splitTextForOpenAI(text: string, maxWords: number): string[] {
        const sentences = text.split(/(?<=[.?!])\s+/);
        const chunks: string[] = [];
        let currentChunk = '';

        for (const sentence of sentences) {
            const wordCount = (currentChunk + sentence).split(' ').length;
            if (wordCount > maxWords) {
                chunks.push(currentChunk.trim());
                currentChunk = sentence;
            } else {
                currentChunk += ' ' + sentence;
            }
        }

        if (currentChunk) chunks.push(currentChunk.trim());
        return chunks;
    }


    async startTextExtractAsync({
        fileName,
        bucket,
    }): Promise<StartDocumentTextDetectionCommandOutput> {
        try {
            const input = {
                DocumentLocation: {
                    S3Object: {
                        Bucket: bucket,
                        Name: fileName,
                    },
                },
            };

            const command = new StartDocumentTextDetectionCommand(input);
            const data = await this.textractClient.send(command);
            return data;
        } catch (err) {
            console.error(err);
            return null;
        }
    }

    async startTextExtractAnalysisAsync({
        fileName,
        featureTypes = [FeatureType.FORMS, FeatureType.TABLES],
        bucket,
    }): Promise<StartDocumentAnalysisCommandOutput> {
        try {
            let FeatureTypes = featureTypes;
            const input = {
                DocumentLocation: {
                    S3Object: {
                        Bucket: bucket,
                        Name: fileName,
                    },
                },
                FeatureTypes,
            };

            const command = new StartDocumentAnalysisCommand(input);
            const data = await this.textractClient.send(command);
            return data;
        } catch (err) {
            console.error(err);
            return null;
        }
    }

    async splitPdfFiles(file: Express.Multer.File, description: string, user: any): Promise<void> {
        const knex = this.databaseService.getKnex();
        const filePath = path.resolve(file.path);
        try {
            const fileData = fs.readFileSync(filePath);
            const pdfDoc = await PDFDocument.load(fileData);
            const totalPages = pdfDoc.getPageCount();
            const sourceFileName = `${Date.now()}-${file.originalname}`;

            const [trainingId] = await knex("doc_training")
                .insert({
                    user_id: user.id,
                    stage: "INIT",
                    summary: null,
                    file_name: sourceFileName,
                    description,
                    pages: totalPages
                })
                .returning("id");

            let delayPerRec = 0;
            for (let i = 0; i < totalPages; i++) {
                const newPdf = await PDFDocument.create();
                const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
                newPdf.addPage(copiedPage);

                const splitKey = `${this.chatTrainFolder}/${trainingId.id ?? trainingId}/${file.filename}-${i + 1}.pdf`;
                const pdfBytes = await newPdf.save();

                const uploadParams = {
                    Bucket: process.env.AWS_PORTAL_BUCKET,
                    Key: splitKey,
                    Body: pdfBytes,
                    ContentType: 'application/pdf',
                };

                // Upload synchronously to ensure object is present in S3
                await this.s3Client.send(new PutObjectCommand(uploadParams));

                console.log("Trigger Extract", splitKey)
                // Now trigger Textract
                const result = await this.startTextExtractAsync({
                    fileName: splitKey,
                    bucket: process.env.AWS_PORTAL_BUCKET,
                });

                if (result?.JobId) {
                    await knex("doc_extract").insert({
                        doc_training_id: trainingId.id ?? trainingId,
                        job_id: result.JobId,
                        user_id: user?.id || null,
                        status: "PENDING",
                        summary: null,
                        file_name: `${file.filename}-${i + 1}.pdf`,
                        generated_content: null,
                    });

                    await SqsUtil.sendSQSMessage(
                        {
                            docTrainingId: trainingId.id ?? trainingId,
                            jobId: result.JobId,
                            description,
                        },
                        "process-pdf",
                        process.env.SQS_CHAT_QUEUE,
                        100 + delayPerRec
                    )

                    delayPerRec += 5
                    if (delayPerRec > 600) {
                        delayPerRec = 60
                    }
                }
            }

            const sourceUploadParams = {
                Bucket: process.env.AWS_PORTAL_BUCKET,
                Key: `${this.chatSourceFolder}/${sourceFileName}`,
                Body: fileData,
                ContentType: 'application/pdf',
            };

            await this.s3Client.send(new PutObjectCommand(sourceUploadParams));
            console.log('Uploaded original source file to S3');

            fs.unlink(filePath, (err) => {
                if (err) console.error('Failed to delete original file:', err);
                else console.log('Deleted original uploaded file');
            });

        } catch (error) {
            console.error('Error splitting PDF:', error);
            throw error;
        }
    }


    async getDocTrainings(
        page: number = 1,
        limit: number = 10,
    ): Promise<{ trainings: TrainingResponseDto[], total: number }> {
        const knex = this.databaseService.getKnex();
        try {
            const offset = (page - 1) * limit;
            const countResult = await knex('doc_training')
                .count('id as count')
                .first();

            const total = countResult ? Number(countResult.count) : 0;

            const trainings = await knex('doc_training as d')
                .select(
                    'd.id',
                    'd.stage',
                    'd.summary',
                    'd.file_name as fileName',
                    'd.pages',
                    'd.created_at as createdAt',
                    knex.raw("CONCAT(u.first_name, ' ', u.last_name) as uploader")
                )
                .leftJoin('app_user as u', 'd.user_id', 'u.id')
                .orderBy('d.created_at', 'desc')
                .limit(limit)
                .offset(offset);

            const formattedTrainings: TrainingResponseDto[] = trainings.map(training => ({
                id: training.id,
                stage: training.stage,
                summary: training.summary,
                fileName: training.fileName,
                pages: training.pages,
                createdAt: training.createdAt,
                uploader: training.uploader,
            }));

            return {
                trainings: formattedTrainings,
                total,
            };
        } catch (error) {

        }
    }

    async downloadTrainingQnA(trainingId: number, res: Response): Promise<void> {
        const knex = this.databaseService.getKnex();

        try {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=training-${trainingId}.csv`);

            const csvStream = csv.format({ headers: true });
            csvStream.pipe(res);

            const results = await knex('doc_extract')
                .select('generated_content')
                .where('doc_training_id', trainingId)
                .orderBy('blocks');

            if (results.length === 0) {
                console.log("results.length", results.length)
                console.log(`No data found for training ID: ${trainingId}`);
                res.status(404).json({ error: 'No training data found' });
                return;
            }

            let processedCount = 0;

            results.forEach(record => {
                if (!record.generated_content) return;

                if (!Array.isArray(record.generated_content)) {
                    console.log(`generated_content is not an array: ${typeof record.generated_content}`);
                    return;
                }

                record.generated_content.forEach(item => {
                    csvStream.write({
                        question: item.q,
                        answer: item.a
                    });
                    processedCount++;
                });
            });
            console.log(`Successfully processed ${processedCount} Q&A pairs for training ID: ${trainingId}`);
            csvStream.end();
        } catch (error) {
            console.error(`Failed to download training data for ID ${trainingId}:`, error);

            if (!res.headersSent) {
                res.status(500);
                res.setHeader('Content-Type', 'application/json');
                res.send({ error: 'Failed to generate CSV file', message: error.message });
            }
        }
    }


    async getDocExtract(
        page: number = 1,
        limit: number = 10,
        trainingId: number
    ): Promise<{ extracts: DocExtractDto[], total: number, training: TrainingResponseDto }> {
        const knex = this.databaseService.getKnex();
        try {
            const offset = (page - 1) * limit;

            const [training, countResult, extracts] = await Promise.all([
                knex('doc_training')
                    .select(
                        'id',
                        'stage',
                        'file_name as fileName',
                        'pages',
                        'created_at as createdAt',
                    )
                    .where('id', trainingId)
                    .first(),

                knex('doc_extract')
                    .count('id as count')
                    .where('doc_training_id', trainingId)
                    .first(),

                knex('doc_extract')
                    .select(
                        'id',
                        'status',
                        'summary',
                        'file_name as fileName',
                        'blocks',
                        'generated_content as content',
                        'created_at as createdAt'
                    )
                    .where('doc_training_id', trainingId)
                    .orderBy('created_at', 'asc')
                    .limit(limit)
                    .offset(offset)
            ]);

            if (!training) {
                throw new Error(`Failed to find training document.`);
            }

            const total = countResult ? Number(countResult.count) : 0;

            const formattedExtracts: DocExtractDto[] = extracts.map(extract => ({
                id: extract.id,
                docTrainingId: trainingId,
                status: extract.status,
                summary: extract.summary,
                blocks: extract.blocks,
                content: extract.content,
                fileName: extract.fileName,
                createdAt: extract.createdAt,
            }));

            return {
                extracts: formattedExtracts,
                total,
                training
            };
        } catch (error) {
            console.log(`Error fetching doc extracts: ${error.message}`, {
                trainingId,
                page,
                limit,
                error
            });
            throw new Error(`Failed to retrieve document extracts: ${error.message}`);
        }
    }

    async updateDocExtract(dto: DocExtractContenUpdateDto): Promise<void> {
        const knex = this.databaseService.getKnex();
        try {
            await knex('doc_extract')
                .where('id', dto.docExtractId)
                .update({
                    generated_content: knex.raw('?::jsonb', [JSON.stringify(dto.content)])
                });
            return;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.log(`Failed to update doc_extract: ${errorMessage}`, {
                docExtractId: dto.docExtractId,
                error
            });

            throw new Error(`Failed to update document extract: ${errorMessage}`);
        }
    }
}
