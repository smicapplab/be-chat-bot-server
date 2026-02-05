import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/utils/jwt-auth.guard';
import { ProjectService } from './project.service';
import { AddProjectDto, ProjectResponseDto, UpdateProjectDto, UploadHistResponseDto } from './dto/project.dto';

@Controller('project')
export class ProjectController {
    constructor(
        private readonly projectService: ProjectService
    ) { }


    @UseGuards(JwtAuthGuard)
    @Get()
    async getProject(): Promise<{ success?: boolean; data?: ProjectResponseDto[]; message?: string }> {
        try {
            const projects = await this.projectService.getAllProjects();
            return {
                success: true,
                data: projects,
            };
        } catch (error) {
            return {
                success: false,
                message: 'Could not fetch projects: ' + error.message,
            };
        }
    }

    @UseGuards(JwtAuthGuard)
    @Get('history/:projectId')
    async getProjectUploadHistory(
        @Param('projectId', ParseIntPipe) projectId: number,
    ): Promise<{ success?: boolean; data?: UploadHistResponseDto[]; message?: string }> {
        try {
            const uploadHist = await this.projectService.getAllUploadHistory(projectId);
            return {
                success: true,
                data: uploadHist,
            };
        } catch (error) {
            return {
                success: false,
                message: 'Could not fetch projects: ' + error.message,
            };
        }
    }

    @UseGuards(JwtAuthGuard)
    @Post()
    async addProject(
        @Body() dto: AddProjectDto
    ): Promise<{ success?: boolean; data?: { id?: number }; message?: string }> {
        try {
            const addedProject = await this.projectService.createProject(dto);
            return {
                success: true,
                data: addedProject,
            };
        } catch (error) {
            return {
                success: false,
                message: 'Could not fetch projects: ' + error.message,
            };
        }
    }

    @UseGuards(JwtAuthGuard)
    @Patch(':id')
    async updateProject(
        @Body() dto: UpdateProjectDto
    ): Promise<{ success?: boolean; data?: { id?: number }; message?: string }> {
        try {
            const updatedProject = await this.projectService.updateProject(dto);
            return {
                success: true,
                data: updatedProject,
            };
        } catch (error) {
            return {
                success: false,
                message: 'Could not fetch projects: ' + error.message,
            };
        }
    }

    @UseGuards(JwtAuthGuard)
    @Delete(':projectId')
    async deleteProject(
        @Param('projectId', ParseIntPipe) projectId: number,
    ): Promise<{ success?: boolean; message?: string }> {
        try {
            const result = await this.projectService.deleteProject(projectId);
            return result;
        } catch (error) {
            return {
                success: false,
                message: 'Could not delete project: ' + error.message,
            };
        }
    }
}