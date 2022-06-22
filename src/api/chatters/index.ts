import axios from "axios";
import logger from "$logger";
import { ChatterInfo } from "$class/ChatterInfo";

export default async function getChatters(broadcaster: string) {
    try {
        const resp = await axios({
            method: "get",
            url: `https://tmi.twitch.tv/group/user/${broadcaster}/chatters`,
        });

        if (resp.status >= 200 && resp.status < 300) {
            logger.info("Got chatter data for nuke");
            const data = resp.data as ChatterInfo;
            const { viewers, vips } = data.chatters;

            return viewers.concat(vips) ?? [];
        }
    } catch (error) {
        logger.error(error);
    }
    return [];
}
