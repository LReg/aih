import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import axios from 'axios';
import { DatabaseService } from '../database/database.service';
import { User, Role } from '../types/User';
import { upsertUser, getUserRole, setUserRole } from '../dao/UserDao';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private db: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Authorization header missing');
    }

    const token = authHeader.replace('Bearer ', '');
    if (token === authHeader) {
      throw new UnauthorizedException('Invalid Authorization header');
    }

    try {
      const userinfoEndpoint = `https://${process.env.AUTH_DOMAIN}/api/oidc/userinfo`;
      const userInfo = await this.fetchUserInfo(userinfoEndpoint, token);
      if (!userInfo) {
        throw new UnauthorizedException('Invalid token');
      }
      await this.storeUserInDB(this.db.db, userInfo);
      request.user = {
        email: userInfo.email,
        name: userInfo.name,
        preferredUsername: userInfo.preferredUsername,
        role: userInfo.role,
      };
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      console.error('Error while fetching userinfo:', err);
      throw new InternalServerErrorException('Internal server error');
    }
  }

  private async storeUserInDB(db: import('mongodb').Db, user: User) {
    try {
      await upsertUser(db, user);
      let role = await getUserRole(db, user.preferredUsername);
      if (role === Role.NOROLE) {
        await setUserRole(db, user.preferredUsername, Role.USER);
        role = Role.USER;
      }
      user.role = role;
    } catch (err) {
      console.error('Error while storing user in DB:', err);
    }
  }

  private async fetchUserInfo(
    userinfoEndpoint: string,
    token: string,
  ): Promise<User | null> {
    const response = await axios.get(userinfoEndpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status !== 200) return null;
    response.data.preferredUsername = response.data.preferred_username;
    return response.data as User;
  }
}
