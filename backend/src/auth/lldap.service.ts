import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

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

@Injectable()
export class LldapService implements OnModuleInit {
  private readonly logger = new Logger(LldapService.name);
  private client: AxiosInstance;
  private token: string | null = null;
  private baseUrl: string;
  private ldapUsername: string;
  private ldapPassword: string;
  private ldapUrl: string;

  constructor() {
    const raw = process.env.LLDAP_URL || '';
    this.baseUrl = raw ? (raw.startsWith('http') ? raw : `http://${raw}:17170`) : '';
    this.ldapUsername = process.env.LLDAP_ADMIN_USERNAME || '';
    this.ldapPassword = process.env.LLDAP_ADMIN_PASSWORD || '';
    this.ldapUrl = process.env.LLDAP_LDAP_URL || (this.baseUrl ? this.baseUrl.replace(/^http/, 'ldap').replace(/:\d+$/, ':3890') : '');

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
      this.logger.log('LLDAP connected');
    } catch (err) {
      this.logger.error(`LLDAP init failed: ${err}`);
    }
  }

  get isEnabled() {
    return !!this.baseUrl;
  }

  private async authenticate(): Promise<void> {
    const res = await this.client.post('/auth/simple/login', {
      username: this.ldapUsername,
      password: this.ldapPassword,
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
    if (!this.ldapUrl) {
      this.logger.warn(`LLDAP_LDAP_URL not set — skipping password set for ${userId}`);
      return;
    }
    const { Client, Attribute, Change } = await import('ldapts');
    const client = new Client({ url: this.ldapUrl, timeout: 5000, connectTimeout: 5000 });
    try {
      const baseDn = process.env.LLDAP_BASE_DN || 'dc=example,dc=com';
      await client.bind(`uid=${this.ldapUsername},ou=people,${baseDn}`, this.ldapPassword);
      const change = new Change({
        operation: 'replace',
        modification: new Attribute({ type: 'userPassword', values: [password] }),
      });
      await client.modify(`uid=${userId},ou=people,${baseDn}`, change);
      this.logger.log(`Password set for ${userId}`);
    } finally {
      await client.unbind();
    }
  }
}
