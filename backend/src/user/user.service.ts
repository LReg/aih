import { Injectable, Inject } from '@nestjs/common';
import { DB_PROVIDER, DbProvider } from '../database/database.module';
import { User } from '../types/User';
import { getAllUsers } from '../dao/UserDao';

@Injectable()
export class UserService {
  constructor(@Inject(DB_PROVIDER) private dbProvider: DbProvider) {}

  async getAllUsers(): Promise<User[]> {
    return getAllUsers(this.dbProvider.db);
  }
}
