import { Module, Global } from '@nestjs/common';
import { MongoClient } from 'mongodb';

export const DB_PROVIDER = 'DB_PROVIDER';

export interface DbProvider {
  client: MongoClient;
  db: import('mongodb').Db;
}

@Global()
@Module({
  providers: [
    {
      provide: DB_PROVIDER,
      useFactory: async (): Promise<DbProvider> => {
        const uri = process.env.MONGO_URI;
        if (!uri) {
          console.error('MONGO_URI environment variable not set.');
          process.exit(1);
        }
        const client = new MongoClient(uri);
        await client.connect();
        await client.db().admin().ping();
        console.log('Successfully connected to MongoDB');
        return { client, db: client.db('public') };
      },
    },
  ],
  exports: [DB_PROVIDER],
})
export class DatabaseModule {}
