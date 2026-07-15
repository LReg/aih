import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { Client, Attribute, Change } from 'ldapts';

interface LldapUser {
  id: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  uuid: string;
  creationDate: string;
}

interface CreateUserInput {
  id: string;
  email?: string;
  displayName?: string;
}

function deriveBaseDn(): string {
  const authDomain = process.env.AUTH_DOMAIN || '';
  const dotIndex = authDomain.indexOf('.');
  if (dotIndex > 0) {
    return authDomain.substring(dotIndex + 1).split('.').map(p => `dc=${p}`).join(',');
  }
  return process.env.LLDAP_LDAP_BASE_DN || 'dc=example,dc=com';
}

function deriveLdapHost(): string {
  const raw = process.env.LLDAP_URL || '';
  const host = raw.replace(/^https?:\/\//, '').replace(/:\d+$/, '');
  return `${host}:3890`;
}

@Injectable()
export class LldapService implements OnModuleInit {
  private readonly logger = new Logger(LldapService.name);
  private client: AxiosInstance;
  private baseUrl: string;
  private ldapHost: string;
  private baseDn: string;
  private token: string | null = null;

  constructor() {
    const raw = process.env.LLDAP_URL || '';
    this.baseUrl = raw ? (raw.startsWith('http') ? raw : `http://${raw}:17170`) : '';
    this.ldapHost = deriveLdapHost();
    this.baseDn = deriveBaseDn();

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async onModuleInit() {
    if (!this.baseUrl) {
      this.logger.warn('LLDAP_URL not set — registration disabled');
      return;
    }
    try {
      await this.authenticate();
      this.logger.log(`LLDAP connected — base DN: ${this.baseDn}`);
    } catch (err) {
      this.logger.error(`LLDAP init failed: ${err}`);
    }
  }

  get isEnabled() {
    return !!this.baseUrl;
  }

  private async authenticate(): Promise<void> {
    const res = await this.client.post('/auth/simple/login', {
      username: process.env.LLDAP_ADMIN_USERNAME || '',
      password: process.env.LLDAP_ADMIN_PASSWORD || '',
    });
    this.token = res.data.token;
  }

  private async refreshToken(): Promise<void> {
    await this.authenticate();
  }

  private authHeader(): string {
    if (!this.token) throw new Error('LLDAP not authenticated');
    return `Bearer ${this.token}`;
  }

  private async graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    try {
      const res = await this.client.post(
        '/api/graphql',
        { query, variables },
        { headers: { Authorization: this.authHeader() } },
      );
      if (res.data.errors) throw new Error(JSON.stringify(res.data.errors));
      return res.data.data;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        await this.refreshToken();
        return this.graphql<T>(query, variables);
      }
      throw err;
    }
  }

  async createUser(input: CreateUserInput): Promise<LldapUser> {
    const mutation = `
      mutation CreateUser($user: CreateUserInput!) {
        createUser(user: $user) {
          id
          email
          displayName
          firstName
          lastName
          uuid
          creationDate
        }
      }
    `;
    const data = await this.graphql<{ createUser: LldapUser }>(mutation, { user: input });
    this.logger.log(`LLDAP user created: ${input.id}`);
    return data.createUser;
  }

  async setPassword(userId: string, password: string): Promise<void> {
    const client = new Client({
      url: `ldap://${this.ldapHost}`,
      timeout: 5000,
      connectTimeout: 5000,
    });
    try {
      await client.bind(
        `uid=${process.env.LLDAP_ADMIN_USERNAME},ou=people,${this.baseDn}`,
        process.env.LLDAP_ADMIN_PASSWORD || '',
      );
      const change = new Change({
        operation: 'replace',
        modification: new Attribute({
          type: 'userPassword',
          values: [password],
        }),
      });
      const userDn = userId.includes(',') ? userId : `uid=${userId},ou=people,${this.baseDn}`;
      await client.modify(userDn, change);
      this.logger.log(`Password set for ${userId}`);
    } finally {
      await client.unbind().catch(() => {});
    }
  }
}
