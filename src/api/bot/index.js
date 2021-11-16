import tmi from "tmi.js";
import logger from "../../logger/index.js";
import refresh from "../oauth/refresh/index.js";
import { updateUser } from "../../db/index.js";

const clients = new Map();
const timeoutTime = 609; //60 * 10; // 10 mins
const bitTarget = 2000;

export async function start(req, res) {
    const { access_token, login } = req.body;
    const client = getClient(access_token, login);

    try {
        await client.connect();

        res.status(200).json({
            message: `Connected bot to ${login}'s channel`,
        });
    } catch (err) {
        res.status(401).json({
            message: "Bot connection unsuccessful",
        });
    }
}

async function timeoutUser(client, channel, userToBan) {
    try {
        // get list of mods for channel
        const mods = await client.mods(channel);
        await client.timeout(
            channel,
            userToBan,
            timeoutTime,
            "Timed out for bits"
        );
        if (mods.includes(userToBan)) remodAfterBan(client, channel, userToBan);
        logger.info(`[TIMEOUT] [${channel}]: <${userToBan}>`);
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

export async function loadBots(users) {
    for (const user of users) {
        // refresh every user token
        const token = await refresh(user.refresh_token);
        updateUser(token);
        logger.info(`Loading ${user.login}'s client.`);
        const client = getClient(token.access_token, token.login);

        try {
            await client.connect();
        } catch (err) {
            logger.error(err);
        }
    }
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
        if (bitAmount >= bitTarget) {
            console.log(bitAmount);
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
                timeoutUser(client, channel, username);
            } else {
                logger.warn(
                    `[${channel}] No username was tagged in ${userstate.username}'s message`
                );
            }
        }
    });

    client.on("connected", () => {
        logger.info(`Connected to ${login}'s channel`);
    });

    client.on("disconnected", (reason) => {
        logger.warn(`Disconnected from ${login}'s channel: ${reason}`);
        clients.delete(login);
    });

    clients.set(login, client);

    return client;
}

export async function stopBot(login) {
    const client = clients.get(login);
    try {
        await client.disconnect();
        logger.warn(`Disconnected bot for ${login}`);
    } catch (err) {
        logger.error(err.message);
    }
}
