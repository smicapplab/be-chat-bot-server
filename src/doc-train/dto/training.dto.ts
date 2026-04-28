import { IsString, IsNotEmpty, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

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
  @IsString()
  @IsNotEmpty()
  q: string;

  @IsString()
  @IsNotEmpty()
  a: string;
}

export class DocExtractContenUpdateDto {
  @IsNumber()
  @IsNotEmpty()
  docExtractId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocExtractContentDto)
  content: DocExtractContentDto[];
}

