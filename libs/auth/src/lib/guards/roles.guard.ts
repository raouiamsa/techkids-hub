import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        // Lire l'étiquette @Roles() sur la route
        const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        // Si pas de @Roles() sur la route → tout le monde peut accéder
        if (!requiredRoles) return true;

        // Lire le rôle de l'utilisateur connecté (mis par le JwtAuthGuard)
        const { user } = context.switchToHttp().getRequest();
        return requiredRoles.includes(user.role);
    }
}
