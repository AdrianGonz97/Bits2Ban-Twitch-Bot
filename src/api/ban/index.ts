/* eslint-disable no-use-before-define */
import { post, get } from "$src/util/twitch/api";
import logger from "$logger";
import { UserInfo } from "$class/UserInfo";

type ChatterBan = {
    user_id: string;
    duration: number;
    reason: string;
};

export default async function ban(
    accessToken: string,
    broadcasterId: string,
    duration: number,
    reason: string,
    chatters: string[]
) {
    logger.warn(`Initiating the banning of all viewers on channel ${broadcasterId}`);
    const userIds = await getUserIds(broadcasterId, accessToken, chatters);

    const urlParams = new Map();
    urlParams.set("broadcaster_id", broadcasterId);
    urlParams.set("moderator_id", broadcasterId);
    const body: ChatterBan[] = userIds.map((id) => {
        const userBan: ChatterBan = {
            user_id: id,
            duration,
            reason,
        };
        return userBan;
    });

    const stringified = JSON.stringify({ data: body });
    console.log(stringified);

    logger.warn(`Banning all viewers on channel ${broadcasterId}`);
    try {
        const resp = await post("moderation/bans", stringified, accessToken, urlParams);

        if (resp.status >= 200 && resp.status < 300) {
            logger.warn(`Viewers have been succesfully banned for ${broadcasterId}`);
        }
    } catch (error: any) {
        logger.error(error.message);
    }
}

async function getUserIds(broadcasterId: string, accessToken: string, chatters: string[]) {
    // gets IDs of all users as they are required to ban them
    const userParams = new Map();
    const formattedUsers = chatters.join("&login=");
    userParams.set("login", formattedUsers);
    try {
        logger.warn(`Fetching UserIDs of all viewers on channel ${broadcasterId}`);
        const resp = await get("users", accessToken, userParams);
        if (resp.status >= 200 && resp.status < 300) {
            logger.info("Got new user info");
            const result: { data: UserInfo[] } = resp.data;
            return result.data.map((user) => user.id);
        }

        logger.warn("Failed to get user info!");
        return [];
    } catch (err) {
        logger.error(err);
        return [];
    }
}
