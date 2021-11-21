import { get as twitchGet } from "$src/util/twitch/api";
import logger from "$logger";
import { UserInfo } from "$class/UserInfo";

// returns null if userinfo fails to fetch from twitch
export default async function getUserInfo(accessToken: string) {
    logger.info("Fetching user info from twitch");
    try {
        const resp = await twitchGet("users", accessToken, null);
        if (resp.status >= 200 && resp.status < 300) {
            logger.info("Got new user info");
            const result: { data: UserInfo[] } = resp.data;
            const user = result.data[0];

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
