type Chatters = {
    broadcaster: string[];
    vips: string[];
    moderators: string[];
    staff: string[];
    admins: string[];
    global_mods: string[];
    viewers: string[];
};

export type ChatterInfo = {
    _links: string[];
    chatter_count: number;
    chatters: Chatters;
};
