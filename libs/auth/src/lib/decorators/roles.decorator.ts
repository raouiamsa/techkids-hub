import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client'; // On réutilise l'enum Prisma !

export const ROLES_KEY = 'roles';
// Ce décorateur prend une liste de rôles et les attache à la route
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
