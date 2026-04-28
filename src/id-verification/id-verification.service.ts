import {
    TextractClient,
    AnalyzeDocumentCommand,
} from '@aws-sdk/client-textract';
import {
    RekognitionClient,
    DetectFacesCommand,
    CompareFacesCommand,
} from '@aws-sdk/client-rekognition';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sharp from 'sharp';

@Injectable()
export class IdVerificationService {
    private textract: TextractClient;
    private rekognition: RekognitionClient;

    constructor(private readonly configService: ConfigService) {
        const credentials = {
            accessKeyId: this.configService.get<string>('PRI_AWS_ACCESS_KEY')!,
            secretAccessKey: this.configService.get<string>('PRI_AWS_SECRET_KEY')!,
        };

        this.textract = new TextractClient({
            region: this.configService.get<string>('AWS_REGION') || 'us-east-1',
            credentials,
        });

        this.rekognition = new RekognitionClient({
            region: this.configService.get<string>('AWS_REGION') || 'us-east-1',
            credentials,
        });
    }

    async verifyIdAndCompareFace(idBuffer: Buffer, selfieBuffer?: Buffer) {
        if (!idBuffer) {
            throw new Error('idBuffer must be provided');
        }
        const { isValid, confidence } = await this.verifyPhilSysId(idBuffer);
        if (!isValid) {
            return {
                validPhilId: false,
                faceMatched: null,
                faceSimilarity: null,
                matchTier: null,
                confidence,
            };
        }

        // If selfieBuffer is not provided, just return validPhilId
        if (!selfieBuffer) {
            return {
                validPhilId: true,
                faceMatched: null,
                faceSimilarity: null,
                matchTier: null,
                confidence,
            };
        }

        const croppedIdFace = await this.extractIdFace(idBuffer);
        let faceSimilarity: number | null = null;
        let faceMatched: boolean | null = null;
        let matchTier: string | null = null;

        if (croppedIdFace) {
            faceSimilarity = await this.compareFaces(selfieBuffer, croppedIdFace);
            if (faceSimilarity !== null) {
                if (faceSimilarity >= 95) {
                    matchTier = 'high';
                    faceMatched = true;
                } else if (faceSimilarity >= 85) {
                    matchTier = 'medium';
                    faceMatched = true;
                } else if (faceSimilarity >= 70) {
                    matchTier = 'low';
                    faceMatched = false;
                } else {
                    matchTier = 'low';
                    faceMatched = false;
                }
            }
        }

        return {
            validPhilId: true,
            faceMatched,
            faceSimilarity,
            matchTier,
            confidence,
        };
    }

    private async verifyPhilSysId(image: Buffer): Promise<{ isValid: boolean; confidence: number }> {
        const command = new AnalyzeDocumentCommand({
            Document: { Bytes: image },
            FeatureTypes: ['FORMS'],
        });

        const result = await this.textract.send(command);
        const lines = result.Blocks?.filter(
            b => b.BlockType === 'LINE' && (b.Confidence ?? 0) >= 90,
        ).map(b => b.Text?.toLowerCase() || '') || [];

        const fullText = lines.join(' ');
        const hasHeader = /pambansang\s+pagk[a|i]+kilanlan/.test(fullText) ||
            /philippine\s+identification\s+card/.test(fullText);

        const fuzzyMatches = lines.filter(line =>
            /(apelyido|pangalan|kapanganakan|tirahan|address|phl)/i.test(line)
        );
        const matchedFields = [...new Set(fuzzyMatches.map(l => l.trim().toLowerCase()))];

        const cardNumberRegex = /\b\d{4}-\d{4}-\d{4}-\d{4}\b/;
        const hasCardNumber = cardNumberRegex.test(fullText);

        const isValid = hasHeader && matchedFields.length >= 2 && hasCardNumber;

        // Calculate confidence score
        let confidence = 0;
        if (hasHeader) confidence += 0.4;
        if (hasCardNumber) confidence += 0.4;
        confidence += Math.min(matchedFields.length, 5) * 0.04; // up to 0.2 for matched fields
        confidence = Math.min(confidence, 1);

        return { isValid, confidence };
    }

    private async extractIdFace(image: Buffer): Promise<Buffer | null> {
        const detect = await this.rekognition.send(
            new DetectFacesCommand({
                Image: { Bytes: image },
                Attributes: ['DEFAULT'],
            })
        );

        const box = detect.FaceDetails?.[0]?.BoundingBox;
        if (!box) return null;

        const meta = await sharp(image).metadata();
        const region = {
            left: Math.round(box.Left * meta.width),
            top: Math.round(box.Top * meta.height),
            width: Math.round(box.Width * meta.width),
            height: Math.round(box.Height * meta.height),
        };

        if (region.width < 10 || region.height < 10) {
            console.warn('Region too small, skipping comparison.');
            return null;
        }

        const cropped = await sharp(image).extract(region).toBuffer();
        return cropped;
    }

    private async compareFaces(source: Buffer, target: Buffer): Promise<number | null> {
        const result = await this.rekognition.send(
            new CompareFacesCommand({
                SourceImage: { Bytes: source },
                TargetImage: { Bytes: target },
                SimilarityThreshold: 0,
            })
        );

        if (result.FaceMatches && result.FaceMatches.length > 0) {
            return result.FaceMatches[0].Similarity ?? null;
        }
        return null;
    }
}
