import { IsString, MinLength } from 'class-validator';

export class CreateTaskCommentDto {
  @IsString()
  @MinLength(1)
  body!: string;
}
