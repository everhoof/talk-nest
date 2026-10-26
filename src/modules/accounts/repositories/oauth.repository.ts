import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { OAuth } from '@modules/accounts/entities/oauth.entity';

@Injectable()
export class OAuthRepository extends Repository<OAuth> {
  constructor(@InjectEntityManager() manager: EntityManager) {
    super(OAuth, manager);
  }
}
