import { Injectable } from '@nestjs/common';
import { AddProjectDto, ProjectResponseDto, UpdateProjectDto, UploadHistResponseDto } from './dto/project.dto';
import { ProjectRepository } from './project.repository';

@Injectable()
export class ProjectService {
    constructor(
        private readonly projectRepository: ProjectRepository
    ) {
    }

    async getAllProjects(): Promise<ProjectResponseDto[]> {
        return this.projectRepository.findAll({ orderBy: 'title', order: 'asc' });
    }

    async getAllUploadHistory(projectId: number): Promise<UploadHistResponseDto[]> {
        return this.projectRepository.getAllUploadHistory(projectId);
    }

    async createProject(dto: AddProjectDto): Promise<ProjectResponseDto> {
        return this.projectRepository.create({
            title: dto.title,
            serviceType: dto.serviceType,
            description: dto.description
        });
    }

    async updateProject(dto: UpdateProjectDto): Promise<ProjectResponseDto> {
        return this.projectRepository.update(dto.id, {
            title: dto.title,
            status: dto.status,
            serviceType: dto.serviceType,
            description: dto.description
        });
    }

    async deleteProject(projectId: number): Promise<{ success?: boolean; message?: string }> {
        await this.projectRepository.deleteProjectTransaction(projectId);
        return { success: true }
    }
}
