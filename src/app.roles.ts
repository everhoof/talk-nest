import { RolesBuilder } from 'nest-access-control';

export enum AppRoles {
  BROADCASTER = 'BROADCASTER',
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR',
  USER = 'USER',
  UNVERIFIED_USER = 'UNVERIFIED_USER',
}

export enum RoleResources {
  POLL = 'poll',
  MESSAGE = 'message',
  DELETED_MESSAGE = 'deleted-message',
  MUTE = 'mute',
  BAN = 'ban',
  USER_SETTINGS = 'user-settings',
}

export const roles: RolesBuilder = new RolesBuilder();

roles
  .grant(AppRoles.UNVERIFIED_USER)
  .read(RoleResources.MESSAGE)
  .deleteOwn(RoleResources.MESSAGE)
  .updateOwn(RoleResources.MESSAGE);
roles.grant(AppRoles.USER).extend(AppRoles.UNVERIFIED_USER);
roles
  .grant(AppRoles.MODERATOR)
  .extend(AppRoles.USER)
  .createOwn(RoleResources.POLL)
  .read(RoleResources.DELETED_MESSAGE)
  .readAny(RoleResources.MESSAGE)
  .deleteAny(RoleResources.MESSAGE)
  .update(RoleResources.MUTE)
  .readAny(RoleResources.USER_SETTINGS);
roles.grant(AppRoles.ADMIN).extend(AppRoles.MODERATOR).update(RoleResources.BAN);
roles.grant(AppRoles.BROADCASTER).extend(AppRoles.UNVERIFIED_USER).createOwn(RoleResources.POLL);
