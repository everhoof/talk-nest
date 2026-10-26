import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { BasicRepository } from '@modules/common/repositories/basic.repository';
import { Role } from '@modules/roles/entities/roles.entity';
import { InternalServerErrorException } from '@modules/common/exceptions/exceptions';

@Injectable()
export class RolesRepository extends BasicRepository<Role> {
  constructor(@InjectEntityManager() manager: EntityManager) {
    super(Role, manager);
  }

  async getDefaultRole(): Promise<Role> {
    const role = await this.findOne({ where: { name: 'USER' } });
    if (!role) throw new InternalServerErrorException('UNKNOWN');
    return role;
  }
}
