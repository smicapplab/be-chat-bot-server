export class TrainingResponseDto {
    id: number;
    stage: "INIT" | "DONE" | "PENDING";
    summary: string | null;
    fileName: string;
    pages: number;
    createdAt: string;
    uploader: string;
    Extracts?: DocExtractDto[];
  }

export class DocExtractDto {
  id: number;
  docTrainingId: number;
  status: "INIT" | "DONE" | "PENDING";
  summary: string;
  blocks: string;
  createdAt: string;
  content?: DocExtractContentDto[]
}

export class DocExtractContentDto {
  q: string;
  a: string;
}

export interface DocExtractContenUpdateDto {
  docExtractId: number;
  content: DocExtractContentDto[];
}

