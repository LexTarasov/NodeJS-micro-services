const amqp = require("amqplib");
const logger = require("./logger");

let connection = null;
let channel = null;

const EXCHANGE_NAME = "post-exchange";

async function connectToRabbitMQ() {
    try{

connection = await amqp.connect(process.env.RABBITMQ_URL);
channel = await connection.createChannel();

await channel.assertExchange(EXCHANGE_NAME, "topic", {durable: true})
logger.info("Connected to RabbitMQ");
return channel;
    } catch(e){
        logger.error("Error connecting to RabbitMQ", e);
    }
}

async function publishEvent(routingKey, message) {
  if (!channel) {
    await connectToRabbitMQ();
  }

  channel.publish(
    EXCHANGE_NAME,
    routingKey,
    Buffer.from(JSON.stringify(message))
  );
  logger.info(`Event published: ${routingKey}`);
}

module.exports = {connectToRabbitMQ, publishEvent};