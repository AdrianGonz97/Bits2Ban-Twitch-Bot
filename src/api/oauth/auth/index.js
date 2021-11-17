import logger from "../../../logger/index.js";
import getUserInfo from "../_user.js";
import revoke from "../revoke/index.js";
import { oauth } from "../_oauth.js";
import { addUser, removeUser } from "../../../db/index.js";
import { start } from "../../bot/index.js";

export default async function post(req, res) {
    logger.info("Getting access token");
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    const basePath = process.env.URI;

    const { code, isRevoking } = req.body;

    const urlParams = new Map();
    const headers = { Accept: "application/json" };
    urlParams.set("client_id", clientId);
    urlParams.set("client_secret", clientSecret);
    urlParams.set("code", code);
    urlParams.set("grant_type", "authorization_code");
    urlParams.set("redirect_uri", `${basePath}/login`);

    try {
        const resp = await oauth("token", headers, null, urlParams);
        if (!resp.ok)
            throw new Error(
                `Failed to authorize with Twitch Status: ${resp.status}`
            );

        const userToken = await resp.json();

        const userData = await getUserInfo(userToken.access_token);
        if (userData) {
            const token = {
                ...userToken,
                ...userData,
            };

            if (isRevoking) {
                await revoke(token);
            } else {
                // runs only during normal auth to avoid writing/removing ops
                removeUser(token.login);
                addUser(token);
                // starts bot here to avoid login injection
                start(token.access_token, token.login);
            }

            res.status(201).json(token);
        } else throw new Error("Authorization failed");
    } catch (err) {
        logger.error(err.message);
        res.status(500).json({ message: err.message });
    }
}
