import logger from "../../../logger/index.js";
import getUserInfo from "../_user";
import { oauth } from "../_oauth";

export default async function post({ body }) {
    logger.info("Getting new refresh token");
    const clientId = import.meta.env.VITE_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_CLIENT_SECRET;

    const rtoken = JSON.parse(body).rtoken;
    const headers = { Accept: "application/json" };
    const params = new Map();
    params.set("client_id", clientId);
    params.set("client_secret", clientSecret);
    params.set("grant_type", "refresh_token");
    params.set("refresh_token", encodeURIComponent(rtoken));

    try {
        const resp = await oauth("token", headers, null, params);
        if (!resp.ok) throw new Error("Failed to authorize with Twitch");

        const userToken = await resp.json();

        const userData = await getUserInfo(userToken.access_token);
        if (userData) {
            const token = {
                ...userToken,
                ...userData,
            };

            return {
                status: 200,
                body: token,
            };
        } else throw new Error("Authorization failed");
    } catch (err) {
        logger.error(err.message);
        return { status: 404, body: err.message };
    }
}
