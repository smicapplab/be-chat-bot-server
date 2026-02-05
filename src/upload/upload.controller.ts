import { Body, Controller, DefaultValuePipe, Delete, Get, Param, ParseIntPipe, Post, Query, Request, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from 'src/utils/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { QuestionResponseDto } from './dto/question.dto';

@Controller('upload')
export class UploadController {
    constructor(
        private readonly uploadService: UploadService
    ) { }

    @Post('multi')
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(FileInterceptor('file'))
    async createMulti(
        @UploadedFile() file: Express.Multer.File,
        @Body() body: { projectId: string },
        @Request() req,
    ) {
        // Ensure the file is present
        if (!file) {
            throw new Error('File is missing');
        }

        const projectId = parseInt(body.projectId);
        await this.uploadService.uploadMulti(projectId, file, req.user);
        return { success: true }
    }


    @UseGuards(JwtAuthGuard)
    @Delete(':fileHistId')
    async deleteUploadQuestions(
        @Param('fileHistId', ParseIntPipe) fileHistId: number,
    ): Promise<{ success?: boolean; message?: string }> {
        try {
            const result = await this.uploadService.deleteUploadQuestions(fileHistId);
            return result;
        } catch (error) {
            return {
                success: false,
                message: 'Could not delete project: ' + error.message,
            };
        }
    }

    @UseGuards(JwtAuthGuard)
    @Get('questions/:fileHistId')
    async getUploadQuestions(
        @Param('fileHistId', ParseIntPipe) fileHistId: number,
        @Query('search') searchText?: string,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
    ): Promise<{ success?: boolean; data?: QuestionResponseDto[]; pagination?: any; message?: string }> {
        try {
            const { questions, total } = await this.uploadService.getUploadQuestions(fileHistId, searchText, page, limit);

            return {
                success: true,
                data: questions,
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
                message: 'Could not retrieve questions: ' + error.message,
            };
        }
    }
}