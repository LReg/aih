export enum Role {
    NOROLE = 'noRole',
    ADMIN = 'admin',
    USER = 'user'
}
export interface User {
    userId: string;
    email: string;
    name: string;
    preferredUsername: string;
    role: Role;
    localAuth?: boolean;
}