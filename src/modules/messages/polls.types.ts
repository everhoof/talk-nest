import { ArgsType, Field, Int, ObjectType } from '@nestjs/graphql';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

@ArgsType()
export class CreatePollArgs {
  @Field()
  @IsString()
  @MaxLength(300)
  question: string;

  @Field(() => [String])
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @IsString({ each: true })
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

@ArgsType()
export class VotePollArgs extends GetPollArgs {
  @Field(() => Int)
  @IsInt()
  @Min(0)
  @Max(9)
  optionIndex: number;
}

@ObjectType()
export class PollOption {
  @Field()
  label: string;

  @Field(() => Int, { nullable: true })
  votes: number | null;
}

@ObjectType()
export class Poll {
  @Field(() => Int)
  messageId: number;

  @Field()
  question: string;

  @Field(() => [PollOption])
  options: PollOption[];

  @Field(() => Int, { nullable: true })
  selectedOption: number | null;

  @Field(() => Int, { nullable: true })
  totalVotes: number | null;
}
