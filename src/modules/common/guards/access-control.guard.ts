import { CanActivate, Injectable, ExecutionContext, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IQueryInfo } from 'accesscontrol';
import { User } from '@modules/users/entities/users.entity';
import { GqlExecutionContext } from '@nestjs/graphql';
import { roles } from '../../../app.roles';

const requiredRoles = 'roles';
export const UseRoles = (...permissions: IQueryInfo[]) => SetMetadata(requiredRoles, permissions);

@Injectable()
export class ACGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permissions = this.reflector.get<IQueryInfo[]>(requiredRoles, context.getHandler());
    if (!permissions) return true;
    const user: User | undefined = GqlExecutionContext.create(context).getContext().req?.user;
    if (!user) throw new UnauthorizedException();
    return permissions.every((permission) => roles.permission({ ...permission, role: user.roleNames }).granted);
  }
}
