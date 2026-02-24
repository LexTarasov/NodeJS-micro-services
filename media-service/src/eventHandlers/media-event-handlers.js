const Media = require("../models/Media");
const { deleteMediaFromCloudinary } = require("../utils/cloudinary");
const logger = require("../utils/logger");

const handlePostDeleted = async (event) => {
  console.log(event, "eventeventevent");
  const { postId, mediaIds } = event;
  try {
    const mediaToDelete = await Media.find({ _id: { $in: mediaIds } });

    for (const media of mediaToDelete) {
      await deleteMediaFromCloudinary(media.publicId);//Primero borra la imagen real de la nube (Cloudinary). ¡Esto es lo más importante para no gastar dinero en almacenamiento!
      await Media.findByIdAndDelete(media._id);//Luego borra el registro de su propia base de datos de Mongo.

      logger.info(
        `Deleted media ${media._id} associated with this deleted post ${postId}` //avisa que se borro
      );
    }

    logger.info(`Processed deletion of media for post id ${postId}`);
  } catch (e) {
    logger.error(e, "Error occured while media deletion");
  }
};

module.exports = { handlePostDeleted };