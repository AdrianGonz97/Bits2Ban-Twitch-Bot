const base = 'https://id.twitch.tv/oauth2/';

export async function oauth(endpoint, headers, body = null, params = null) {
	let url = base + endpoint;
	if (params) url += toQueryParams(params);

	return fetch(url, {
		method: 'POST',
		headers,
		body,
	});
}

// converts a Map of variables into a single string for url queries
// key is the param name and val is the param value
function toQueryParams(paramsMap) {
	let urlString = '?';

	paramsMap.forEach((val, key) => {
		if (urlString === '?') urlString += `${key}=${val}`;
		else urlString += `&${key}=${val}`;
	});

	return urlString;
}
