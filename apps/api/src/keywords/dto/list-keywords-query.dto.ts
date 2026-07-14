import { ApiPropertyOptional } from '@nestjs/swagger';
import { KEYWORD_SORTS, KeywordSort } from '@asobeast/shared';
import { IsIn, IsOptional, Matches } from 'class-validator';

export class ListKeywordsQueryDto {
  @ApiPropertyOptional({ enum: KEYWORD_SORTS })
  @IsOptional()
  @IsIn(KEYWORD_SORTS)
  sort?: KeywordSort;

  @ApiPropertyOptional({ example: 'pl' })
  @IsOptional()
  @Matches(/^[a-z]{2}$/)
  country?: string;
}
