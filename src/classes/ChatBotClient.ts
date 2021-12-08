/* eslint-disable camelcase */
/* eslint-disable no-restricted-globals */
/* eslint-disable radix */
import tmi, { Client } from "tmi.js";
import { EventEmitter } from "events";
import Datastore from "nedb";
import logger from "$logger";
import { User } from "$class/User";
import { BanToken } from "$class/BanToken";

type BanRequest = {
    userToBan: string;
    banRequester: string;
    timeout: NodeJS.Timeout;
    count: number;
};

type Moderator = {
    username: string;
    timeout: NodeJS.Timeout;
};

type AntiSpamTimeouts = {
    code: boolean;
    how: boolean;
    war: boolean;
};
export default class ChatBotClient extends EventEmitter {
    static clients = new Map<string, ChatBotClient>();

    private banQueue: Array<BanRequest> = [];

    private bannedMods: Array<Moderator> = [];

    private antiSpam: AntiSpamTimeouts;

    private owner: string;

    private db: Datastore;

    private banTokenExpireTime: number; // seconds

    private client: Client;

    private numOfGiftedSubs: number;

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
        this.antiSpam = { code: false, how: false, war: false };
        this.timeoutTime = user.timeoutTime;
        this.bitTarget = user.bitTarget;
        this.message = user.message;
        this.banTokenExpireTime = user.tokenExpireTime;

        this.numOfGiftedSubs = 5;

        this.db = new Datastore({
            filename: `./data/ban-tokens/${this.owner}.db`,
            timestampData: true,
        });
        this.db.loadDatabase(() => {
            this.updateTokenExpirationTime();
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
                const banRequest = this.banQueue.find((request) => request.userToBan === banRequester);

                if (banRequest) {
                    // if this is a uno reverse card
                    clearTimeout(banRequest.timeout);
                    this.banQueue = this.banQueue.filter(
                        (ban) => ban.userToBan !== banRequester || ban.banRequester !== banRequest.banRequester
                    ); // removes this ban from list
                    this.timeoutUser(channel, banRequest.banRequester, banRequest.userToBan, true, banRequest.count);
                    return;
                }

                // if just a normal ban req
                const found = ChatBotClient.getTaggedUser(message);
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
            if (message[0] === "!") {
                const args: string[] = message.split(" ");
                const cmd = args.shift()?.replace("!", "");
                if (cmd === "b2b") {
                    if (username === this.owner || username === "cokakoala") {
                        this.ownerCommandHandler(this.client, channel, username, args);
                        return;
                    }
                    this.viewerCommandHandler(this.client, channel, username, args);
                }
            }
        });

        this.client.on("submysterygift", (channel, username, numOfSubsGifted, methods, userstate) => {
            if (this.numOfGiftedSubs <= 0) return;
            const gifterLogin = userstate.login;
            logger.warn(`[${channel}] <${gifterLogin}> ${username} gifted ${numOfSubsGifted} subs`);

            // check if the gited amount is 5 (or a custom amount?)
            if (numOfSubsGifted >= this.numOfGiftedSubs && gifterLogin) {
                const numOfTokens = Math.floor(numOfSubsGifted / this.numOfGiftedSubs);
                for (let i = 0; i < numOfTokens; i += 1) {
                    // add token to channel owner db
                    const banToken: BanToken = {
                        login: gifterLogin,
                        createdAt: Date.now(),
                        expirationDate: Date.now() + this.banTokenExpireTime * 1000,
                    };
                    this.db.insert(banToken, (err, doc: BanToken) => {
                        if (err) {
                            logger.error(err);
                        } else {
                            // eslint-disable-next-line no-underscore-dangle
                            logger.info(`Added Ban Token for <${doc.login}> with ID: ${doc._id}`);
                        }
                    });
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
    private ownerCommandHandler(client: Client, channel: string, username: string | undefined, args: any) {
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
                            "Invalid number of bits. Must be within the range of [0 - 1000000]. A 0 indicates an DISABLED state."
                        )
                        .catch((err) => logger.error(err));
                }
                break;
            }
            case "gifts": {
                if (!isNaN(args[0]) && parseInt(args[0]) < 1000000 && parseInt(args[0]) >= 0) {
                    const newBitTarget = args.shift();
                    logger.warn(
                        `Channel [${channel}] has changed gifted subs required from ${this.numOfGiftedSubs} --> ${newBitTarget}`
                    );
                    this.numOfGiftedSubs = newBitTarget;
                    client
                        .say(
                            channel,
                            `Gifted subs required to earn a token has been set to ${this.numOfGiftedSubs} subs`
                        )
                        .catch((err) => logger.error(err));
                    this.emit("gifts", this.owner, this.numOfGiftedSubs);
                } else {
                    client
                        .say(
                            channel,
                            "Invalid number of gifted subs. Must be within the range of [0 - 1000000]. A 0 indicates an DISABLED state."
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
            case "expire": {
                if (!isNaN(args[0]) && parseInt(args[0]) < 1209600 && parseInt(args[0]) >= 1) {
                    const newTime = parseInt(args[0]);
                    logger.warn(
                        `Channel [${channel}] has changed ban token expiration time from ${this.banTokenExpireTime} --> ${newTime}`
                    );
                    this.banTokenExpireTime = newTime;
                    client
                        .say(channel, `Ban token expiration time has been set to ${this.banTokenExpireTime} seconds`)
                        .catch((err) => logger.error(err));

                    this.updateTokenExpirationTime();
                    this.emit("expire", this.owner, this.banTokenExpireTime);
                } else {
                    client
                        .say(channel, "Invalid number of seconds. Must be within the range of [1 - 1209600]")
                        .catch((err) => logger.error(err));
                }
                break;
            }
            case "how": {
                client
                    .say(
                        channel,
                        `To ban someone with bits, just CHEER ${this.bitTarget} bits and @ the user you want to ban anywhere in the same message. When someone is banned, they will be banned for ${this.timeoutTime} seconds, unless they retaliate with bits, starting a war. To learn about war, type !b2b war`
                    )
                    .catch((err) => logger.error(err));
                break;
            }
            case "code": {
                const src = "https://github.com/AdrianGonz97/Bits2Ban-Twitch-Bot";
                client.say(channel, `Link to source code: ${src}`).catch((err) => logger.error(err));
                break;
            }
            case "war": {
                client
                    .say(
                        channel,
                        `If someone donates to ban you, you can start a war by CHEERing ${this.bitTarget} bits in response. This must be done during your "final words" stage. After the CHEER, the ban will be sent back to the user that tried to ban you. They will also have an opportunity to send the ban right back to you again. The user that ends up being banned will be timed out for ${this.timeoutTime} seconds multiplied by the amount of times the ban went back and forth.`
                    )
                    .catch((err) => logger.error(err));
                break;
            }
            case "tokens": {
                if (!username) break;
                this.db.find({ login: username }, (err: Error, tokens: BanToken[]) => {
                    if (err) {
                        logger.error(err);
                    } else {
                        const filteredTokens = tokens.filter((token) => Date.now() < token.expirationDate);

                        let msg = `You have ${filteredTokens.length} ban tokens. `;
                        if (filteredTokens.length > 0) msg += `Your tokens will expire in the following times:\n`;

                        filteredTokens.forEach((token) => {
                            // formats time as such: 00h:00m:00s
                            let timeRemaining = (token.expirationDate - Date.now()) / 1000;
                            const hours = String(Math.floor(timeRemaining / 3600)).padStart(2, "0");
                            timeRemaining %= 3600;
                            const mins = String(Math.floor(timeRemaining / 60)).padStart(2, "0");
                            const secs = String(Math.floor(timeRemaining % 60)).padStart(2, "0");
                            msg += `${hours}h:${mins}m:${secs}s\n`;
                        });
                        client
                            .whisper(username, msg)
                            .then((data) => logger.info(`Whispered ban token balance to ${data[0]}`))
                            .catch((error) => logger.error(error));
                    }
                });
                break;
            }
            default:
                client
                    .say(channel, "Usage: !b2b [msg | cost | time | expire | gifts] [args]")
                    .catch((err) => logger.error(err));
                break;
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private viewerCommandHandler(client: Client, channel: string, username: string | undefined, args: any) {
        const timer = 45 * 1000; // 45 sec timer to prevent cmd spam
        const arg = args.shift();
        switch (arg) {
            case "how": {
                if (!username) break;
                const msg = `To ban someone with bits, just CHEER ${this.bitTarget} bits and @ the user you want to ban anywhere in the same message. When someone is banned, they will be banned for ${this.timeoutTime} seconds, unless they retaliate with bits, starting a war. To learn about war, type !b2b war`;
                // whipsers to user if already said in chat
                if (this.antiSpam.how) {
                    client.whisper(username, msg).catch((err) => logger.error(err));
                    return;
                }
                this.antiSpam.how = true;
                client.say(channel, msg).catch((err) => logger.error(err));
                setTimeout(() => {
                    this.antiSpam.how = false;
                }, timer);
                break;
            }
            case "code": {
                if (!username) break;
                const src = "https://github.com/AdrianGonz97/Bits2Ban-Twitch-Bot";
                const msg = `Link to source code: ${src}`;
                // whipsers to user if already said in chat
                if (this.antiSpam.code) {
                    client.whisper(username, msg).catch((err) => logger.error(err));
                    return;
                }
                this.antiSpam.code = true;
                client.say(channel, msg).catch((err) => logger.error(err));
                setTimeout(() => {
                    this.antiSpam.code = false;
                }, timer);
                break;
            }
            case "war": {
                if (!username) break;
                const msg = `If someone donates to ban you, you can start a war by CHEERing ${this.bitTarget} bits in response. This must be done during your "final words" stage. After the CHEER, the ban will be sent back to the user that tried to ban you. They will also have an opportunity to send the ban right back to you again. The user that ends up being banned will be timed out for ${this.timeoutTime} seconds multiplied by the amount of times the ban went back and forth.`;
                // whipsers to user if already said in chat
                if (this.antiSpam.war) {
                    client.whisper(username, msg).catch((err) => logger.error(err));
                    return;
                }
                this.antiSpam.war = true;
                client.say(channel, msg).catch((err) => logger.error(err));
                setTimeout(() => {
                    this.antiSpam.war = false;
                }, timer);
                break;
            }
            case "tokens": {
                if (!username) break;
                this.db.find({ login: username }, (err: Error, tokens: BanToken[]) => {
                    if (err) {
                        logger.error(err);
                    } else {
                        let msg = `You have ${tokens.length} ban tokens. `;
                        if (tokens.length > 0) msg += `Your tokens will expire in the following times:\n`;

                        tokens.forEach((token) => {
                            // formats time as such: 00h:00m:00s
                            let timeRemaining = (token.expirationDate - Date.now()) / 1000;
                            const hours = String(Math.floor(timeRemaining / 3600)).padStart(2, "0");
                            timeRemaining %= 3600;
                            const mins = String(Math.floor(timeRemaining / 60)).padStart(2, "0");
                            const secs = String(Math.floor(timeRemaining % 60)).padStart(2, "0");
                            msg += `${hours}h:${mins}m:${secs}s\n`;
                        });
                        client
                            .whisper(username, msg)
                            .then((data) => logger.info(`Whispered ban token balance to ${data[0]}`))
                            .catch((error) => logger.error(error));
                    }
                });
                break;
            }
            default:
                client.say(channel, "Usage: !b2b [how | war | code]").catch((err) => logger.error(err));
                break;
        }
    }

    private async timeoutUser(channel: string, userToBan: string, banRequester: string, isUno = false, count = 0) {
        try {
            // get list of mods for channel
            const mods = await this.client.mods(channel);
            const isBannedAlreadyMod = this.bannedMods.some((mod) => mod.username === userToBan);
            const time = Math.min(this.timeoutTime * (count + 1), 1209600); // need to cap timeout at 2 weeks
            // if uno reverse card type
            if (isUno)
                await this.client.say(
                    channel,
                    `${count + 1}x UNO REVERSE CARD for ${time} seconds, any final words, @${userToBan}?`
                );
            else await this.client.say(channel, `@${userToBan} do you have any final words?`);

            const timeout = setTimeout(
                async () => {
                    try {
                        await this.client.timeout(
                            channel,
                            userToBan,
                            time,
                            `Timed out for bits - requested by ${banRequester}`
                        );
                        await this.client.say(channel, `@${userToBan} ${this.message} @${banRequester}`);
                        logger.warn(`[TIMEOUT] [${channel}]: <${userToBan}>`);

                        // if a mod was banned..
                        if (isBannedAlreadyMod) {
                            this.bannedMods = this.bannedMods.filter((mod) => mod.username !== userToBan);
                            this.remodAfterBan(channel, userToBan, time);
                        } else if (mods.includes(userToBan)) this.remodAfterBan(channel, userToBan, time);

                        // remove the ban from the list after timeout
                        this.banQueue = this.banQueue.filter(
                            (ban) => ban.banRequester !== banRequester || ban.userToBan !== userToBan
                        );
                    } catch (err) {
                        logger.error(err);
                    }
                },
                isUno ? 60000 : 25000
            );

            const newBanRequest: BanRequest = {
                userToBan,
                banRequester,
                count: count + 1,
                timeout,
            };
            this.banQueue.push(newBanRequest);
        } catch (err) {
            logger.error(err);
        }
    }

    /* for when a whitelisted user is attempted to be banned */
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
                    logger.warn(`[TIMEOUT] [${channel}]: <${userToBan}>`);

                    if (mods.includes(userToBan)) this.remodAfterBan(channel, userToBan, this.timeoutTime);
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
        const newBannedMod: Moderator = {
            username,
            timeout: setTimeout(
                (client: tmi.Client, chan, name) => {
                    client
                        .mod(chan, name)
                        .then(() => logger.warn(`[MODDED] [${chan}]: <${name}>`))
                        .catch((err) => logger.error(err));
                    // remove remodded mod from banned list
                    this.bannedMods = this.bannedMods.filter((mod) => mod.username !== name);
                },
                time * 1000 + 10000, // 10 sec buffer
                this.client,
                channel,
                username
            ),
        };
        this.bannedMods.push(newBannedMod);
    }

    /* parses the message to extract the tagged user */
    private static getTaggedUser(message: string) {
        const usernameRegex = /@\w*/g;
        const taggedUsers = message.match(usernameRegex);
        const found = taggedUsers?.find((el) => el.length > 4); // shortest username is 4 chars
        return found?.toLowerCase() ?? "";
    }

    private updateTokenExpirationTime() {
        this.db.removeIndex("createdAt", (err) => {
            if (err) logger.error(err);
        });
        this.db.ensureIndex({ fieldName: "createdAt", expireAfterSeconds: this.banTokenExpireTime }, (err) => {
            if (err) logger.error(err);
        });
    }
}
