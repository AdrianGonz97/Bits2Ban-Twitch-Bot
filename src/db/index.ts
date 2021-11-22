/* eslint-disable no-underscore-dangle */
import Datastore from "nedb";
import refresh from "$src/api/oauth/refresh/index";
import logger from "$logger";
import { User } from "$class/User";
import ChatBotClient from "$class/ChatBotClient";

const users = new Datastore({
    filename: `./data/users.db`,
    autoload: true,
});

export function addUser(user: User) {
    users.insert(user, (err, doc: User) => {
        if (err) {
            logger.error(err);
        } else {
            logger.info(`Inserted <${doc.login}> with ID: ${doc._id}`);
        }
    });
}

export function removeUser(login: string) {
    users.remove({ login }, { multi: true }, (err, numRemoved) => {
        if (err) {
            logger.error(err);
        } else {
            logger.info(`Deleted <${login}> Docs Removed: ${numRemoved}`);
        }
    });
}

export function updateUser(user: User) {
    users.update(
        { userId: user.userId },
        {
            ...user,
        },
        {},
        (err) => {
            if (err) {
                logger.error(err);
            } else {
                logger.info(`Updated user ${user.login}'s token`);
            }
        }
    );
}

type Field = { message?: string; bitTarget?: string; timeoutTime?: number };
function updateField(login: string, fields: Field) {
    users.update(
        { login },
        {
            $set: { ...fields },
        },
        {},
        (err) => {
            if (err) {
                logger.error(err);
            } else {
                logger.info(`Updated user ${login}'s field`);
            }
        }
    );
}

export function getUser(login: string) {
    let user;
    users.findOne({ login }, (err, doc: User) => {
        if (err) {
            logger.error(err);
            user = null;
        } else {
            logger.info(`User found: ${doc.login}`);
            user = doc;
        }
    });
    return user;
}

export function getAllUsers() {
    const allUsers = users.getAllData();
    return allUsers;
}

export function addListeners(client: ChatBotClient) {
    client.on("message", (owner: string, message: string) => {
        updateField(owner, { message } as Field);
    });
    client.on("cost", (owner: string, bitTarget: string) => {
        updateField(owner, { bitTarget } as Field);
    });
    client.on("time", (owner: string, timeoutTime: number) => {
        updateField(owner, { timeoutTime } as Field);
    });
}

async function loadBots(savedUsers: User[]) {
    const results: Promise<User | null>[] = [];
    savedUsers.forEach((user) => results.push(refresh(user)));

    const refreshedUser = await Promise.all(results);
    refreshedUser.forEach((user) => {
        if (user) {
            updateUser(user);
            logger.info(`Loading ${user.login}'s client.`);
            const client = new ChatBotClient(user);
            client.start();
            addListeners(client);
        }
    });
}

users.loadDatabase(async () => {
    const allUsers = getAllUsers();
    await loadBots(allUsers);
});
