import { Injectable } from '@nestjs/common';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { getConnectionOptions } from 'typeorm';

import { CustomNamingStrategy } from '.';

@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory {
  // eslint-disable-next-line class-methods-use-this
  async createTypeOrmOptions(): Promise<TypeOrmModuleOptions> {
    const options = await getConnectionOptions();
    return { ...options, namingStrategy: new CustomNamingStrategy() };
  }
}
