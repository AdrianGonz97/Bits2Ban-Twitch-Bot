type Chatter = {
    login: string;
};

export type ChatterInfo = {
    channel: {
        chatters: {
            count: number;
            viewers: Chatter[];
            vips: Chatter[];
        };
    };
};
