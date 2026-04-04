import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { GetCurrentUserVehiclesUseCase } from '../../application/use-cases/get-current-user-vehicles.use-case';
import { GetVehicleRegistrationDocumentUseCase } from '../../application/use-cases/get-vehicle-registration-document.use-case';
import { ListLicenseTypesUseCase } from '../../application/use-cases/list-license-types.use-case';
import { ListVehicleBrandsUseCase } from '../../application/use-cases/list-vehicle-brands.use-case';
import { ListVehicleModelsUseCase } from '../../application/use-cases/list-vehicle-models.use-case';
import { RegisterVehicleUseCase } from '../../application/use-cases/register-vehicle.use-case';
import { SetVehicleActiveStatusUseCase } from '../../application/use-cases/set-vehicle-active-status.use-case';
import { UpdateVehicleUseCase } from '../../application/use-cases/update-vehicle.use-case';
import { UploadVehicleRegistrationDocumentUseCase } from '../../application/use-cases/upload-vehicle-registration-document.use-case';
import { ListVehicleBrandsQueryDto } from '../dto/list-vehicle-brands.query.dto';
import { ListVehicleModelsQueryDto } from '../dto/list-vehicle-models.query.dto';
import { RegisterVehicleRequestDto } from '../dto/register-vehicle.request.dto';
import { SetVehicleActiveStatusRequestDto } from '../dto/set-vehicle-active-status.request.dto';
import { UpdateVehicleRequestDto } from '../dto/update-vehicle.request.dto';

type UploadedVehicleDocumentFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Controller('vehicles')
@UseGuards(JwtAuthGuard)
export class VehiclesController {
  constructor(
    private readonly listLicenseTypesUseCase: ListLicenseTypesUseCase,
    private readonly listVehicleBrandsUseCase: ListVehicleBrandsUseCase,
    private readonly listVehicleModelsUseCase: ListVehicleModelsUseCase,
    private readonly getCurrentUserVehiclesUseCase: GetCurrentUserVehiclesUseCase,
    private readonly uploadVehicleRegistrationDocumentUseCase: UploadVehicleRegistrationDocumentUseCase,
    private readonly getVehicleRegistrationDocumentUseCase: GetVehicleRegistrationDocumentUseCase,
    private readonly registerVehicleUseCase: RegisterVehicleUseCase,
    private readonly updateVehicleUseCase: UpdateVehicleUseCase,
    private readonly setVehicleActiveStatusUseCase: SetVehicleActiveStatusUseCase,
  ) {}

  @Get('catalogs/license-types')
  listLicenseTypes() {
    return this.listLicenseTypesUseCase.execute();
  }

  @Get('catalogs/brands')
  listVehicleBrands(@Query() query: ListVehicleBrandsQueryDto) {
    return this.listVehicleBrandsUseCase.execute({
      vehicleType: query.vehicleType,
    });
  }

  @Get('catalogs/models')
  listVehicleModels(@Query() query: ListVehicleModelsQueryDto) {
    return this.listVehicleModelsUseCase.execute({
      brandId: query.brandId,
      vehicleType: query.vehicleType,
    });
  }

  @Get('me')
  getCurrentUserVehicles(@CurrentUser() currentUser: CurrentUserContext) {
    return this.getCurrentUserVehiclesUseCase.execute(currentUser.id);
  }

  @Post('me/documents/registration')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 8 * 1024 * 1024,
      },
    }),
  )
  uploadVehicleRegistrationDocument(
    @CurrentUser() currentUser: CurrentUserContext,
    @UploadedFile() file: UploadedVehicleDocumentFile | undefined,
  ) {
    return this.uploadVehicleRegistrationDocumentUseCase.execute(currentUser.id, file);
  }

  @Post()
  registerVehicle(
    @CurrentUser() currentUser: CurrentUserContext,
    @Body() body: RegisterVehicleRequestDto,
  ) {
    return this.registerVehicleUseCase.execute({
      userId: currentUser.id,
      vehicleType: body.vehicleType,
      brandId: body.brandId,
      modelId: body.modelId,
      customBrandName: body.customBrandName,
      customModelName: body.customModelName,
      year: body.year,
      color: body.color,
      plate: body.plate,
      seatCount: body.seatCount,
      luggagePolicy: body.luggagePolicy,
      registrationDocumentFileKey: body.registrationDocumentFileKey,
    });
  }

  @Patch(':vehicleId')
  updateVehicle(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('vehicleId', new ParseUUIDPipe()) vehicleId: string,
    @Body() body: UpdateVehicleRequestDto,
  ) {
    return this.updateVehicleUseCase.execute({
      userId: currentUser.id,
      vehicleId,
      vehicleType: body.vehicleType,
      brandId: body.brandId,
      modelId: body.modelId,
      customBrandName: body.customBrandName,
      customModelName: body.customModelName,
      year: body.year,
      color: body.color,
      plate: body.plate,
      seatCount: body.seatCount,
      luggagePolicy: body.luggagePolicy,
      registrationDocumentFileKey: body.registrationDocumentFileKey,
    });
  }

  @Patch(':vehicleId/status')
  setVehicleActiveStatus(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('vehicleId', new ParseUUIDPipe()) vehicleId: string,
    @Body() body: SetVehicleActiveStatusRequestDto,
  ) {
    return this.setVehicleActiveStatusUseCase.execute({
      userId: currentUser.id,
      vehicleId,
      isActive: body.isActive,
    });
  }

  @Get(':vehicleId/documents/registration')
  @Header('Cache-Control', 'no-store')
  async getVehicleRegistrationDocument(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('vehicleId', new ParseUUIDPipe()) vehicleId: string,
  ) {
    const document = await this.getVehicleRegistrationDocumentUseCase.execute(
      currentUser.id,
      vehicleId,
    );

    return new StreamableFile(document.content, {
      type: document.mimeType,
      disposition: `attachment; filename="${document.fileName}"`,
      length: document.content.length,
    });
  }
}
