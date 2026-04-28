import { Injectable } from '@nestjs/common';
import { BaseRepository } from 'src/common/repositories/base.repository';
import { DatabaseService } from 'src/database/database.service';
import { ProjectResponseDto, UploadHistResponseDto } from './dto/project.dto';

@Injectable()
export class ProjectRepository extends BaseRepository<any> {
    constructor(databaseService: DatabaseService) {
        super(databaseService, 'project');
    }

    async getAllUploadHistory(projectId: number): Promise<UploadHistResponseDto[]> {
        const uploadHist: UploadHistResponseDto[] = await this.knex('upload_history')
            .join('project', 'project.id', '=', 'upload_history.project_id')
            .join('app_user', 'app_user.id', '=', 'upload_history.uploaded_by')
            .select({
                id: 'upload_history.id',
                fileName: 'upload_history.file_name',
                uploadedAt: 'upload_history.uploaded_at',
                uploaderId: 'app_user.id',
                uploader: this.knex.raw("app_user.first_name || ' ' || app_user.last_name"),
                status: 'upload_history.status',
                projectId: 'project.id',
                totalQuestions: this.knex.raw(`(
                    SELECT COUNT(*) 
                    FROM question 
                    WHERE question.upload_id = upload_history.id
                )`)
            })
            .where('project.id', projectId)
            .groupBy('upload_history.id', 'project.id', 'app_user.id', 'project.title')
            .orderBy('upload_history.uploaded_at', 'desc');

        return uploadHist;
    }

    async deleteProjectTransaction(projectId: number): Promise<void> {
        await this.knex.transaction(async (trx) => {
            await trx('chat').where('project_id', projectId).del();
            await trx('question').where('project_id', projectId).del();
            await trx('upload_history').where('project_id', projectId).del();
            await trx('project').where('id', projectId).del();
        });
    }
}
