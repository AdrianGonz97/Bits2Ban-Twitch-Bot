/* eslint-disable no-underscore-dangle */
import Datastore from "nedb";
import { stopBot } from "../api/bot/index";
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
            stopBot(login);
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

export function getUser(login: string) {
    let user = null;
    users.findOne({ login }, (err, doc) => {
        if (err) {
            logger.error(err);
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

async function loadBots(savedUsers: User[]) {
    const results = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const user of savedUsers) {
        results.push(refresh(user.refresh_token));
    }

    const refreshedUser = await Promise.all(results);
    refreshedUser.forEach((user) => {
        if (user) {
            updateUser(user);
            logger.info(`Loading ${user.login}'s client.`);
            const client = new ChatBotClient(user.access_token, user.login);
            client.start();
        }
    });
}

users.loadDatabase(async () => {
    const allUsers = getAllUsers();
    await loadBots(allUsers);
});
