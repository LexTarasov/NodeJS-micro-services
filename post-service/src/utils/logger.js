const winston = require("winston"); // winston te permite registrat informacion sobre los errores que podrian suceder en la app de una manera organizada y flexible 

const logger = winston.createLogger({
  // Nivel de log: 'info' en producción (menos ruido), 'debug' en desarrollo (todo el detalle)
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(), // Agrega fecha y hora al log
    winston.format.errors({ stack: true }), // Si es un error, muestra el rastro (stack trace)
    winston.format.splat(), // Permite interpolación de strings (ej: %s)
    winston.format.json(), // Formato final en JSON (ideal para servidores)
  ),
  // Metadatos por defecto añadidos a cada log
  defaultMeta: { service: "post-service" },
  transports: [
    // 1. Consola: Para ver logs en tiempo real
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(), // Colores en la terminal
        winston.format.simple(), // Formato simple de texto
      ),
    }),
    // 2. Archivo error.log: Solo guarda errores
    new winston.transports.File({ filename: "error.log", level: "error" }),
    // 3. Archivo combine.log: Aquí también está configurado solo para errores (level: 'error')
    new winston.transports.File({ filename: "combine.log", level: "error" }),
  ],
});
module.exports = logger;
