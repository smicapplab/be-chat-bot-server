import { Injectable } from '@nestjs/common';
import { AddProjectDto, ProjectResponseDto, UpdateProjectDto, UploadHistResponseDto } from './dto/project.dto';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class ProjectService {
    constructor(
        private readonly databaseService: DatabaseService
    ) {
    }

    async getAllProjects(): Promise<ProjectResponseDto[]> {
        try {
            const knex = this.databaseService.getKnex();
            const projects: ProjectResponseDto[] = await knex('project')
                .select({
                    id: 'id',
                    title: 'title',
                    serviceType: 'service_type',
                    status: 'status',
                    description: 'description'
                })
                .orderBy('title', 'asc');

            return projects;
        } catch (error) {
            throw error;
        }
    }

    async getAllUploadHistory(projectId: number): Promise<UploadHistResponseDto[]> {
        try {
            const knex = this.databaseService.getKnex();
            const uploadHist: UploadHistResponseDto[] = await knex('upload_history')
            .join('project', 'project.id', '=', 'upload_history.project_id')
            .join('app_user', 'app_user.id', '=', 'upload_history.uploaded_by')
            .select({
                id: 'upload_history.id',
                fileName: 'upload_history.file_name',
                uploadedAt: 'upload_history.uploaded_at',
                uploaderId: 'app_user.id',
                uploader: knex.raw("app_user.first_name || ' ' || app_user.last_name"),
                status: 'upload_history.status',
                projectId: 'project.id',
                totalQuestions: knex.raw(`(
                    SELECT COUNT(*) 
                    FROM question 
                    WHERE question.upload_id = upload_history.id
                )`)
            })
            .where('project.id', projectId)
            .groupBy('upload_history.id', 'project.id', 'app_user.id', 'project.title') 
            .orderBy('upload_history.uploaded_at', 'desc');

            return uploadHist;
        } catch (error) {
            throw error;
        }
    }

    async createProject(dto: AddProjectDto): Promise<ProjectResponseDto> {
        try {
            const knex = this.databaseService.getKnex();
            const result = await knex('project')
                .insert({
                    title: dto.title, service_type: dto.serviceType, description: dto.description
                })
                .returning(['id', 'title']);

            if (!result || result.length === 0) {
                throw new Error('Project creation failed');
            }

            return result[0];

        } catch (error) {
            throw error;
        }
    }

    async updateProject(dto: UpdateProjectDto): Promise<ProjectResponseDto> {
        try {
            const knex = this.databaseService.getKnex();
            const result = await knex('project')
                .where({ id: dto.id })
                .update({
                    title: dto.title,
                    status: dto.status,
                    service_type: dto.serviceType,
                    description: dto.description
                }).returning(['id', 'title', 'status', 'service_type', 'description']);

            if (!result || result.length === 0) {
                throw new Error('Project not found or update failed');
            }

            return result[0];
        } catch (error) {
            throw error;
        }
    }

    async deleteProject(projectId: number): Promise<{ success?: boolean; message?: string }> {
        try {
            const knex = this.databaseService.getKnex();
            const res = await knex.transaction(async (trx) => {
                await trx('chat').where('project_id', projectId).del();
                await trx('question').where('project_id', projectId).del();
                await trx('upload_history').where('project_id', projectId).del();
                await trx('project').where('id', projectId).del();
                return projectId;
              });
              
            return { success: true }
        } catch (error) {
            throw error;
        }
    }
}
