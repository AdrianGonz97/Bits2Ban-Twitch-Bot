import tmi from "tmi.js";
import logger from "../../logger/index.js";
import refresh from "../oauth/refresh/index.js";
import { updateUser } from "../../db/index.js";

const clients = new Map();
const timeoutTime = process.env.TIMEOUT_TIME;
const bitTarget = process.env.BIT_AMOUNT;
const whitelist = ["moobot", "nightbot", "cokakoala"];

export async function start(access_token, login) {
    logger.info(`Starting Bot for ${login}`);
    const client = getClient(access_token, login);
    // clients.set(login, client);
    logger.warn(`Number of clients connected: ${clients.size}`);

    try {
        await client.connect();
    } catch (err) {
        logger.error(err);
        clients.delete(login);
    }
}

export async function loadBots(users) {
    for (const user of users) {
        // refresh every user token
        const token = await refresh(user.refresh_token);
        updateUser(token);
        logger.info(`Loading ${user.login}'s client.`);
        const client = getClient(token.access_token, token.login);
        // clients.set(user.login, client);
        logger.warn(`Number of clients connected: ${clients.size}`);

        try {
            await client.connect();
        } catch (err) {
            logger.error(err);
            clients.delete(login);
        }
    }
}

async function timeoutUser(client, channel, userToBan, banRequester) {
    try {
        // get list of mods for channel
        const mods = await client.mods(channel);
        await client.say(channel, `@${userToBan} do you have any final words?`);
        setTimeout(async () => {
            try {
                await client.timeout(
                    channel,
                    userToBan,
                    timeoutTime,
                    `Timed out for bits - requested by ${banRequester}`
                );
                await client.say(
                    channel,
                    `@${userToBan} was frostpBonk by @${banRequester}`
                );
                if (mods.includes(userToBan))
                    remodAfterBan(client, channel, userToBan);
                logger.info(`[TIMEOUT] [${channel}]: <${userToBan}>`);
            } catch (err) {
                logger.error(err);
            }
        }, 15000);
    } catch (err) {
        logger.error(err);
    }
}

async function pogOff(client, channel, userToBan) {
    try {
        // get list of mods for channel
        const mods = await client.mods(channel);
        await client.say(channel, `@${userToBan} ...really? WeirdChamp`);
        setTimeout(async () => {
            try {
                await client.timeout(
                    channel,
                    userToBan,
                    timeoutTime,
                    `Timed out for bits - uno reverse card`
                );
                await client.say(channel, `PogOFF @${userToBan}`);
                if (mods.includes(userToBan))
                    remodAfterBan(client, channel, userToBan);
                logger.info(`[TIMEOUT] [${channel}]: <${userToBan}>`);
            } catch (err) {
                logger.error(err);
            }
        }, 10000);
    } catch (err) {
        logger.error(err);
    }
}

function remodAfterBan(client, channel, username) {
    setTimeout(
        (client, channel, username) => {
            client
                .mod(channel, username)
                .then(() => logger.warn(`[MODDED] [${channel}]: <${username}>`))
                .catch((err) => logger.error(err));
        },
        timeoutTime * 1000 + 10000, // 10 sec buffer
        client,
        channel,
        username
    );
}

function getClient(access_token, login) {
    // destroy old client it one already exists
    if (clients.has(login)) {
        logger.info(
            `A bot already exists for ${login}'s channel. Deleting...'`
        );
        const client = clients.get(login);
        client.disconnect().catch((err) => logger.error(err));
    }

    const client = new tmi.Client({
        // options: { debug: true },
        connection: {
            reconnect: true,
            secure: true,
        },
        identity: {
            username: login,
            password: access_token,
        },
        channels: [login],
        logger: logger,
    });

    client.on("cheer", (channel, userstate, message) => {
        const bitAmount = userstate.bits;
        logger.info(`[CHEER] [${channel}] <${userstate.username}>: ${message}`);
        // anyone on the whitelist can cheer at any amount to ban someone of their choice
        if (bitAmount === bitTarget || whitelist.includes(userstate.username)) {
            const regex = /([^ "]*\CHEER[^ "]*)/g; // removes all cheers from string
            const parsedMsg = message
                .toUpperCase()
                .replace(regex, "")
                .toLowerCase();
            const words = parsedMsg.split(" ");
            const found = words.find(
                // shortest possible username is 3 chars
                (el) => el[0] === "@" && el.length > 4
            );
            if (!!found) {
                const username = found.slice(1); // removes the @
                const banRequester = userstate.username;
                // if the banner requests to ban the broadcaster or someone in the whitelist
                if (username === login || whitelist.includes(username)) {
                    // ban the requester
                    pogOff(client, channel, banRequester);
                } else {
                    // otherwise, proceed as normal
                    timeoutUser(client, channel, username, banRequester);
                }
            } else {
                logger.warn(
                    `[${channel}] No username was tagged in ${userstate.username}'s message`
                );
            }
        }
    });

    client.on("connected", () => {
        logger.info(`Connected to ${login}'s channel`);
        clients.set(login, client);
    });

    client.on("disconnected", (reason) => {
        logger.warn(`Disconnected from ${login}'s channel: ${reason}`);
        clients.delete(login);
    });

    return client;
}

export async function stopBot(login) {
    const client = clients.get(login);
    if (!client) return;
    logger.warn(`Stopping Bot for [${login}]`);
    try {
        await client.disconnect();
        logger.warn(`Disconnected bot for ${login}`);
    } catch (err) {
        logger.error(err);
    }
}

export async function getActiveClients(req, res) {
    const activeClients = [...clients.keys()];
    res.status(200).json({ activeClients: activeClients });
}
