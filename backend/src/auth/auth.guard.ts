import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import axios from 'axios';
import { DatabaseService } from '../database/database.service';
import { User, Role } from '../types/User';
import { upsertUser, upsertUserLocal, getUserRole, setUserRole } from '../dao/UserDao';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(private db: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    if (request.url === '/auth/register' || request.url.startsWith('/admin/')) {
      return true;
    }

    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Authorization header missing');
    }

    try {
      if (authHeader.startsWith('Local ')) {
        return await this.handleLocalAuth(request, authHeader);
      }

      const token = authHeader.replace('Bearer ', '');
      if (token === authHeader) {
        throw new UnauthorizedException('Invalid Authorization header');
      }

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
      this.logger.error('Error while fetching userinfo:', err);
      throw new InternalServerErrorException('Internal server error');
    }
  }

  private async handleLocalAuth(request: any, authHeader: string): Promise<boolean> {
    const b64 = authHeader.slice(6);
    let decoded: string;
    try {
      decoded = Buffer.from(b64, 'base64').toString('utf-8');
    } catch {
      throw new UnauthorizedException('Invalid local auth encoding');
    }

    const colonIdx = decoded.indexOf(':');
    if (colonIdx === -1) {
      throw new UnauthorizedException('Invalid local auth format');
    }

    const username = decoded.slice(0, colonIdx);
    const uuid = decoded.slice(colonIdx + 1);

    if (!username || !uuid) {
      throw new UnauthorizedException('Invalid local auth credentials');
    }

    this.logger.log(`Local auth user="${username}" uuid="${uuid}" path="${request.url}"`);
    const user = await upsertUserLocal(this.db.db, uuid, username);
    this.logger.log(`Local auth result preferredUsername="${user?.preferredUsername}" role="${user?.role}"`);
    request.user = user;
    return true;
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
