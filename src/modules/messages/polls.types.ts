import { ArgsType, Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDate,
  ArrayUnique,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

@ArgsType()
class PollQuestionArgs {
  @Field()
  @IsString()
  @Matches(/\S/)
  @MaxLength(300)
  question: string;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  allowMultiple?: boolean | null;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  allowChangeVote?: boolean | null;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @IsDate()
  endsAt?: Date | null;
}

@ArgsType()
export class CreatePollArgs extends PollQuestionArgs {
  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean | null;

  @Field(() => [String])
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Matches(/\S/, { each: true })
  @MaxLength(100, { each: true })
  options: string[];
}

@ArgsType()
export class GetPollArgs {
  @Field(() => Int)
  @IsInt()
  @Min(1)
  messageId: number;
}

@InputType()
export class UpdatePollOptionInput {
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  id?: number | null;

  @Field()
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  label: string;
}

@ArgsType()
export class UpdatePollArgs extends PollQuestionArgs {
  @Field(() => Int)
  @IsInt()
  @Min(1)
  messageId: number;

  @Field(() => [UpdatePollOptionInput])
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => UpdatePollOptionInput)
  options: UpdatePollOptionInput[];
}

@ArgsType()
export class VotePollArgs extends GetPollArgs {
  @Field(() => [Int])
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  optionIds: number[];
}

@ObjectType()
export class PollOption {
  @Field(() => Int)
  id: number;

  @Field()
  label: string;

  @Field(() => Int, { nullable: true })
  votes: number | null;
}

@ObjectType()
export class Poll {
  @Field()
  isAnonymous: boolean;

  @Field(() => Int)
  messageId: number;

  @Field()
  question: string;

  @Field()
  allowMultiple: boolean;

  @Field()
  allowChangeVote: boolean;

  @Field(() => Date, { nullable: true })
  endsAt: Date | null;

  @Field()
  isClosed: boolean;

  @Field(() => Date)
  serverTime: Date;

  @Field(() => [Int])
  selectedOptionIds: number[];

  @Field(() => [PollOption])
  options: PollOption[];

  @Field(() => Int, { nullable: true })
  selectedOption: number | null;

  @Field(() => Int, { nullable: true })
  totalVotes: number | null;
}
