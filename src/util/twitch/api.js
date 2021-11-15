const base = 'https://api.twitch.tv/helix/';
const clientId = import.meta.env.VITE_CLIENT_ID;

export async function get(endpoint, token, params = null) {
	let url = base + endpoint;
	if (params) url += toQueryParams(params);

	return fetch(url, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
			'Client-Id': clientId,
		},
	});
}

export async function post(endpoint, body, token, params = null) {
	let url = base + endpoint;
	if (params) url += toQueryParams(params);

	return fetch(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Client-Id': clientId,
			'Content-Type': 'application/json',
		},
		body,
	});
}

export async function patch(endpoint, body, token, params = null) {
	let url = base + endpoint;
	if (params) url += toQueryParams(params);

	return fetch(url, {
		method: 'PATCH',
		headers: {
			Authorization: `Bearer ${token}`,
			'Client-Id': clientId,
			'Content-Type': 'application/json',
		},
		body,
	});
}

export async function del(endpoint, token, params = null) {
	let url = base + endpoint;
	if (params) url += toQueryParams(params);

	return fetch(url, {
		method: 'DELETE',
		headers: {
			Authorization: `Bearer ${token}`,
			'Client-Id': clientId,
		},
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
