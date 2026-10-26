import { forwardRef, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '@modules/users/users.module';
import { TokensRepository } from '@modules/accounts/repositories/tokens.repository';
import { UsersRepository } from '@modules/users/repositories/users.repository';
import { BearerStrategy, BearerStrategyNoException } from '@modules/accounts/strategies/bearer.strategy';
import { AccountsResolver } from '@modules/accounts/accounts.resolver';
import { AccountsService } from '@modules/accounts/accounts.service';
import { RolesRepository } from '@modules/roles/repositories/roles.repository';
import { AnonymousStrategy } from '@modules/accounts/strategies/anonymous.strategy';
import { ConfirmationsRepository } from '@modules/accounts/repositories/confirmations.repository';
import { OAuthRepository } from '@modules/accounts/repositories/oauth.repository';

@Module({
  imports: [forwardRef(() => UsersModule), PassportModule],
  providers: [
    TokensRepository,
    UsersRepository,
    RolesRepository,
    ConfirmationsRepository,
    OAuthRepository,
    AccountsService,
    AccountsResolver,
    BearerStrategy,
    BearerStrategyNoException,
    AnonymousStrategy,
  ],
  exports: [AccountsService, TokensRepository],
})
export class AccountsModule {}
