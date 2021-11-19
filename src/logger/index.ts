import pkg from "winston";
const { createLogger, format, transports } = pkg;
const { combine, timestamp, printf, colorize, errors } = format;

const myFormat = printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level}]: ${stack || message}`;
});

export default createLogger({
    format: combine(colorize(), timestamp(), errors({ stack: true }), myFormat),
    transports: [new transports.Console()],
});
