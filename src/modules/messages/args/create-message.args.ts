import { ArgsType, Field, Int } from '@nestjs/graphql';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

@ArgsType()
export class CreateMessageArgs {
  @Field(() => String, { nullable: true })
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  content?: string;

  @Field(() => String, { nullable: true })
  @IsString()
  @MaxLength(32)
  @IsOptional()
  randomId?: string;

  @Field(() => [Int], { nullable: true, defaultValue: [] })
  @IsArray()
  @IsInt({ each: true })
  @ArrayMaxSize(32)
  pictures: number[];
}
