import pino from "pino";
import env from "../config/env.js";

const transport = env.isProd
  ? undefined
  : {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
    };

export const logger = pino({
  level: env.isProd ? "info" : "debug",
  transport,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.body.motdepasse",
      "req.body.password",
      "req.body.newPassword",
      "*.ecoleDirecteToken",
    ],
    censor: "[masque]",
  },
});

export default logger;
