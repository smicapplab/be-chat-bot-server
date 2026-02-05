
export class AddProjectDto {
    title: string;
    serviceType: string;
    description: string;
}

export class UpdateProjectDto {
    id: number;
    title: string;
    status?: string;
    serviceType?: string;
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
