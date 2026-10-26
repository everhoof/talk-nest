import { Injectable } from '@nestjs/common';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { databaseOptions } from '../../../database/options';

@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory {
  // eslint-disable-next-line class-methods-use-this
  async createTypeOrmOptions(): Promise<TypeOrmModuleOptions> {
    return databaseOptions();
  }
}
