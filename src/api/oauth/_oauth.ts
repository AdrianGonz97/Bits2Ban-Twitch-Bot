import axios from "axios";
const base = "https://id.twitch.tv/oauth2/";

export async function oauth(endpoint: string, headers: any, body: string | null = null, params: Map<string, string> | null = null) {
    let url = base + endpoint;
    if (params) url += toQueryParams(params);

    return axios({
        method: 'post',
        url,
        headers,
        data: body,
    });
}

// converts a Map of variables into a single string for url queries
// key is the param name and val is the param value
function toQueryParams(paramsMap: Map<string, string>) {
    let urlString = "?";

    paramsMap.forEach((val, key) => {
        if (urlString === "?") urlString += `${key}=${val}`;
        else urlString += `&${key}=${val}`;
    });

    return urlString;
}
