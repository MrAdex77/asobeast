import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  KEYWORD_SUGGESTION_STRATEGIES,
  KeywordSuggestionStrategy,
} from '@asobeast/shared';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export class SuggestionsQueryDto {
  @ApiPropertyOptional({ enum: KEYWORD_SUGGESTION_STRATEGIES })
  @IsOptional()
  @IsIn(KEYWORD_SUGGESTION_STRATEGIES)
  strategy: KeywordSuggestionStrategy = 'metadata';

  @ApiPropertyOptional({ example: 'pl' })
  @IsOptional()
  @Matches(/^[a-z]{2}$/)
  country?: string;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 30;
}
