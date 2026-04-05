// Guards & Strategy (utilisés uniquement dans l'api-gateway)
export * from './lib/auth.module';
export * from './lib/strategies/jwt.strategy';
export * from './lib/guards/jwt-auth.guard';
export * from './lib/guards/roles.guard';
export * from './lib/decorators/roles.decorator';

