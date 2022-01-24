/* eslint-disable no-underscore-dangle */
/* eslint-disable camelcase */
/* eslint-disable no-restricted-globals */
/* eslint-disable radix */
import tmi, { Client } from "tmi.js";
import { EventEmitter } from "events";
import Datastore from "nedb";
import logger from "$logger";
import { User } from "$class/User";
import { BanToken } from "$class/BanToken";
import nukeChat from "$src/api/ban/index";
import getChatters from "$src/api/chatters/index";
import refresh from "$src/api/oauth/refresh/index";

// TODO: Add version number
// TODO: Scoreboard
// TODO: EMOTE ONLY JAIL
// TODO: Whitelist users cmd !!

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
    tokens: boolean;
};

const timer = 45 * 1000; // 45 sec timer to prevent cmd spam - make env var
export default class ChatBotClient extends EventEmitter {
    static clients = new Map<string, ChatBotClient>();

    private user: User;

    private banQueue: Array<BanRequest> = [];

    private bannedMods: Array<Moderator> = [];

    private antiSpam: AntiSpamTimeouts;

    private owner: string;

    private ownerId: string;

    private db: Datastore;

    private banTokenExpireTime: number; // seconds

    private client: Client;

    private numOfGiftedSubs: number;

    private accessToken: string;

    private isChatNuked = false;

    private nukeEndTime = 0;

    timeoutTime; // seconds

    bitTarget; // bits

    message; // BannedUser *message* BanRequester

    whitelist;

    constructor(user: User) {
        super();
        this.whitelist = ["moobot", "nightbot", "cokakoala", user.login];
        this.user = user;
        this.owner = user.login;
        this.ownerId = user.userId;
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
        this.accessToken = user.access_token;
        this.antiSpam = { code: false, how: false, war: false, tokens: false };
        this.timeoutTime = user.timeoutTime;
        this.bitTarget = user.bitTarget;
        this.message = user.message;
        this.banTokenExpireTime = user.tokenExpireTime;
        this.numOfGiftedSubs = user.numOfGiftedSubs;

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
            if (!userstate.bits) return;
            const banRequester = userstate.username?.toLowerCase() ?? "";
            logger.info(`[CHEER] [${channel}] <${banRequester}>: ${message}`);
            const bitsCheered = parseInt(userstate.bits);
            const bitsRequired = parseInt(this.bitTarget);
            // anyone on the whitelist can cheer at any amount to timeout someone
            if (bitsCheered >= bitsRequired || this.whitelist.includes(banRequester)) {
                const banRequest = this.banQueue.find((request) => request.userToBan === banRequester);
                const numOfTokens = Math.floor(bitsCheered / bitsRequired);

                // if this is a uno reverse card
                if (banRequest) {
                    // add additional tokens to user if they provided more bits than needed
                    this.addBanToken(banRequester, numOfTokens - 1);
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
                    // add additional tokens to user if they provided more bits than needed
                    this.addBanToken(banRequester, numOfTokens - 1);
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
                    if (numOfTokens === 0) return;
                    this.addBanToken(banRequester, numOfTokens);
                    this.client
                        .say(channel, `@${banRequester} You have received ${numOfTokens} ban tokens!`)
                        .catch((err) => logger.error(err));

                    logger.warn(`[${channel}] No username was tagged in ${userstate.username}'s message`);
                }
            }
        });

        this.client.on("message", (channel, tags, message) => {
            const username = tags.username?.toLowerCase();
            if (!username) return;
            if (this.isChatNuked && !tags.mod && username !== this.owner) {
                // check if user is a mod, if not ban them for the remaining time
                const banTime = Math.floor((this.nukeEndTime - Date.now()) / 1000);
                this.client.timeout(channel, username, banTime, "nuked").catch((err) => logger.error(err));
                return;
            }
            if (message[0] === "!") {
                const args: string[] = message.split(" ");
                const cmd = args.shift()?.replace("!", "");
                switch (cmd?.toLowerCase()) {
                    case "b2b":
                        if (username === this.owner || username === "cokakoala") {
                            this.ownerCommandHandler(this.client, channel, username, args);
                            return;
                        }
                        this.viewerCommandHandler(this.client, channel, username, args);
                        break;
                    case "uno": {
                        // users can uno reverse card a ban if they have a ban token
                        const banRequest = this.banQueue.find((request) => request.userToBan === username);
                        this.unoCommand(banRequest, username, channel, this.client);
                        break;
                    }
                    case "ban": {
                        const userToBan = ChatBotClient.getTaggedUser(args.join(" ")).slice(1); // slice removes the @
                        if (userToBan) this.banCommand(username, userToBan, channel, this.client);
                        else
                            this.client
                                .say(channel, `@${username} you must tag the user you want to ban!`)
                                .catch((err) => logger.error(err));
                        break;
                    }
                    case "balance":
                    case "tokens": {
                        this.tokensCommand(username, channel, this.client);
                        break;
                    }
                    default:
                        break;
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
                this.addBanToken(gifterLogin, numOfTokens);
                // slight delay added to notify msg so the msg doesn't get hidden by the automated msgs that say who recieved the subs in the chat
                setTimeout(
                    (client, chan, user, num) =>
                        client
                            .say(chan, `@${user} You have received ${num} ban tokens!`)
                            .catch((err) => logger.error(err)),
                    5000,
                    this.client,
                    channel,
                    gifterLogin,
                    numOfTokens
                );
            }
        });

        this.client.on("connected", () => {
            logger.info(`Connected to ${this.owner}'s channel`);
            ChatBotClient.clients.set(this.owner, this);
            logger.warn(`Number of clients connected: ${ChatBotClient.clients.size}`);
            this.client.say(`#${this.owner}`, `B2B Chatbot connected.`).catch((err) => logger.error(err));
        });

        this.client.on("disconnected", (reason: string) => {
            logger.warn(`Disconnected from ${this.owner}'s channel: ${reason}`);
            ChatBotClient.clients.delete(this.owner);
            logger.warn(`Number of clients connected: ${ChatBotClient.clients.size}`);
        });

        this.client.on("reconnect", () => {
            this.reloadBot().catch((err) => logger.error(err));
        });
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
            else
                await this.client.say(
                    channel,
                    `@${userToBan} do you have any final words? If you have a ban token, you can type "!uno" to send the ban right back to @${banRequester}, or you can cheer ${this.bitTarget} bits.`
                );

            const timeout = setTimeout(
                async () => {
                    try {
                        await this.client.timeout(
                            channel,
                            userToBan,
                            time,
                            `Timed out for bits - requested by ${banRequester}`
                        );
                        logger.warn(`[TIMEOUT] [${channel}]: <${userToBan}>`);

                        // if a mod was banned..
                        if (isBannedAlreadyMod) {
                            this.bannedMods = this.bannedMods.filter((mod) => mod.username !== userToBan);
                            this.remodAfterBan(channel, userToBan, time);
                        } else if (mods.includes(userToBan)) this.remodAfterBan(channel, userToBan, time);

                        await this.client.say(
                            channel,
                            `@${userToBan} ${this.message} @${banRequester} for ${time} seconds`
                        );
                    } catch (err) {
                        logger.error(err);
                        // failed to ban? reload access token
                        this.reloadBot();
                    }
                    // remove the ban from the queue after timeout
                    this.banQueue = this.banQueue.filter(
                        (ban) => ban.banRequester !== banRequester || ban.userToBan !== userToBan
                    );
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
                (client: Client, chan, name) => {
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

    private addBanToken(username: string, numOfTokens: number) {
        for (let i = 0; i < numOfTokens; i += 1) {
            // add token to channel owner db
            const banToken: BanToken = {
                login: username,
                creationDate: Date.now(),
            };
            this.db.insert(banToken, (err, doc: BanToken) => {
                if (err) {
                    logger.error(err);
                } else {
                    logger.info(`Added Ban Token for <${doc.login}> with ID: ${doc._id}`);
                }
            });
        }
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
            case "test": {
                if (!username) return;
                this.addBanToken(username, 1);
                client
                    .say(channel, `@${username} You have been given a ban test token`)
                    .catch((err) => logger.error(err));
                break;
            }
            case "give": {
                if (!username) return;
                const userToGiveToken = ChatBotClient.getTaggedUser(args.join(" ")).slice(1); // slice removes the @
                args.shift(); // shifts to get the num of tokens next
                if (userToGiveToken) {
                    let numOfTokens = args.shift();
                    if (numOfTokens === undefined) numOfTokens = 1;
                    if (!isNaN(numOfTokens) && parseInt(numOfTokens) <= 100 && parseInt(numOfTokens) >= 1) {
                        this.addBanToken(userToGiveToken, parseInt(numOfTokens));
                        this.client
                            .say(channel, `${numOfTokens} ban tokens have been given to @${userToGiveToken}`)
                            .catch((err) => logger.error(err));
                    } else {
                        this.client
                            .say(channel, `Invalid number of tokens to give. Must be within the range of [1 - 100]`)
                            .catch((err) => logger.error(err));
                    }
                } else
                    this.client
                        .say(channel, `@${username} you must tag the user you want to give a token to!`)
                        .catch((err) => logger.error(err));
                break;
            }
            case "rob": {
                const userToRemoveTokens = ChatBotClient.getTaggedUser(args.join(" ")).slice(1); // slice removes the @
                if (!userToRemoveTokens)
                    client
                        .say(channel, `You need to tag a user with an @. For example: !b2b rob @username`)
                        .catch((er) => logger.error(er));

                this.db.remove({ login: userToRemoveTokens }, { multi: true }, (err: Error | null, n: number) => {
                    if (err) logger.error(err);
                    else {
                        logger.info(`[ROBBED] [${channel}] ${userToRemoveTokens} has had all of their tokens REMOVED!`);
                        client
                            .say(channel, `@${userToRemoveTokens} has lost all ${n} of their ban tokens`)
                            .catch((er) => logger.error(er));
                    }
                });
                break;
            }
            case "nuke": {
                if (!username) return;
                if (this.isChatNuked) {
                    // only drop another nuke if there's no ongoing nuke
                    this.client
                        .say(channel, `Was 1 nuke not enough...? Not dropping another until the last one is over!`)
                        .catch((err) => logger.error(err));
                    break;
                }

                const nukeTime = args.shift();
                if (!isNaN(nukeTime) && parseInt(nukeTime) <= 900000 && parseInt(nukeTime) >= 1) {
                    const chan = args.shift();
                    const time = parseInt(nukeTime);
                    if (chan) this.nukeChat(this.client, channel, username, time, chan);
                    else this.nukeChat(this.client, channel, username, time, this.owner);
                } else {
                    this.client
                        .say(
                            channel,
                            `Invalid timeout time. Time must be within the range of [1 - 900000] seconds. For example: !b2b nuke 100`
                        )
                        .catch((err) => logger.error(err));
                }
                break;
            }
            case "snap": {
                if (!username) return;
                const nukeTime = args.shift();
                if (!isNaN(nukeTime) && parseInt(nukeTime) <= 900000 && parseInt(nukeTime) >= 1) {
                    const chan = args.shift();
                    const time = parseInt(nukeTime);
                    if (chan) this.nukeChat(this.client, channel, username, time, chan, true);
                    else this.nukeChat(this.client, channel, username, time, this.owner, true);
                } else {
                    this.client
                        .say(
                            channel,
                            `Invalid timeout time. Time must be within the range of [1 - 900000] seconds. For example: !b2b snap 100`
                        )
                        .catch((err) => logger.error(err));
                }
                break;
            }
            case "reload": {
                this.client.say(channel, `Reloading B2B Chatbot...`).catch((err) => logger.error(err));
                this.reloadBot();
                break;
            }
            case "settings": {
                client
                    .say(
                        channel,
                        `Timeout Time: ${this.timeoutTime}s | Bit Target: ${this.bitTarget} | Gifted Subs: ${this.numOfGiftedSubs} | Ban Msg: "${this.message}" | Token Expiration: ${this.banTokenExpireTime}s`
                    )
                    .catch((er) => logger.error(er));
                break;
            }
            default:
                client
                    .say(
                        channel,
                        "Usage: !b2b [msg | cost | time | expire | gifts | rob | give | nuke | reload | settings] [args]"
                    )
                    .catch((err) => logger.error(err));
                break;
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private viewerCommandHandler(client: Client, channel: string, username: string | undefined, args: any) {
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
            default:
                client.say(channel, "Usage: !b2b [how | war | code]").catch((err) => logger.error(err));
                break;
        }
    }

    private banCommand(username: string, userToBan: string, channel: string, client: Client) {
        // check if they have a token
        this.db.find({ login: username }, (err: Error, tokens: BanToken[]) => {
            if (err) {
                logger.error(err);
                return;
            }
            // if user has a token, ban the userToBan
            if (tokens.length > 0) {
                // finds the token that's closest to expiration
                let id = tokens[0]._id;
                let closestExpiration = tokens[0].creationDate + this.banTokenExpireTime * 1000;
                tokens.forEach((token) => {
                    const expireDate = token.creationDate + this.banTokenExpireTime * 1000;
                    if (expireDate < closestExpiration) {
                        id = token._id;
                        closestExpiration = expireDate;
                    }
                });
                if (userToBan === this.owner || this.whitelist.includes(userToBan)) {
                    // ban the requester
                    this.pogOff(channel, username);
                } else {
                    // otherwise, proceed as normal
                    this.timeoutUser(channel, userToBan, username);
                }
                this.db.remove({ _id: id }, (error: Error | null) => {
                    if (error) logger.error(err);
                    else logger.info(`[REDEEM] [${channel}] ${username} has banned a user with a token`);
                });
            } else
                client
                    .say(channel, `@${username} you don't have any ban tokens!`)
                    .catch((error) => logger.error(error));
        });
    }

    private unoCommand(banRequest: BanRequest | undefined, username: string, channel: string, client: Client) {
        if (!banRequest) {
            client.say(channel, `@${username} you must first be at war!`).catch((err) => logger.error(err));
            return;
        }
        this.db.find({ login: username }, (err: Error, tokens: BanToken[]) => {
            if (err) {
                logger.error(err);
                return;
            }
            // if user has a token, uno reverse card
            if (tokens.length > 0) {
                // finds the token that's closest to expiration
                let id = tokens[0]._id;
                let closestExpiration = tokens[0].creationDate + this.banTokenExpireTime * 1000;
                tokens.forEach((token) => {
                    const expireDate = token.creationDate + this.banTokenExpireTime * 1000;
                    if (expireDate < closestExpiration) {
                        id = token._id;
                        closestExpiration = expireDate;
                    }
                });
                clearTimeout(banRequest.timeout);
                this.banQueue = this.banQueue.filter(
                    (ban) => ban.userToBan !== username || ban.banRequester !== banRequest.banRequester
                ); // removes this ban from list
                this.timeoutUser(channel, banRequest.banRequester, banRequest.userToBan, true, banRequest.count);
                this.db.remove({ _id: id }, (error: Error | null) => {
                    if (error) logger.error(err);
                    else logger.info(`[REDEEM] [${channel}] ${username} has reversed a ban with a token`);
                });
            } else
                client
                    .say(channel, `@${username} you don't have any ban tokens!`)
                    .catch((error) => logger.error(error));
        });
    }

    private tokensCommand(username: string, channel: string, client: Client) {
        this.db.find({ login: username }, (err: Error, tokens: BanToken[]) => {
            if (err) {
                logger.error(err);
            } else {
                let msg = `You have ${tokens.length} ban tokens. `;
                // whipsers to user if already said in chat
                if (!this.antiSpam.tokens) {
                    this.antiSpam.tokens = true;
                    client.say(channel, `@${username} ${msg}`).catch((er) => logger.error(er));
                    setTimeout(() => {
                        this.antiSpam.tokens = false;
                    }, 10 * 1000);
                }

                if (tokens.length > 0) msg += `Your tokens will expire in the following times:\n`;

                tokens.forEach((token) => {
                    // formats time as such: 00h:00m:00s
                    const expirationDate = token.creationDate + this.banTokenExpireTime * 1000;
                    let timeRemaining = (expirationDate - Date.now()) / 1000;
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
    }

    private async nukeChat(
        client: Client,
        channel: string,
        bomber: string,
        nukeTime: number,
        broadcaster?: string,
        snap = false
    ) {
        if (this.timeoutTime === 0) return;
        try {
            // refreshes access token
            const user = await refresh(this.user);
            if (!user) return;
            this.accessToken = user.access_token;

            const chanChatters = await getChatters(broadcaster ?? this.owner);

            // filters out mods from the list of chatters
            const modList = await this.client.mods(channel);
            const chatters = chanChatters.filter((name) => !modList.includes(name));

            // nuke time is calculated by adding 200ms for every 1 user in chat
            let calcNukeTime = snap
                ? Math.floor(((chatters.length / 2) * 2) / 10)
                : Math.floor((chatters.length * 2) / 10);
            calcNukeTime += nukeTime; // + set timeout time

            const nukeMsg = snap
                ? `I am inevitable... Wiping out ${Math.floor(chatters.length / 2)} viewers out of exisitence in...`
                : `Tactical nuke inbound. Banning ${chatters.length} viewers for ${calcNukeTime} seconds. Dropping in...`;
            client.say(channel, nukeMsg).catch((err) => logger.error(err));
            await ChatBotClient.nukeCountDown(client, channel);

            this.nukeEndTime = Date.now() + calcNukeTime * 1000;
            this.isChatNuked = !snap;
            setTimeout(() => {
                this.isChatNuked = false;
            }, calcNukeTime * 1000);

            const reason = snap ? `Thanos snap` : `Tactically nuked by ${bomber}`;
            const count = await nukeChat(this.accessToken, this.ownerId, calcNukeTime, reason, chatters, snap);
            const finalMsg = snap
                ? `${count} out of ${chatters.length} chatters disappeared.`
                : `${count} out of ${chatters.length} chatters were nuked.`;

            client.say(channel, finalMsg).catch((err) => logger.error(err));
        } catch (err) {
            logger.error(err);
        }
    }

    static nukeCountDown(client: Client, channel: string) {
        let count = 10;
        return new Promise((resolve) => {
            const interval = setInterval(() => {
                if (count === 1) {
                    clearInterval(interval);
                    resolve(0);
                }
                client.say(channel, `${count}...`).catch((err) => logger.error(err));
                count -= 1;
            }, 1000);
        });
    }

    private async reloadBot() {
        logger.warn(`Reloading chatbot for ${this.owner}'s channel`);
        try {
            await this.client.disconnect();

            // get new access token
            const user = await refresh(this.user);
            if (!user) return;

            this.accessToken = user.access_token;
            this.banQueue = [];

            this.client = new tmi.Client({
                options: { debug: true },
                connection: {
                    reconnect: true,
                    secure: true,
                },
                identity: {
                    username: this.owner,
                    password: this.accessToken,
                },
                channels: [this.owner],
                logger,
            });

            this.setEvents();

            this.start();
        } catch (err) {
            logger.error(err);
        }
    }
}
