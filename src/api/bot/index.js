import tmi from "tmi.js";
import logger from "../../logger/index.js";

const clients = new Map();
const timeoutTime = 10; //60 * 10; // 10 mins
const bitTarget = 1;

export async function start(req, res) {
    const { access_token, login } = req.body;

    // destroy old client it one already exists
    if (clients.has(login)) {
        logger.info(
            `A bot already exists for ${login}'s channel. Deleting...'`
        );
        const client = clients.get(login);
        client.disconnect().catch((err) => logger.error(err));
        // clients.delete(login);
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
        channels: ["frostprime_"],
    });

    try {
        await client.connect();

        client.on("cheer", (channel, userstate, message) => {
            const bitAmount = userstate.bits;
            logger.info(
                `[CHEER] [#${channel}] <${userstate.username}>: ${message}`
            );
            if (bitAmount >= bitTarget) {
                console.log(bitAmount);
                const regex = /([^ "]*\CHEER[^ "]*)/g; // removes all cheers from string
                const parsedMsg = message
                    .toUpperCase()
                    .replace(regex, "")
                    .toLowerCase();
                const words = parsedMsg.split(" ");
                const found = words.find(
                    // shortest possible name is 3 chars
                    (el) => el[0] === "@" && el.length > 4
                );
                if (!!found) {
                    const username = found.slice(1); // removes the @
                    timeoutUser(channel, username);
                } else {
                    logger.warn("No name was tagged");
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

        res.status(200).json({
            message: `Connected bot to ${login}'s channel`,
        });
    } catch (err) {
        res.status(401).json({
            message: "Bot connection unsuccessful",
        });
    }
}

export async function stop(req, res) {
    const { login } = req.body;
    const client = clients.get(login);

    try {
        await client.disconnect();

        res.status(200).json({ message: `Disconnected bot for ${login}` });
    } catch (err) {
        res.status(401).json({
            message: "Bot disconnection unsuccessful",
        });
    }
}

async function timeoutUser(login, bannedUser) {
    const client = clients.get(login);
    try {
        await client.timeout(
            login,
            bannedUser,
            timeoutTime,
            "Not using channel points for number guessing"
        );
        logger.info(`[TIMEOUT]: ${bannedUser}`);
    } catch (err) {
        logger.error(err);
    }
}
