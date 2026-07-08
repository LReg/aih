import { Controller, Get, Req } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from '../types/User';
import type { Request } from 'express';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('current')
  getCurrentUser(@Req() req: Request): User {
    return req.user;
  }

  @Get('all')
  async getAllUsers(): Promise<User[]> {
    return this.userService.getAllUsers();
  }
}
