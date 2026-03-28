import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { GetCurrentUserVehiclesUseCase } from '../../application/use-cases/get-current-user-vehicles.use-case';
import { ListLicenseTypesUseCase } from '../../application/use-cases/list-license-types.use-case';
import { ListVehicleBrandsUseCase } from '../../application/use-cases/list-vehicle-brands.use-case';
import { ListVehicleModelsUseCase } from '../../application/use-cases/list-vehicle-models.use-case';
import { RegisterVehicleUseCase } from '../../application/use-cases/register-vehicle.use-case';
import { ListVehicleModelsQueryDto } from '../dto/list-vehicle-models.query.dto';
import { RegisterVehicleRequestDto } from '../dto/register-vehicle.request.dto';

@Controller('vehicles')
@UseGuards(JwtAuthGuard)
export class VehiclesController {
  constructor(
    private readonly listLicenseTypesUseCase: ListLicenseTypesUseCase,
    private readonly listVehicleBrandsUseCase: ListVehicleBrandsUseCase,
    private readonly listVehicleModelsUseCase: ListVehicleModelsUseCase,
    private readonly getCurrentUserVehiclesUseCase: GetCurrentUserVehiclesUseCase,
    private readonly registerVehicleUseCase: RegisterVehicleUseCase,
  ) {}

  @Get('catalogs/license-types')
  listLicenseTypes() {
    return this.listLicenseTypesUseCase.execute();
  }

  @Get('catalogs/brands')
  listVehicleBrands() {
    return this.listVehicleBrandsUseCase.execute();
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
}