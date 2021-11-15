import logger from "../../logger/index.js";
import { get as twitchGet } from "../../util/twitch/api.js";

// returns null if userinfo fails to fetch from twitch
export default async function getUserInfo(accessToken) {
    logger.info("Fetching user info from twitch");
    try {
        const resp = await twitchGet("users", accessToken, null);
        if (resp.ok) {
            logger.info("Got new user info");
            const data = await resp.json();
            const user = data.data[0];

            return {
                displayName: user.display_name,
                userId: user.id,
                login: user.login,
                profileImageUrl: user.profile_image_url,
            };
        }
        logger.warn("Failed to get user info!");
    } catch (err) {
        logger.error(err.message);
    }
    return null;
}
