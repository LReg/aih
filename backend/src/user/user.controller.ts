import { Controller, Get, Req } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from '../types/User';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('current')
  getCurrentUser(@Req() req: any): User {
    return req.user;
  }

  @Get('all')
  async getAllUsers(): Promise<User[]> {
    return this.userService.getAllUsers();
  }
}
