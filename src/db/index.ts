import Datastore from "nedb";
import { loadBots, stopBot } from "../api/bot/index";
import logger from "../logger/index";
import { User } from "$class/User";

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
    users.remove({ login: login }, { multi: true }, (err, numRemoved) => {
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

users.loadDatabase(async () => {
    const allUsers = getAllUsers();
    await loadBots(allUsers);
});
