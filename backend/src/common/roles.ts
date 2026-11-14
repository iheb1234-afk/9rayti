import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

export type Role = 'etudiant' | 'tuteur' | 'admin';

export interface AuthUser {
  sub: string;
  role: Role;
}

const ROLES_KEY = 'roles';
/** Restreint une route à un ou plusieurs rôles. Sans ce décorateur, tout compte connecté passe. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Injecte l'utilisateur connecté (contenu du jeton JWT) dans un paramètre de contrôleur. */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);

/**
 * Vérifie le jeton « Authorization: Bearer … », puis le rôle demandé par @Roles().
 * Côté Angular, les gardes de route cachent les pages ; ici, l'API refuse vraiment l'accès.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Connexion requise');
    try {
      req.user = this.jwt.verify<AuthUser>(header.slice(7));
    } catch {
      throw new UnauthorizedException('Session expirée, reconnecte-toi');
    }
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (roles && !roles.includes(req.user.role)) {
      throw new ForbiddenException('Cette action est réservée à un autre type de compte');
    }
    return true;
  }
}
