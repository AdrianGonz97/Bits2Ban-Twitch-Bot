/* eslint-disable no-param-reassign */
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
    chatters: string[],
    isThanosSnap: boolean
) {
    logger.warn(`Initiating the banning of all viewers on channel ${broadcasterId}`);
    const segmentedUserIds = await getUserIds(broadcasterId, accessToken, chatters);
    await sleep(1000); // 1 sec delay
    const count = await banUsers(segmentedUserIds, accessToken, broadcasterId, duration, reason, isThanosSnap);
    return count;
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

    let count = 0;
    try {
        const results = await Promise.allSettled(promises);

        const segmentedUserIds = results.map((promise) => {
            if (promise.status === "fulfilled") {
                const resp = promise.value;
                if (resp.status >= 200 && resp.status < 300) {
                    const result: { data: UserInfo[] } = resp.data;
                    count += result.data.length;
                    logger.info(`SUCCESSFULLY got user info for ${result.data.length} chatters`);
                    return result.data.map((user) => user.id);
                }
                logger.error("Failed to get user info!");
            } else logger.error(promise.reason);
            return [];
        });

        logger.info(`SUCCESSFULLY acquired the user info of ${count} chatters for ${broadcasterId}`);
        return segmentedUserIds;
    } catch (err: any) {
        logger.error(err.message);
        return [];
    }
}

/* type BanResp = {
     broadcaster_id: string;
     moderator_id: string;
     user_id: string;
     end_time: string;
 };
async function bulkBanUsers(
    segmentedUserIds: string[][],
    accessToken: string,
    broadcasterId: string,
    duration: number,
    reason: string
) {
    let count = 0;
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
        const results = await Promise.allSettled(promises);
        results.forEach((promise) => {
            if (promise.status === "fulfilled") {
                const resp = promise.value;
                console.log(resp.headers);
                if (resp.status >= 200 && resp.status < 300) {
                    const result: { data: BanResp[]; errors: string[] } = resp.data;
                    count += result.data.length;
                    logger.warn(`SUCCESSFULLY banned ${result.data.length} viewers for ${broadcasterId}`);
                    result.errors.forEach((err) => logger.error(err));
                } else logger.error(`FAILED to ban users for ${broadcasterId}`);
            } else logger.error(promise.reason);
        });
    } catch (err: any) {
        logger.error(err.message);
    }
    return count;
} */

async function banUsers(
    segmentedUserIds: string[][],
    accessToken: string,
    broadcasterId: string,
    duration: number,
    reason: string,
    isThanosSnap: boolean
) {
    let count = 0;
    logger.warn(`Banning all viewers on channel ${broadcasterId}`);

    const urlParams = new Map();
    urlParams.set("broadcaster_id", broadcasterId);
    urlParams.set("moderator_id", broadcasterId);

    const userIds = scrambleArray(segmentedUserIds.flat(), isThanosSnap);
    const promises = userIds.map(async (id, index) => {
        const banTime = Math.floor((duration * 1000 - 200 * index) / 1000);
        const userBan: ChatterBan = {
            user_id: id,
            duration: banTime,
            reason,
        };

        const stringified = JSON.stringify({ data: userBan });
        await sleep(200 * index);

        return post("moderation/bans", stringified, accessToken, urlParams);
    });

    try {
        const results = await Promise.allSettled(promises);
        results.forEach((promise) => {
            if (promise.status === "fulfilled") {
                const resp = promise.value;
                // console.log(resp.headers);
                if (resp.status >= 200 && resp.status < 300) {
                    // const result: { data: BanResp[] } = resp.data;
                    count += 1;
                } else logger.error(`FAILED to ban users for ${broadcasterId}`);
            } else logger.error(promise.reason);
        });
    } catch (err: any) {
        logger.error(err.message);
    }
    logger.info(`SUCCESSFULLY banned ${count} viewers for ${broadcasterId}`);
    return count;
}

// returns an array of string arrays that are segmented into a given num of elements
function segmentArray(elementsPerArr: number, arr: string[]) {
    const listOfArrs: string[][] = [];
    for (let i = 0; i < arr.length; i += elementsPerArr) {
        const list = arr.slice(i, i + elementsPerArr);
        listOfArrs.push(list);
    }
    return listOfArrs;
}

function sleep(ms: number) {
    // eslint-disable-next-line no-promise-executor-return
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// shuffling an array: https://stackoverflow.com/questions/1519736/random-shuffling-of-an-array
function scrambleArray(arr: string[], isThanosSnap: boolean) {
    for (let i = 0; i < arr.length; i++) {
        const index = Math.floor(Math.random() * arr.length);
        const temp = arr[index];
        arr[index] = arr[i];
        arr[i] = temp;
    }
    return isThanosSnap ? arr.slice(0, Math.floor(arr.length / 2)) : arr;
}
