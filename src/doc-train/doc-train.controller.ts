import { Body, Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Patch, Post, Query, Request, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { DocTrainService } from './doc-train.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/utils/jwt-auth.guard';
import { DocExtractContenUpdateDto, DocExtractDto, TrainingResponseDto } from './dto/training.dto';
import { Response as ExpressResponse } from 'express';

@Controller('doc-train')
export class DocTrainController {
    constructor(
        private readonly docTrainService: DocTrainService
    ) { }

    @Post('multi')
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(FileInterceptor('file'))
    async uploadForTraining(
        @UploadedFile() file: Express.Multer.File,
        @Body() body: any,
        @Request() req,
    ) {
        if (!file) {
            throw new Error('File is missing');
        }        
        const description = body.description;
        await this.docTrainService.uploadForTraining(file, description, req.user);
        return { success: true }
    }

    @UseGuards(JwtAuthGuard)
    @Get()
    async getDocTraining(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
    ): Promise<{ success?: boolean; data?: TrainingResponseDto[]; pagination?: { total: number; page: number; limit: number; pages: number }; message?: string }> {
        try {
            const { trainings, total } = await this.docTrainService.getDocTrainings(page, limit);

            return {
              success: true,
              data: trainings,
              pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
              }
            };
            
        } catch (error) {
            return {
                success: false,
                message: 'Could not retrieve training: ' + error.message,
            };
        }
    } 

    @UseGuards(JwtAuthGuard)
    @Get('download/:trainingId')
    async downloadDocTrain(
        @Param('trainingId', ParseIntPipe) trainingId: number,
        @Res() res: any
    ): Promise<void> {
        try {
            await this.docTrainService.downloadTrainingQnA(trainingId, res);
        } catch (error) {
            console.error(`Error in downloadDocTrain controller for ID ${trainingId}:`, error);

            // Only set status if headers haven't been sent yet
            if (!res.headersSent) {
                res.status(error.status || 500);
                res.json({
                    statusCode: error.status || 500,
                    message: error.message || 'Internal server error',
                    error: error.name || 'UnknownError'
                });
            }
        }
    }

    @UseGuards(JwtAuthGuard)
    @Get('extracts/:trainingId')
    async getDocExtract(
        @Param('trainingId', ParseIntPipe) trainingId: number,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
    ): Promise<{ success?: boolean; data?: DocExtractDto[]; training?: TrainingResponseDto, pagination?: { total: number; page: number; limit: number; pages: number }; message?: string }> {
        try {
            const { extracts, total, training } = await this.docTrainService.getDocExtract(page, limit, trainingId);

            return {
              success: true,
              training,
              data: extracts,
              pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
              }
            };
            
        } catch (error) {
            return {
                success: false,
                message: 'Could not retrieve extracts: ' + error.message,
            };
        }
    } 

    @UseGuards(JwtAuthGuard)
    @Patch('extracts/:docExtractId')
    async updateDocExtract(
        @Param('docExtractId', ParseIntPipe) docExtractId: number,
        @Body() dto: DocExtractContenUpdateDto
    ): Promise<{ success?: boolean; message?: string }> {
        try {
            await this.docTrainService.updateDocExtract(dto);
            return { success: true }
        } catch (error) {
            return {
                success: false,
                message: 'Could not update extract content: ' + error.message,
            };
        }
    } 
    
}
