import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { User } from '../types/User';
import { getAllUsers } from '../dao/UserDao';

@Injectable()
export class UserService {
  constructor(private db: DatabaseService) {}

  async getAllUsers(): Promise<User[]> {
    return getAllUsers(this.db.db);
  }
}
