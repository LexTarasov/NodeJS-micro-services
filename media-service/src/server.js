require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const Redis = require("ioredis");
const mediaRoutes = require("./routes/media-routes");
const errorHandler = require("./middleware/errorHandler");
const { rateLimit } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const logger = require("./utils/logger");
const { connectToRabbitMQ, consumeEvent } = require("./utils/rabbitmq");
const { handlePostDeleted } = require("./eventHandlers/media-event-handlers");

const app = express();
const PORT = process.env.PORT || 3003;

//connect to mongodb
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => logger.info("Connected to mongodb"))
  .catch((e) => logger.error("Mongo connection error", e));

//connect to redis
const redisClient = new Redis(process.env.REDIS_URL);

  //middleware
  app.use(cors());
app.use(helmet());
app.use(express.json());
//logger 
app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}`);
  logger.info(`Request body, ${req.body}`);
  next();
});

//*** Homework - implement Ip based rate limiting for sensitive endpoints  this is in identity service en server
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

app.use("/api/media", sensitiveEndpointsLimiter, mediaRoutes);//our APIS

app.use(errorHandler);

//connect to rabbitMQ message queque
async function startServer(){
  try{
    await connectToRabbitMQ() //esto llama al evento en media event-handlers para queescuche el grito y borre las imagenes de la db y de cloudinary
    await consumeEvent("post.deleted", handlePostDeleted)
    

    app.listen(PORT, () => {
      logger.info(`Media service listening on port ${PORT}`);
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