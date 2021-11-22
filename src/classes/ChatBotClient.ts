/* eslint-disable no-restricted-globals */
/* eslint-disable radix */
import tmi, { Client } from "tmi.js";
import { EventEmitter } from "events";
import logger from "$logger";

export default class ChatBotClient extends EventEmitter {
    static clients = new Map<string, ChatBotClient>();

    private owner: string;

    private client: Client;

    timeoutTime = 609; // seconds

    bitTarget = "2000"; // bits

    message = "was banned by"; // BannedUser was banned by BanRequester

    whitelist;

    constructor(accessToken: string, login: string) {
        super();
        this.whitelist = ["moobot", "nightbot", "cokakoala", login];
        this.owner = login;
        this.client = new tmi.Client({
            options: { debug: true },
            connection: {
                reconnect: true,
                secure: true,
            },
            identity: {
                username: login,
                password: accessToken,
            },
            channels: [login],
            logger,
        });
        this.setEvents();
    }

    start() {
        this.client.connect().catch((err) => logger.error(err));
    }

    stop() {
        this.client.disconnect().catch((err) => logger.error(err));
    }

    private setEvents() {
        this.client.on("cheer", (channel: string, userstate: tmi.ChatUserstate, message: string) => {
            const banRequester = userstate.username ?? "";
            logger.info(`[CHEER] [${channel}] <${banRequester}>: ${message}`);
            // anyone on the whitelist can cheer at any amount to timeout someone
            if (userstate.bits === this.bitTarget || this.whitelist.includes(banRequester)) {
                // removes all "cheer####" from string
                const regex = /([^ "]*CHEER[^ "]*)/g;
                const parsedMsg = message.toUpperCase().replace(regex, "").toLowerCase();
                const words = parsedMsg.split(" ");
                const found = words.find(
                    // shortest possible username is 3 chars
                    (el) => el[0] === "@" && el.length > 4
                );
                if (found) {
                    const userToBan = found.slice(1); // removes the @
                    // if the banner requests to ban the broadcaster or someone in the whitelist
                    if (userToBan === this.owner || this.whitelist.includes(userToBan)) {
                        // ban the requester
                        this.pogOff(channel, banRequester);
                    } else {
                        // otherwise, proceed as normal
                        this.timeoutUser(channel, userToBan, banRequester);
                    }
                } else {
                    logger.warn(`[${channel}] No username was tagged in ${userstate.username}'s message`);
                }
            }
        });

        this.client.on("message", (channel, tags, message) => {
            const username = tags.username?.toLowerCase();
            if (username === this.owner || username === "cokakoala") {
                if (message[0] === "!") {
                    const args: string[] = message.split(" ");
                    const cmd = args.shift()?.replace("!", "");
                    if (cmd === "b2b") {
                        this.commandHandler(this.client, channel, args);
                    }
                }
            }
        });

        this.client.on("connected", () => {
            logger.info(`Connected to ${this.owner}'s channel`);
            ChatBotClient.clients.set(this.owner, this);
            logger.warn(`Number of clients connected: ${ChatBotClient.clients.size}`);
        });

        this.client.on("disconnected", (reason: string) => {
            logger.warn(`Disconnected from ${this.owner}'s channel: ${reason}`);
            ChatBotClient.clients.delete(this.owner);
            logger.warn(`Number of clients connected: ${ChatBotClient.clients.size}`);
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private commandHandler(client: Client, channel: string, args: any) {
        const arg = args.shift();
        switch (arg) {
            case "msg": {
                const newMsg = args.join(" ");
                logger.warn(`Channel [${channel}] has changed timeout message from ${this.message} --> ${newMsg}`);
                this.message = args.join(" ");
                client
                    .say(channel, `When someone is banned, the message will now say "UserA ${this.message} UserB"`)
                    .catch((err) => logger.error(err));
                this.emit("message", this.owner, this.message);
                break;
            }
            case "cost": {
                if (!isNaN(args[0]) && parseInt(args[0]) < 1000000 && parseInt(args[0]) >= 0) {
                    const newBitTarget = args.shift();
                    logger.warn(
                        `Channel [${channel}] has changed bit target from ${this.bitTarget} --> ${newBitTarget}`
                    );
                    this.bitTarget = newBitTarget;
                    client
                        .say(channel, `Bit target amount has been set to ${this.bitTarget} bits`)
                        .catch((err) => logger.error(err));
                    this.emit("cost", this.owner, this.bitTarget);
                } else {
                    client
                        .say(
                            channel,
                            "Invalid number of bits. Must be within the range of [0 - 1000000]. A 0 indicates an OFF state."
                        )
                        .catch((err) => logger.error(err));
                }
                break;
            }
            case "time": {
                if (!isNaN(args[0]) && parseInt(args[0]) < 1209600 && parseInt(args[0]) >= 1) {
                    const newTime = parseInt(args[0]);
                    logger.warn(
                        `Channel [${channel}] has changed timeout time from ${this.timeoutTime} --> ${newTime}`
                    );
                    this.timeoutTime = newTime;
                    client
                        .say(channel, `Timeout time has been set to ${this.timeoutTime} seconds`)
                        .catch((err) => logger.error(err));
                    this.emit("time", this.owner, this.bitTarget);
                } else {
                    client
                        .say(channel, "Invalid number of seconds. Must be within the range of [1 - 1209600]")
                        .catch((err) => logger.error(err));
                }
                break;
            }
            default:
                client.say(channel, "Usage: !b2b [msg | cost | time] [args]").catch((err) => logger.error(err));
                break;
        }
    }

    private async timeoutUser(channel: string, userToBan: string, banRequester: string) {
        try {
            // get list of mods for channel
            const mods = await this.client.mods(channel);
            await this.client.say(channel, `@${userToBan} do you have any final words?`);
            setTimeout(async () => {
                try {
                    await this.client.timeout(
                        channel,
                        userToBan,
                        this.timeoutTime,
                        `Timed out for bits - requested by ${banRequester}`
                    );
                    await this.client.say(channel, `@${userToBan} ${this.message} @${banRequester}`);
                    if (mods.includes(userToBan)) this.remodAfterBan(channel, userToBan);
                    logger.info(`[TIMEOUT] [${channel}]: <${userToBan}>`);
                } catch (err) {
                    logger.error(err);
                }
            }, 15000);
        } catch (err) {
            logger.error(err);
        }
    }

    private async pogOff(channel: string, userToBan: string) {
        try {
            // get list of mods for channel
            const mods = await this.client.mods(channel);
            await this.client.say(channel, `@${userToBan} ...really? WeirdChamp`);
            setTimeout(async () => {
                try {
                    await this.client.timeout(
                        channel,
                        userToBan,
                        this.timeoutTime,
                        `Timed out for bits - uno reverse card`
                    );
                    await this.client.say(channel, `PogOFF @${userToBan}`);
                    if (mods.includes(userToBan)) this.remodAfterBan(channel, userToBan);
                    logger.info(`[TIMEOUT] [${channel}]: <${userToBan}>`);
                } catch (err) {
                    logger.error(err);
                }
            }, 10000);
        } catch (err) {
            logger.error(err);
        }
    }

    /* if a mod was timedout, remod the user after the timeout ends */
    private remodAfterBan(channel: string, username: string) {
        setTimeout(
            (client: tmi.Client, chan, name) => {
                client
                    .mod(chan, name)
                    .then(() => logger.warn(`[MODDED] [${chan}]: <${name}>`))
                    .catch((err) => logger.error(err));
            },
            this.timeoutTime * 1000 + 10000, // 10 sec buffer
            this.client,
            channel,
            username
        );
    }
}
