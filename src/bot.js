import tmi from "tmi.js";
import logger from "./logger/index.js";

const client = new tmi.Client({
    connection: {
        reconnect: true,
    },
    identity: {
        username: process.env.USERNAME,
        password: process.env.ACCESS_TOKEN,
    },
    channels: [process.env.WATCHED_CHANNEL],
});

client.connect();

client.on("message", async (channel, tags, message, self) => {
    const isNotBot = tags.username.toLowerCase() !== process.env.USERNAME;
    const rewardId = tags["custom-reward-id"];

    logger.info(`[CHAT]: ${tags["display-name"]}: ${message}`);

    try {
        // if user typed a number in chat, timeout
        if (
            !rewardId &&
            !isNaN(message) &&
            parseInt(message) > 1000 &&
            isNotBot
        ) {
            let timeoutTime = 10;
            // if they are a repeat offender
            if (baddies.has(tags.username)) {
                const baddie = baddies.get(tags.username);
                // within 60 seconds + previous timeout time
                if (
                    Date.now() <
                    baddie.time + 60000 + getTime(baddie.infractions) * 1000
                ) {
                    timeoutTime = getTime(baddie.infractions + 1);
                    baddie.infractions++;
                    baddie.time = Date.now();
                    baddies.set(tags.username, baddie);
                } else {
                    // reset their number if they aren't within 60s
                    const baddie = addBaddie();
                    baddies.set(tags.username, baddie);
                }
            } else {
                // otherwise, add them to the list of offenders
                const baddie = addBaddie();
                baddies.set(tags.username, baddie);
            }

            console.log(`[TIMEOUT]: ${tags.username}`);
            await client.timeout(
                channel,
                tags.username,
                timeoutTime,
                "Not using channel points for number guessing"
            );
            await client.say(
                channel,
                `@${tags.username} Please use the channel point rewards for guessing frostpBonk`
            );
        }
    } catch (err) {
        logger.error(err);
    }
});
