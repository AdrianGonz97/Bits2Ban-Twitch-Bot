import axios from "axios";
import toQueryParams from "../QueryParams";

const base = "https://api.twitch.tv/helix/";
const clientId = process.env.CLIENT_ID;

export async function get(endpoint: string, token: string, params: Map<string, string> | null) {
    let url = base + endpoint;
    if (params) url += toQueryParams(params);

    return axios({
        method: "get",
        url,
        headers: {
            Authorization: `Bearer ${token}`,
            "Client-Id": `${clientId}`,
        },
    });
}

export async function post(endpoint: string, body: string, token: string, params: Map<string, string> | null) {
    let url = base + endpoint;
    if (params) url += toQueryParams(params);

    return axios({
        method: "post",
        url,
        headers: {
            Authorization: `Bearer ${token}`,
            "Client-Id": `${clientId}`,
            "Content-Type": "application/json",
        },
        data: body,
    });
}

export async function patch(endpoint: string, body: string, token: string, params: Map<string, string> | null) {
    let url = base + endpoint;
    if (params) url += toQueryParams(params);

    return axios({
        method: "patch",
        url,
        headers: {
            Authorization: `Bearer ${token}`,
            "Client-Id": `${clientId}`,
            "Content-Type": "application/json",
        },
        data: body,
    });
}

export async function del(endpoint: string, token: string, params: Map<string, string> | null) {
    let url = base + endpoint;
    if (params) url += toQueryParams(params);

    return axios({
        method: "delete",
        url,
        headers: {
            Authorization: `Bearer ${token}`,
            "Client-Id": `${clientId}`,
        },
    });
}
