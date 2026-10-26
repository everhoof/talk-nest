import { Injectable } from '@nestjs/common';
import { RolesRepository } from '@modules/roles/repositories/roles.repository';

@Injectable()
export class RolesService {
  constructor(private readonly rolesRepository: RolesRepository) {}
}
