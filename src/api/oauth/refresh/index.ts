import logger from "../../../logger/index";
import getUserInfo from "../_user";
import { oauth } from "../_oauth";

export default async function post(rtoken: string) {
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
        if (resp.status < 200 || resp.status > 299)
            throw new Error("Failed to refresh with Twitch");

        const userToken = resp.data as common.Token;

        const userData = await getUserInfo(userToken.access_token);
        if (userData) {
            const user: common.User = {
                ...userToken,
                ...userData,
            };

            return user;
        } else throw new Error("Refresh authorization failed");
    } catch (err) {
        logger.error(err);
        return null;
    }
}
