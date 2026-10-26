import { ArgsType, Field, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

@ArgsType()
export class GetListArgs {
  @Field(() => Int, { nullable: true, defaultValue: 20 })
  @IsInt()
  @Max(40)
  @Min(1)
  @IsOptional()
  count: number;

  @Field(() => Int, { nullable: true, defaultValue: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number;
}
