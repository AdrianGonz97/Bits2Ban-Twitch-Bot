/* eslint-disable camelcase */
/* eslint-disable no-restricted-globals */
/* eslint-disable radix */
import tmi, { Client } from "tmi.js";
import { EventEmitter } from "events";
import logger from "$logger";
import { User } from "$class/User";

type BanRequest = {
    userToBan: string;
    banRequester: string;
    timeout: NodeJS.Timeout;
    count: number;
};
export default class ChatBotClient extends EventEmitter {
    static clients = new Map<string, ChatBotClient>();

    private banQueue: Array<BanRequest> = [];

    private owner: string;

    private client: Client;

    timeoutTime; // seconds

    bitTarget; // bits

    message; // BannedUser *message* BanRequester

    whitelist;

    constructor(user: User) {
        super();
        this.whitelist = ["moobot", "nightbot", "cokakoala", user.login];
        this.owner = user.login;
        this.client = new tmi.Client({
            options: { debug: true },
            connection: {
                reconnect: true,
                secure: true,
            },
            identity: {
                username: user.login,
                password: user.access_token,
            },
            channels: [user.login],
            logger,
        });
        this.timeoutTime = user.timeoutTime;
        this.bitTarget = user.bitTarget;
        this.message = user.message;
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
                const banRequest = this.banQueue.find((request) => request.userToBan === banRequester);
                if (banRequest) {
                    // if this is a uno reverse card
                    clearTimeout(banRequest.timeout);
                    this.banQueue = this.banQueue.filter(
                        (ban) => ban.userToBan !== banRequester || ban.banRequester !== banRequest.banRequester
                    ); // removes this ban from list
                    this.timeoutUser(channel, banRequest.banRequester, banRequest.userToBan, true, banRequest.count);
                } else {
                    // if just a normal ban req
                    const parsedMsg = message.toLowerCase();
                    const words = parsedMsg.split(" ");
                    const found = words.find(
                        // shortest possible username is 4 chars
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
                    this.emit("time", this.owner, this.timeoutTime);
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

    private async timeoutUser(channel: string, userToBan: string, banRequester: string, isUno = false, count = 0) {
        try {
            // get list of mods for channel
            const mods = await this.client.mods(channel);
            // if uno reverse card type
            if (isUno) await this.client.say(channel, `@${userToBan} UNO REVERSE CARD, any final words?`);
            else await this.client.say(channel, `@${userToBan} do you have any final words?`);
            const newBanRequest: BanRequest = {
                userToBan,
                banRequester,
                count: count + 1,
                timeout: setTimeout(async () => {
                    try {
                        await this.client.timeout(
                            channel,
                            userToBan,
                            Math.min(this.timeoutTime * (count + 1), 1209600), // need to cap timeout at 2 weeks
                            `Timed out for bits - requested by ${banRequester}`
                        );
                        await this.client.say(channel, `@${userToBan} ${this.message} @${banRequester}`);
                        if (mods.includes(userToBan))
                            this.remodAfterBan(channel, userToBan, Math.min(this.timeoutTime * (count + 1), 1209600));
                        logger.info(`[TIMEOUT] [${channel}]: <${userToBan}>`);
                        // remove the ban from the list after timeout
                        this.banQueue = this.banQueue.filter(
                            (ban) => ban.banRequester !== banRequester || ban.userToBan !== userToBan
                        );
                    } catch (err) {
                        logger.error(err);
                    }
                }, 25000),
            };
            this.banQueue.push(newBanRequest);
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
                    if (mods.includes(userToBan)) this.remodAfterBan(channel, userToBan, this.timeoutTime);
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
    private remodAfterBan(channel: string, username: string, time: number) {
        setTimeout(
            (client: tmi.Client, chan, name) => {
                client
                    .mod(chan, name)
                    .then(() => logger.warn(`[MODDED] [${chan}]: <${name}>`))
                    .catch((err) => logger.error(err));
            },
            time * 1000 + 10000, // 10 sec buffer
            this.client,
            channel,
            username
        );
    }
}
