import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { MongoClient, Db } from 'mongodb';

@Injectable()
export class DatabaseService implements OnApplicationBootstrap {
  public client!: MongoClient;
  public db!: Db;

  async onApplicationBootstrap() {
    const uri = process.env.MONGO_URI;
    if (!uri) {
      console.error('MONGO_URI environment variable not set.');
      process.exit(1);
    }
    this.client = new MongoClient(uri);
    await this.client.connect();
    await this.client.db().admin().ping();
    this.db = this.client.db('public');
    console.log('Successfully connected to MongoDB');
  }
}
