import axios from "axios";
import toQueryParams from "$src/util/QueryParams";

const base = "https://id.twitch.tv/oauth2/";

export default async function oauth(
    endpoint: string,
    headers: any,
    body: string | null = null,
    params: Map<string, string> | null = null
) {
    let url = base + endpoint;
    if (params) url += toQueryParams(params);

    return axios({
        method: "post",
        url,
        headers,
        data: body,
    });
}
