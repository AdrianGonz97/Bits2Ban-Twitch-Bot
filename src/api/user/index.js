import logger from '$logger';
import { getUserInfo } from '$util/jwt';

export async function get(request) {
	logger.info('Getting user info from jwt');
	const jwt = request.locals.jwt;
	const userInfo = getUserInfo(jwt);

	if (userInfo) {
		return {
			status: 200,
			body: userInfo,
		};
	} else {
		logger.warn('Failed to get user info');
		return { status: 404, body: 'Failed to get user info' };
	}
}
