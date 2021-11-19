import tmi from "tmi.js";
import type { Client } from "tmi.js";
import logger from "../../logger/index";
import refresh from "../oauth/refresh/index";
import { updateUser } from "../../db/index";
import type { Request, Response } from "express";

const clients = new Map<string, ChatBotClient>();
interface ChatBotInterface {
    timeoutTime: number;
    bitTarget: string;
    message: string;
    whitelist: string[];
    
    start(): void;
    stop(): void;    
}

class ChatBotClient implements ChatBotInterface {
    private owner: string;
    private client: Client;
    timeoutTime = 609; // seconds
    bitTarget = "2000"; // bits
    message = "was banned by";
    whitelist;

    constructor(access_token: string, login: string) {
        this.whitelist = ["moobot", "nightbot", "cokakoala", login];
        this.owner = login;
        this.client = new tmi.Client({
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
        this.setEvents();
    }

    start() {
        this.client.connect().catch((err: any) => logger.error(err));
    }

    stop() {
        this.client.disconnect().catch((err: any) => logger.error(err));
    }

    private setEvents() {
        this.client.on("cheer", this.cheerEvent);
        this.client.on("message", this.messageEvent);

        this.client.on("connected", () => {
            logger.info(`Connected to ${this.owner}'s channel`);
            clients.set(this.owner, this);
            logger.warn(`Number of clients connected: ${clients.size}`);
        });

        this.client.on("disconnected", (reason: string) => {
            logger.warn(
                `Disconnected from ${this.owner}'s channel: ${reason}`
            );
            clients.delete(this.owner);
            logger.warn(`Number of clients connected: ${clients.size}`);
        });
    }

    private cheerEvent(channel: string, userstate: tmi.ChatUserstate, message: string) {
        const banRequester = userstate.username ?? "";
        logger.info(`[CHEER] [${channel}] <${banRequester}>: ${message}`);
        // anyone on the whitelist can cheer at any amount to timeout someone
        if (
            userstate.bits === this.bitTarget ||
            this.whitelist.includes(banRequester)
        ) {
            // removes all "cheer####" from string
            const regex = /([^ "]*\CHEER[^ "]*)/g;
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
                const userToBan = found.slice(1); // removes the @
                // if the banner requests to ban the broadcaster or someone in the whitelist
                if (
                    userToBan === this.owner ||
                    this.whitelist.includes(userToBan)
                ) {
                    // ban the requester
                    this.pogOff(channel, banRequester);
                } else {
                    // otherwise, proceed as normal
                    this.timeoutUser(channel, userToBan, banRequester);
                }
            } else {
                logger.warn(
                    `[${channel}] No username was tagged in ${userstate.username}'s message`
                );
            }
        }
    }

    private messageEvent(channel: string, tags: tmi.ChatUserstate, message: string) {
        const username = tags.username?.toLowerCase();
        if (username === this.owner || username === "cokakoala") {
            if (message[0] === "!") {
                const args: any = message.split(" ");
                const cmd = args.shift()?.replace("!", "");
                if (cmd === "b2b") {
                    const arg = args.shift();
                    switch (arg) {
                        case "msg":
                        case "message":
                            this.message = args.join(" ");
                            break;
                        case "amount":
                            if (
                                !isNaN(args[0]) &&
                                parseInt(args[0]) < 1000000 &&
                                parseInt(args[0]) >= 0
                            ) {
                                this.bitTarget = args[0];
                                this.client
                                    .say(
                                        channel,
                                        `Bit target amount has been set to ${args[0]} bits`
                                    )
                                    .catch((err: any) => logger.error(err));
                            } else {
                                this.client
                                    .say(
                                        channel,
                                        "Invalid number of bits. Must be within the range of [0 - 1000000]. A 0 indicates an OFF state."
                                    )
                                    .catch((err: any) => logger.error(err));
                            }
                            break;
                        case "time":
                            if (
                                !isNaN(args[0]) &&
                                parseInt(args[0]) < 1209600 &&
                                parseInt(args[0]) >= 1
                            ) {
                                this.timeoutTime = parseInt(args[0]);
                                this.client
                                    .say(
                                        channel,
                                        `Timeout time has been set to ${args[0]} seconds`
                                    )
                                    .catch((err: any) => logger.error(err));
                            } else {
                                this.client
                                    .say(
                                        channel,
                                        "Invalid number of seconds. Must be within the range of [1 - 1209600]"
                                    )
                                    .catch((err: any) => logger.error(err));
                            }
                            break;
                        default:
                            this.client
                                .say(
                                    channel,
                                    "Usage: !b2b [msg | amount | time] [args]"
                                )
                                .catch((err: any) => logger.error(err));
                            break;
                    }
                }
            }
        }
    }

    private async timeoutUser(channel: string, userToBan: string, banRequester: string) {
        try {
            // get list of mods for channel
            const mods = await this.client.mods(channel);
            await this.client.say(
                channel,
                `@${userToBan} do you have any final words?`
            );
            setTimeout(async () => {
                try {
                    await this.client.timeout(
                        channel,
                        userToBan,
                        this.timeoutTime,
                        `Timed out for bits - requested by ${banRequester}`
                    );
                    await this.client.say(
                        channel,
                        `@${userToBan} ${this.message} @${banRequester}`
                    );
                    if (mods.includes(userToBan))
                        this.remodAfterBan(channel, userToBan);
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
            await this.client.say(
                channel,
                `@${userToBan} ...really? WeirdChamp`
            );
            setTimeout(async () => {
                try {
                    await this.client.timeout(
                        channel,
                        userToBan,
                        this.timeoutTime,
                        `Timed out for bits - uno reverse card`
                    );
                    await this.client.say(channel, `PogOFF @${userToBan}`);
                    if (mods.includes(userToBan))
                        this.remodAfterBan(channel, userToBan);
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
            (client: tmi.Client, channel: string, username: string) => {
                client
                    .mod(channel, username)
                    .then(() =>
                        logger.warn(`[MODDED] [${channel}]: <${username}>`)
                    )
                    .catch((err: any) => logger.error(err));
            },
            this.timeoutTime * 1000 + 10000, // 10 sec buffer
            this.client,
            channel,
            username
        );
    }
}

export async function start(access_token: string, login: string) {
    logger.info(`Starting chatbot for [${login}]`);
    const client = new ChatBotClient(access_token, login);
    client.start();
}

export async function loadBots(users: any) {
    for (const user of users) {
        // refresh every user token
        const refreshedUser = await refresh(user.refresh_token);
        
        if (refreshedUser) {
            updateUser(refreshedUser);
            logger.info(`Loading ${user.login}'s client.`);
            const client = new ChatBotClient(refreshedUser.access_token, refreshedUser.login);
            client.start();
        }
    }
}

export async function stopBot(login: string) {
    const client = clients.get(login);
    if (!client) return;
    logger.warn(`Stopping chatbot for [${login}]`);
    client.stop();
}

export function getActiveClients(req: Request, res: Response) {
    const activeClients = [...clients.keys()];
    res.status(200).json({ activeClients: activeClients });
}
