// converts a Map of variables into a single string for url queries
// key is the param name and val is the param value
export default function toQueryParams(paramsMap: Map<string, string>) {
    let urlString = "?";

    paramsMap.forEach((val, key) => {
        if (urlString === "?") urlString += `${key}=${val}`;
        else urlString += `&${key}=${val}`;
    });

    return urlString;
}
