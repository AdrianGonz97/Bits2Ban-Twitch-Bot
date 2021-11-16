import logger from "../../../logger/index.js";
import getUserInfo from "../_user.js";
import { oauth } from "../_oauth.js";

export default async function post(rtoken) {
    logger.info("Getting new refresh token");
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;

    const headers = { Accept: "application/json" };
    const params = new Map();
    params.set("client_id", clientId);
    params.set("client_secret", clientSecret);
    params.set("grant_type", "refresh_token");
    params.set("refresh_token", encodeURIComponent(rtoken));

    try {
        const resp = await oauth("token", headers, null, params);
        if (!resp.ok) throw new Error("Failed to refresh with Twitch");

        const userToken = await resp.json();

        const userData = await getUserInfo(userToken.access_token);
        if (userData) {
            const token = {
                ...userToken,
                ...userData,
            };

            return token;
        } else throw new Error("Refresh authorization failed");
    } catch (err) {
        logger.error(err.message);
        return null;
    }
}
