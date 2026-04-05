import { PrismaService } from './database.js';

describe('PrismaService', () => {
  it('should be defined', () => {
    const service = new PrismaService();
    expect(service).toBeDefined();
    service.$disconnect();
  });
});
