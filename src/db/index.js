import Datastore from "nedb";
import { loadBots, stopBot } from "../api/bot/index.js";
import logger from "../logger/index.js";

const users = new Datastore({
    filename: `./data/users.db`,
    autoload: true,
});

users.loadDatabase(async (err) => {
    const allUsers = getAllUsers();
    await loadBots(allUsers);
});

export function addUser(user) {
    users.insert(user, (err, doc) => {
        if (err) {
            logger.error(err);
        } else {
            logger.info(`Inserted <${doc.login}> with ID: ${doc._id}`);
        }
    });
}

export function removeUser(login) {
    users.remove({ login: login }, { multi: true }, (err, numRemoved) => {
        if (err) {
            logger.error(err);
        } else {
            logger.info(`Deleted <${login}> Docs Removed: ${numRemoved}`);
            stopBot(login);
        }
    });
}

export function updateUser(token) {
    users.update(
        { userId: token.userId },
        {
            ...token,
        },
        {},
        (err, numRemoved) => {
            if (err) {
                logger.error(err);
            } else {
                logger.info(`Updated user ${token.login}'s token`);
            }
        }
    );
}

export function getUser(login) {
    let user = null;
    users.findOne({ login: login }, function (err, doc) {
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
