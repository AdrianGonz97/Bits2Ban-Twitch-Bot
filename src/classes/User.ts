export type User = {
    login: string;
    displayName: string;
    userId: string;
    profileImageUrl: string;
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string[];
    token_type: string;
    _id?: string;
};
