import Datastore from "nedb";
import logger from "../logger/index.js";

const users = new Datastore({
    filename: `./data/users.db`,
    autoload: true,
});

export function addUser(user) {
    users.insert(user, (err, doc) => {
        logger.info(`Inserted <${doc.login}> with ID: ${doc._id}`);
    });
}

export function removeUser(user) {
    users.remove(user, (err, doc) => {
        logger.info(`Removed <${doc.login}> with ID: ${doc._id}`);
    });
}

function replaceUser(user) {}
