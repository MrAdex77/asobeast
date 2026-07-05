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
  UseFilters,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  KeywordFieldResult,
  KeywordSuggestion,
  TrackedKeywordItem,
} from '@asobeast/shared';
import { StoreErrorFilter } from '../apps/store-error.filter';
import { AddKeywordsDto } from './dto/add-keywords.dto';
import { KeywordFieldDto } from './dto/keyword-field.dto';
import { ListKeywordsQueryDto } from './dto/list-keywords-query.dto';
import { SuggestionsQueryDto } from './dto/suggestions-query.dto';
import { ToggleKeywordDto } from './dto/toggle-keyword.dto';
import { KeywordsService } from './keywords.service';

@ApiTags('keywords')
@Controller('apps/:id')
@UseFilters(StoreErrorFilter)
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
  @ApiOperation({ summary: 'Toggle a tracked keyword active flag' })
  toggle(
    @Param('id') id: string,
    @Param('keywordId') keywordId: string,
    @Body() dto: ToggleKeywordDto,
  ): Promise<TrackedKeywordItem> {
    return this.keywords.toggle(id, keywordId, dto.active);
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
