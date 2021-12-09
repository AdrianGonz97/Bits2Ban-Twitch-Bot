import axios from "axios";
import logger from "$logger";
import { ChatterInfo } from "$class/ChatterInfo";

const url = "https://gql.twitch.tv/gql";
const clientId = "kimne78kx3ncx6brgo4mv6wki5h1ko";

export default async function getChatters(broadcaster: string) {
    try {
        const resp = await axios({
            method: "post",
            url,
            headers: {
                "Client-Id": `${clientId}`,
                "Content-Type": "application/json",
            },
            data: {
                query: `
                query ChatViewers() {
                    channel(name: ${broadcaster}) {
                        chatters {
                            count
                            viewers {
                                login
                            }
                            vips {
                                login
                            }
                        }
                    }
                }
                `,
            },
        });

        if (resp.status >= 200 && resp.status < 300) {
            logger.info("Got chatter data");
            const result: { data: ChatterInfo } = resp.data;
            const { viewers, vips } = result.data.channel.chatters;
            const vipNames = vips.map((chatter) => chatter.login);
            const chatterNames = viewers.map((chatter) => chatter.login).concat(vipNames);

            return chatterNames ?? [];
        }
    } catch (error) {
        logger.error(error);
    }
    return [];
}
