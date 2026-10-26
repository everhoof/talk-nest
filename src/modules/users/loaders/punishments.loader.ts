import { Injectable, Scope } from '@nestjs/common';
import { OrderedNestDataLoader } from '@modules/common/graphql/dataloader';
import { PunishmentsRepository } from '@modules/users/repositories/punishments.repository';
import { Punishment } from '@modules/users/entities/punishments.entity';
import { IsNull } from 'typeorm';

@Injectable({ scope: Scope.REQUEST })
export class PunishmentsLoader extends OrderedNestDataLoader<
  { targetId: Punishment['targetId']; type: Punishment['type'] },
  Punishment
> {
  constructor(private readonly punishments: PunishmentsRepository) {
    super();
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  protected getOptions = () => ({
    propertyKey: ['targetId', 'type'],
    query: async (keys: Array<{ targetId: Punishment['targetId']; type: Punishment['type'] }>) => {
      const punishments = await this.punishments.find({
        where: keys.map((key) => ({ ...key, canceledAt: IsNull() })),
      });
      return keys.map((key) => {
        return (
          punishments.find((punishment) => punishment.targetId === key.targetId && punishment.type === key.type) ||
          this.punishments.create({ targetId: key.targetId, type: key.type })
        );
      });
    },
  });
}
