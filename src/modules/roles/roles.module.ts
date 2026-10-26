import { Module } from '@nestjs/common';
import { RolesRepository } from '@modules/roles/repositories/roles.repository';
import { RolesService } from '@modules/roles/roles.service';
import { RolesResolver } from '@modules/roles/roles.resolver';

@Module({
  providers: [RolesRepository, RolesService, RolesResolver],
})
export class RolesModule {}
