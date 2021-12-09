export type ChatterInfo = {
    channel: {
        chatters: {
            count: number;
            viewers: {
                login: string;
            }[];
        };
    };
};
