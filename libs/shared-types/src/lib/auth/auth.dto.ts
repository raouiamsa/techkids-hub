import { IsEmail, IsString, MinLength, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
    @ApiProperty({ example: 'student@techkids.com' })
    @IsEmail()
    email!: string;

    @ApiProperty({ example: 'Password123!' })
    @IsString()
    @MinLength(6)
    password!: string;

    @ApiProperty({ example: 'Ahmed' })
    @IsString()
    firstName!: string;

    @ApiProperty({ example: 'Ben Ali' })
    @IsString()
    lastName!: string;

    @ApiPropertyOptional({ enum: ['PARENT', 'STUDENT'], default: 'STUDENT' })
    @IsOptional()
    @IsIn(['PARENT', 'STUDENT'])
    role?: 'PARENT' | 'STUDENT';
}

export class LoginDto {
    @ApiProperty({ example: 'admin@techkids.com' })
    @IsEmail()
    email!: string;

    @ApiProperty({ example: 'Admin123!' })
    @IsString()
    password!: string;
}

export class VerifyEmailDto {
    @ApiProperty({ example: 'student@techkids.com' })
    @IsEmail()
    email!: string;

    @ApiProperty({ example: '123456' })
    @IsString()
    code!: string;
}

export class ResendVerificationDto {
    @ApiProperty({ example: 'student@techkids.com' })
    @IsEmail()
    email!: string;
}
