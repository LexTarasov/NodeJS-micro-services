require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const Redis = require("ioredis");
const cors = require("cors");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const postRoutes = require("./routes/post-routes");
const errorHandler = require("./middleware/errorHandler");
const logger = require("./utils/logger");
const { connectToRabbitMQ } = require("./utils/rabbitmq");

const app = express();
const PORT = process.env.PORT || 3002;

//connect to mongodb
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => logger.info("Connected to mongodb"))
  .catch((e) => logger.error("Mongo connection error", e));

//connect to redis
const redisClient = new Redis(process.env.REDIS_URL);

//middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
//logger
app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}`);
  logger.info(`Request body, ${req.body}`);
  next();
});

//*** Homework - implement Ip based rate limiting for sensitive endpoints
//Ip based rate limiting for sensitive endpoints
const sensitiveEndpointsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,//current time window
  max: 50, //cantidad maxim de requests
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Sensitive endpoint rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({ success: false, message: "Too many requests" });
  },
  store: new RedisStore({
    //este es el "puente" entre la librería de rate-limit y nuestra conexión a Redis (ioredis).
    //`...args`: Recibe todos los argumentos del comando que se quiere ejecutar y los agrupa en un array.
    // 2. `redisClient.call()`: Es un método de ioredis para ejecutar cualquier comando de Redis.
    // 3. `...args` (dentro de call): Desempaqueta el array para pasar los argumentos de forma individual a .call().
    // El resultado es que `rate-limit-redis` puede usar nuestra conexión `redisClient` para operar.
    sendCommand: (...args) => redisClient.call(...args),
  }),
});

//routes -> pass redisclient to routes
app.use(
  "/api/posts",
  (req, res, next) => {
    req.redisClient = redisClient;
    next();
  },
  sensitiveEndpointsLimiter, postRoutes //colocamos el rate limiter ANTES del route
);

app.use(errorHandler);

//connect to rabbitMQ message queque
async function startServer(){
  try{
    await connectToRabbitMQ()
    app.listen(PORT, () => {
      logger.info(`Post service listening on port ${PORT}`);
    });
  }catch(e){
    logger.error("Error connecting to RabbitMQ server", e);
    process.exit(1);
  }
}

startServer();


//unhandled promise rejection
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at", promise, "reason:", reason);
});