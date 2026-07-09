import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { AuditInputAnswers } from '@asobeast/shared';

const flag = () => (target: object, key: string) => {
  ApiPropertyOptional({ type: Boolean })(target, key);
  IsOptional()(target, key);
  IsBoolean()(target, key);
};

export class AuditInputAnswersDto implements AuditInputAnswers {
  @flag() screenshotsFirst3Compelling?: boolean;
  @flag() screenshotsTextOverlays?: boolean;
  @flag() screenshotsConsistent?: boolean;
  @flag() screenshotsLocalized?: boolean;
  @flag() screenshotsDeviceFrames?: boolean;
  @flag() previewVideoExists?: boolean;
  @flag() previewVideoHook?: boolean;
  @flag() previewVideoLength?: boolean;
  @flag() previewVideoWorksWithoutSound?: boolean;
  @flag() reviewResponses?: boolean;
  @flag() ratingPrompts?: boolean;
  @flag() iconDistinctive?: boolean;
  @flag() iconSimple?: boolean;
  @flag() iconCategoryFit?: boolean;
  @flag() iconNoText?: boolean;
  @flag() promotionalText?: boolean;
  @flag() inAppEvents?: boolean;
  @flag() customProductPages?: boolean;
}
