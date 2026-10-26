import { Strategy } from 'passport-http-bearer';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AccountsService } from '@modules/accounts/accounts.service';
import { User } from '@modules/users/entities/users.entity';

@Injectable()
export class BearerStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly accountsService: AccountsService) {
    super();
  }

  async validate(token: string): Promise<User> {
    const tokenEntity = await this.accountsService.validateUserByToken(token);
    if (!tokenEntity) {
      throw new UnauthorizedException();
    }
    return tokenEntity.owner;
  }
}

@Injectable()
export class BearerStrategyNoException extends PassportStrategy(Strategy, 'bearer-no-exception') {
  constructor(private readonly accountsService: AccountsService) {
    super();
  }

  async validate(token: string): Promise<User | number> {
    try {
      const tokenEntity = await this.accountsService.validateUserByToken(token);
      return tokenEntity?.owner || -1;
    } catch {
      return -1;
    }
  }
}
