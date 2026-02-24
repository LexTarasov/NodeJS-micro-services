require("dotenv").config();
const mongoose = require("mongoose");
const logger = require("./utils/logger");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const { RateLimiterRedis } = require("rate-limiter-flexible");
const Redis = require("ioredis");
const { rateLimit } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const routes = require("./routes/identity-service");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 3001;

//connect to mongodb
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => logger.info("Connected to mongodb")) //logger es lo que creamos con winston(para darnos detalle completo para debug si algo falla)
  .catch((e) => logger.error("Mongo connection error", e));

  //nos conectamos a redis con su puerto y url que guardamos en .env
  const redisClient = new Redis(process.env.REDIS_URL);


  //middleware
app.use(helmet());//middleware para Express que ayuda a proteger tu aplicación con varios (headers) HTTP automáticamente
app.use(cors());// es el portero del edificiole dicimos quienes pueden y no pueden acceder a peticiones ej ciertas urls ej httpLocalHost3000
app.use(express.json());

// Middleware global de logging: intercepta TODAS las peticiones para mostrar info en consola
app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}`);
  logger.info(`Request body, ${JSON.stringify(req.body)}`); // Convertimos el body a string para leerlo bien, si no saldría [object Object]
  next();
});


//DDos protection and rate limiting
const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: "middleware",//es como un id 
  points: 10,//cantidad de peticiones
  duration: 1,//maximo 10 requests en 1s a una api
});

app.use((req, res, next) => {
  rateLimiter
    .consume(req.ip)//checa si esta ip excedio el limite de requests
    .then(() => next())//sino lo hizo next()
    .catch(() => { 
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({ success: false, message: "Too many requests" });//si lo excedio , error 
    });
});

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

//apply this sensitiveEndpointsLimiter to our routes
app.use("/api/auth/register", sensitiveEndpointsLimiter);

//Routes
app.use("/api/auth", routes);

//nuestro middleware error handler universal
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Identity service running on port ${PORT}`);
});

//unhandled promise rejection
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at", promise, "reason:", reason);
});
// Este evento se dispara cuando una Promesa falla y no tiene un .catch() o try/catch.
// Actúa como una red de seguridad global para capturar errores asíncronos olvidados y registrarlos.