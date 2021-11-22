/* eslint-disable camelcase */
import getUserInfo from "../_user";
import oauth from "../_oauth";
import logger from "$logger";
import { User } from "$class/User";
import { AuthToken } from "$class/AuthToken";

export default async function post(user: User) {
    logger.info("Getting new refresh token");
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    const { refresh_token } = user;

    const headers = { Accept: "application/json" };
    const params = new Map();
    params.set("client_id", clientId);
    params.set("client_secret", clientSecret);
    params.set("grant_type", "refresh_token");
    params.set("refresh_token", encodeURIComponent(refresh_token));

    try {
        const resp = await oauth("token", headers, null, params);
        if (resp.status < 200 || resp.status > 299) throw new Error("Failed to refresh with Twitch");

        const userToken = resp.data as AuthToken;

        const userData = await getUserInfo(userToken.access_token);
        if (userData) {
            const newUser: User = {
                ...user, // for transferring chatbot settings
                ...userToken,
                ...userData,
            };

            return newUser;
        }
        throw new Error("Refresh authorization failed");
    } catch (err) {
        logger.error(err);
        return null;
    }
}
