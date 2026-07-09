import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  KeywordComparison,
  KeywordFieldResult,
  KeywordSuggestion,
  TrackedKeywordItem,
} from '@asobeast/shared';
import { AddKeywordsDto } from './dto/add-keywords.dto';
import { CompareQueryDto } from './dto/compare-query.dto';
import { KeywordFieldDto } from './dto/keyword-field.dto';
import { ListKeywordsQueryDto } from './dto/list-keywords-query.dto';
import { SuggestionsQueryDto } from './dto/suggestions-query.dto';
import { UpdateKeywordDto } from './dto/update-keyword.dto';
import { KeywordsService } from './keywords.service';

@ApiTags('keywords')
@Controller('apps/:id')
export class KeywordsController {
  constructor(private readonly keywords: KeywordsService) {}

  @Get('keywords')
  @ApiOperation({ summary: 'List tracked keywords for an app' })
  list(
    @Param('id') id: string,
    @Query() query: ListKeywordsQueryDto,
  ): Promise<TrackedKeywordItem[]> {
    return this.keywords.listTracked(id, query.sort);
  }

  @Get('keywords/compare')
  @ApiOperation({ summary: 'Compare keyword positions against competitors' })
  compare(
    @Param('id') id: string,
    @Query() query: CompareQueryDto,
  ): Promise<KeywordComparison> {
    return this.keywords.compare(id, query.onlyGaps);
  }

  @Get('keywords/suggestions')
  @ApiOperation({ summary: 'Suggest keywords via metadata, search or similar' })
  suggestions(
    @Param('id') id: string,
    @Query() query: SuggestionsQueryDto,
  ): Promise<KeywordSuggestion[]> {
    return this.keywords.suggest(id, query.strategy, query.limit);
  }

  @Post('keywords')
  @ApiOperation({ summary: 'Add manual keywords' })
  add(
    @Param('id') id: string,
    @Body() dto: AddKeywordsDto,
  ): Promise<TrackedKeywordItem[]> {
    return this.keywords.addManual(id, dto.keywords);
  }

  @Patch('keywords/:keywordId')
  @ApiOperation({
    summary: 'Update a tracked keyword active flag or relevance',
  })
  update(
    @Param('id') id: string,
    @Param('keywordId') keywordId: string,
    @Body() dto: UpdateKeywordDto,
  ): Promise<TrackedKeywordItem> {
    return this.keywords.updateKeyword(id, keywordId, dto);
  }

  @Delete('keywords/:keywordId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Stop tracking a keyword' })
  remove(
    @Param('id') id: string,
    @Param('keywordId') keywordId: string,
  ): Promise<void> {
    return this.keywords.remove(id, keywordId);
  }

  @Put('keyword-field')
  @ApiOperation({ summary: 'Set the manual iOS keyword field' })
  setKeywordField(
    @Param('id') id: string,
    @Body() dto: KeywordFieldDto,
  ): Promise<KeywordFieldResult> {
    return this.keywords.setKeywordField(id, dto.text);
  }
}
