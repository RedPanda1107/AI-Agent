import { IsString, IsNotEmpty } from 'class-validator';

export class StartWorkflowDto {
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @IsString()
  @IsNotEmpty()
  idea!: string;
}
