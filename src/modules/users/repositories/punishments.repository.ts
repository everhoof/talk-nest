import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, IsNull } from 'typeorm';
import { BasicRepository } from '@modules/common/repositories/basic.repository';
import { Punishment } from '@modules/users/entities/punishments.entity';

@Injectable()
export class PunishmentsRepository extends BasicRepository<Punishment> {
  constructor(@InjectEntityManager() manager: EntityManager) {
    super(Punishment, manager);
  }

  public getLastPunishment(userId: number): Promise<Punishment | null> {
    return this.findOne({
      where: {
        targetId: userId,
        canceledAt: IsNull(),
      },
    });
  }
}
