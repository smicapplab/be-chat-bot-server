import {
    Controller,
    Post,
    UploadedFiles,
    UseInterceptors,
    BadRequestException,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { IdVerificationService } from './id-verification.service';

@Controller('id-verification')
export class IdVerificationController {
    constructor(private readonly service: IdVerificationService) {}

    @Post('verify')
    @UseInterceptors(AnyFilesInterceptor())
    async verify(@UploadedFiles() files: Express.Multer.File[]) {
        const idImage = files.find(file => file.fieldname === 'id');
        const selfieImage = files.find(file => file.fieldname === 'selfie');

        if (!idImage) {
            throw new BadRequestException('Missing "id" image');
        }

        return this.service.verifyIdAndCompareFace(idImage.buffer, selfieImage?.buffer);
    }
}
