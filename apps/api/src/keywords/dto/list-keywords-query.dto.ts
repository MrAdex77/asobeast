import { ApiPropertyOptional } from '@nestjs/swagger';
import { KEYWORD_SORTS, KeywordSort } from '@asobeast/shared';
import { IsIn, IsOptional } from 'class-validator';

export class ListKeywordsQueryDto {
  @ApiPropertyOptional({ enum: KEYWORD_SORTS })
  @IsOptional()
  @IsIn(KEYWORD_SORTS)
  sort?: KeywordSort;
}
