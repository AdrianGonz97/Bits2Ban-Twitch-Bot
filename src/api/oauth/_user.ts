import logger from "../../logger/index";
import { get as twitchGet } from "../../util/twitch/api";
import { UserInfo } from "$class/UserInfo";

// returns null if userinfo fails to fetch from twitch
export default async function getUserInfo(accessToken: string) {
    logger.info("Fetching user info from twitch");
    try {
        const resp = await twitchGet("users", accessToken, null);
        if (resp.status >= 200 && resp.status < 300) {
            logger.info("Got new user info");
            const data: { data: UserInfo[] } = resp.data;
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
        logger.error(err);
    }
    return null;
}
