import { Repository, FindManyOptions, FindOptionsWhere, ObjectLiteral } from 'typeorm';
import { BadRequestException, InternalServerErrorException } from '@modules/common/exceptions/exceptions';
import { GetListArgs } from '@modules/common/args/get-list.args';

export class BasicRepository<Entity extends ObjectLiteral> extends Repository<Entity> {
  async getList(args: GetListArgs, options?: FindManyOptions<Entity>): Promise<Entity[]> {
    return this.find({
      skip: (args.page - 1) * args.count,
      take: args.count,
      ...(options ?? {}),
    });
  }

  async saveAndReturn(entity: Entity | undefined): Promise<Entity> {
    if (!entity) throw new InternalServerErrorException('UNKNOWN');
    entity = await this.save(entity);
    const saved = await this.findOneBy({ id: entity['id'] } as FindOptionsWhere<Entity>);
    if (!saved) throw new InternalServerErrorException('UNKNOWN');
    return saved;
  }

  async isExist(id: number): Promise<Entity> {
    if (!id) throw new InternalServerErrorException('UNKNOWN');
    const entity = await this.findOneBy({ id } as unknown as FindOptionsWhere<Entity>);
    if (!entity) throw new BadRequestException('FORBIDDEN');
    return entity;
  }
}
