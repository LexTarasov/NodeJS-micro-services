require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Redis = require("ioredis");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const logger = require("./utils/logger");
const proxy = require("express-http-proxy");
const errorHandler = require("./middleware/errorHandler");
//const { validateToken } = require("./middleware/authMiddleware");

const app = express();
const PORT = process.env.PORT || 3000;

const redisClient = new Redis(process.env.REDIS_URL);

//middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());

//rate limiting middleware
const rateLimitOptions = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Sensitive endpoint rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({ success: false, message: "Too many requests" });
  },
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
  }),
});

app.use(rateLimitOptions);

//log requests middleware
app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}`);
  logger.info(`Request body, ${req.body}`);
  next();
});

const proxyOptions = {
  proxyReqPathResolver: (req) => {
    // REESCRITURA DE URL:
    // El cliente solicita: /v1/auth/login (Gateway)
    // El servicio espera:  /api/auth/login (Identity Service)
    return req.originalUrl.replace(/^\/v1/, "/api");
  },
  proxyErrorHandler: (err, res, next) => {
    // MANEJO DE ERRORES DEL PROXY:
    // Captura errores de conexión (ej. si el Identity Service está caído o hay timeout)
    logger.error(`Proxy error: ${err.message}`);
    res.status(500).json({
      message: `Internal server error`,
      error: err.message,
    });
  },
};

//setting up proxy for our identity service
//(según el archivo routes/identity-service.js que compartiste en el contexto) espera recibir /api/auth/login. Esta función reescribe la URL al vuelo para que coincidan.
app.use(
  "/v1/auth",
  proxy(
    process.env.IDENTITY_SERVICE_URL, //nuestra url httplocalhost
    {
      ...proxyOptions,
      proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
        // MODIFICACIÓN DE HEADERS (SALIDA):
        // Aseguramos que el microservicio reciba el Content-Type correcto
        proxyReqOpts.headers["Content-Type"] = "application/json";
        return proxyReqOpts;
      },
      userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
        // INTERCEPCIÓN DE RESPUESTA (ENTRADA):
        // Podemos leer o modificar la respuesta del microservicio antes de enviarla al cliente
        logger.info(
          `Response received from Identity service: ${proxyRes.statusCode}`,
        );

        return proxyResData;
      },
    },
  ),
); //esto evita que si el dia de manana remplazamos esa api por otra en lugar de cambiar todo en el front solo cambiamos aqui el getaway(el portero del hotel)

//proxy for post-services
app.use(
  "/v1/posts",
  validateToken,
  proxy(process.env.POST_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers["Content-Type"] = "application/json";
      proxyReqOpts.headers["x-user-id"] = srcReq.user.userId; //so obtenemos esto de el auth el user-id

      return proxyReqOpts;
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      logger.info(
        `Response received from Post service: ${proxyRes.statusCode}`,
      );

      return proxyResData;
    },
  }),
);

//proxy for media-service
app.use(
  "/v1/media",
  validateToken,
  proxy(process.env.MEDIA_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers["x-user-id"] = srcReq.user.userId;
      if (!srcReq.headers["content-type"].startsWith("multipart/form-data")) {
        proxyReqOpts.headers["Content-Type"] = "application/json";
      }

      return proxyReqOpts;
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      logger.info(
        `Response received from media service: ${proxyRes.statusCode}`,
      );

      return proxyResData;
    },
    parseReqBody: false,
  }),
);
//proxy for search service
app.use(
  "/v1/posts",
  validateToken,
  proxy(process.env.SEARCH_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers["Content-Type"] = "application/json";
      proxyReqOpts.headers["x-user-id"] = srcReq.user.userId; //so obtenemos esto de el auth el user-id

      return proxyReqOpts;
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      logger.info(
        `Response received from Search service: ${proxyRes.statusCode}`,
      );

      return proxyResData;
    },
  }),
);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`API Gateway is running on port ${PORT}`);
  logger.info(
    `Identity service is running on port ${process.env.IDENTITY_SERVICE_URL}`,
  );
  logger.info(
    `Post service is running on port ${process.env.POST_SERVICE_URL}`,
  );
  logger.info(
    `Media service is running on port ${process.env.MEDIA_SERVICE_URL}`,
  );
    logger.info(
    `Search service is running on port ${process.env.SEARCH_SERVICE_URL}`,
  );
  logger.info(`Redis Url ${process.env.REDIS_URL}`);
});
