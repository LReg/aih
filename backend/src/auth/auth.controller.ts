import { Controller, Post, Body, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { LldapService } from './lldap.service';

class RegisterDto {
  email = '';
  name?: string;
  password = '';
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private lldap: LldapService) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    if (!this.lldap.isEnabled) {
      throw new BadRequestException('Registration is disabled');
    }

    const { email, password } = body;

    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestException('Invalid email format');
    }

    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const name = body.name || email.split('@')[0];

    try {
      const user = await this.lldap.createUser({
        id: email,
        email,
        displayName: name,
      });

      await this.lldap.setPassword(email, password);

      this.logger.log(`User registered: ${email}`);

      return {
        success: true,
        message: 'Registration successful',
        user: { id: user.id, email: user.email, displayName: user.displayName },
      };
    } catch (err: any) {
      if (`${err}`.includes('UNIQUE') || `${err}`.includes('already exists')) {
        throw new BadRequestException('Email is already taken');
      }
      this.logger.error(`Registration failed for ${email}: ${err}`);
      throw new InternalServerErrorException('Registration failed');
    }
  }
}
