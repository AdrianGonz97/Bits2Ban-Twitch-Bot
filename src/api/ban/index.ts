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
    const segmentedUserIds = await getUserIds(broadcasterId, accessToken, chatters);
    await banUsers(segmentedUserIds, accessToken, broadcasterId, duration, reason);
}

async function getUserIds(broadcasterId: string, accessToken: string, chatters: string[]) {
    // gets IDs of all users as they are required to ban them
    logger.warn(`Fetching UserIDs of all viewers on channel ${broadcasterId}`);

    const segmentedChatters = segmentArray(100, chatters);
    const promises = segmentedChatters.map((arr) => {
        const userParams = new Map();
        const formattedUsers = arr.join("&login=");
        userParams.set("login", formattedUsers);
        return get("users", accessToken, userParams);
    });

    try {
        const results = await Promise.all(promises);

        const segmentedUserIds = results.map((resp) => {
            if (resp.status >= 200 && resp.status < 300) {
                logger.info("Got new user info");
                const result: { data: UserInfo[] } = resp.data;
                return result.data.map((user) => user.id);
            }
            logger.warn("Failed to get user info!");
            return [];
        });

        return segmentedUserIds;
    } catch (err: any) {
        logger.error(err.message);
        return [];
    }
}

async function banUsers(
    segmentedUserIds: string[][],
    accessToken: string,
    broadcasterId: string,
    duration: number,
    reason: string
) {
    logger.warn(`Banning all viewers on channel ${broadcasterId}`);

    const urlParams = new Map();
    urlParams.set("broadcaster_id", broadcasterId);
    urlParams.set("moderator_id", broadcasterId);

    const promises = segmentedUserIds.map((idArr) => {
        const body: ChatterBan[] = idArr.map((id) => {
            const userBan: ChatterBan = {
                user_id: id,
                duration,
                reason,
            };
            return userBan;
        });

        const stringified = JSON.stringify({ data: body });
        return post("moderation/bans", stringified, accessToken, urlParams);
    });

    try {
        const results = await Promise.all(promises);
        results.forEach((resp) => {
            if (resp.status >= 200 && resp.status < 300) {
                logger.warn(`Viewers have been succesfully banned for ${broadcasterId}`);
            } else logger.error(`FAILED to ban users for ${broadcasterId}`);
        });
    } catch (err: any) {
        logger.error(err.message);
    }
}

function segmentArray(elementsPerArr: number, arr: string[]) {
    const listOfArrs: string[][] = [];
    for (let i = 0; i < arr.length; i += elementsPerArr) {
        const list = arr.slice(i, i + elementsPerArr);
        listOfArrs.push(list);
    }
    return listOfArrs;
}
