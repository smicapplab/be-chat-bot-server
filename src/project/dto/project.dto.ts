import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class AddProjectDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsNotEmpty()
    serviceType: string;

    @IsString()
    @IsNotEmpty()
    description: string;
}

export class UpdateProjectDto {
    @IsNumber()
    @IsNotEmpty()
    id: number;

    @IsString()
    @IsNotEmpty()
    title: string;

    @IsOptional()
    @IsString()
    status?: string;

    @IsOptional()
    @IsString()
    serviceType?: string;

    @IsString()
    @IsNotEmpty()
    description: string;
}

export class ProjectResponseDto {
    id: number;
    title: string;
    status?: string;
    serviceType?: string;
  }
  

  export class UploadHistResponseDto {
      id: number;
      fileName: string;
      uploadedAt?: Date;
      status?: string;
      uploaderId: number;
      uploader: string;
      projectId: number;
      totalQuestions: number;
  }
