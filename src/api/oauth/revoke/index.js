import logger from "../../../logger/index.js";
import { oauth } from "../_oauth.js";
import { removeUser } from "../../../db/index.js";
import { stopBot } from "../../bot/index.js";

export default async function post(req, res) {
    logger.info("Revoking access token");
    const clientId = process.env.CLIENT_ID;
    const { access_token, login } = req.body;

    const headers = { "Content-Type": "application/x-www-form-urlencoded" };
    const body = `client_id=${clientId}&token=${access_token}`;

    try {
        const resp = await oauth("revoke", headers, body, null);

        const resBody = {};
        let status = 200;

        if (resp.ok) {
            resBody.message = "token revoked successfully";
        } else {
            status = 400;
            resBody.message =
                "Bad request, token may have already been revoked or expired";
        }

        removeUser(login);

        res.status(status).json(resBody);
    } catch (err) {
        logger.error(err.message);
        res.status(404).json({ message: err.message });
    }
}
