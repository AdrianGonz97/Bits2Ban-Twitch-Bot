/* eslint-disable camelcase */
import oauth from "../_oauth";
import { stopBot } from "../../bot/index";
import { removeUser } from "$src/db/index";
import logger from "$logger";
import { User } from "$class/User";

export default async function post(user: User) {
    logger.info("Revoking access token");
    const clientId = process.env.CLIENT_ID;
    const { access_token, login } = user;

    const headers = { "Content-Type": "application/x-www-form-urlencoded" };
    const body = `client_id=${clientId}&token=${access_token}`;

    try {
        const resp = await oauth("revoke", headers, body, null);

        if (resp.status >= 200 && resp.status < 300) {
            logger.info("Token revoked successfully");
        } else {
            logger.warn("Bad request, token may have already been revoked or expired");
        }

        removeUser(login);
        await stopBot(login);
    } catch (err) {
        logger.error(err);
    }
}
