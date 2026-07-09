import {Db, UpdateResult} from 'mongodb';
import {Role, User} from "../types/User";


export async function upsertUser(db: Db, user: User): Promise<UpdateResult | null> {
    const options = { upsert: true };

    try {
        return await db.collection<User>('user').updateOne(
            { email: user.email },
            { $set: { email: user.email, name: user.name, preferredUsername: user.preferredUsername } },
            options
        );
    } catch (err) {
        console.error('Error while upserting user:', err);
        throw err;
    }
}

export async function upsertUserLocal(db: Db, uuid: string, username: string): Promise<User> {
    const email = `${uuid}@local`;
    try {
        await db.collection<User>('user').updateOne(
            { email },
            {
                $set: {
                    email,
                    name: username,
                    preferredUsername: username,
                    localAuth: true,
                    role: Role.USER,
                },
            },
            { upsert: true }
        );
        const user = await db.collection<User>('user').findOne({ email });
        if (!user) throw new Error('Failed to create local user');
        return user;
    } catch (err) {
        console.error('Error while upserting local user:', err);
        throw err;
    }
}

export async function getUserRole(db: Db, preferredUsername: string): Promise<Role> {
    try {
        const user = await db.collection<User>('user').findOne({ preferredUsername });
        if (!user) {
            throw new Error('User not found');
        }
        if (!user.role) {
            return Role.NOROLE;
        }
        return user.role;
    } catch (err) {
        console.error('Error while fetching user role:', err);
        throw err;
    }
}

export async function setUserRole(db: Db, preferredUsername: string, role: Role): Promise<UpdateResult | null> {
    try {
        return await db.collection<User>('user').updateOne(
            { preferredUsername },
            {
                $set: { role }
            }
        );
    } catch (err) {
        console.error('Error while setting user role:', err);
        throw err;
    }
}

export async function getAllUsers(db: Db): Promise<User[]> {
    try {
        const usersCursor = await db.collection<User>('user').find({});
        return await usersCursor.toArray();
    } catch (err) {
        console.error('Error while fetching all users:', err);
        throw err;
    }
}
