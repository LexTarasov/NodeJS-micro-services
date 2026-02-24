const logger = require("../utils/logger.js");
const { validateCreatePost } = require("../utils/validation.js");

async function invalidatePostCache(req, input) {
  const cachedKey = `post:${input}`; //id del post nuevo, a editar o borrar
  await req.redisClient.del(cachedKey); // borra ese post( para que si me modifico o elimino actualizar con la info de mongoos)

  const keys = await req.redisClient.keys("posts:*");
  if (keys.length > 0) {
    await req.redisClient.del(keys); //esto elimina todas las key: post ya que el indice cambio. Asi cuando vuelva a llamar a mongoose vermos lo nuevo
  }
}

// CREATE POST
const createPost = async (req, res) => {
  logger.info("creating post...");
  try {
    //validate the schema
    const { error } = validateCreatePost(req.body);
    if (error) {
      logger.warn("Validation error", error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }
    const { content, mediaIds } = req.body;
    const newlyCreatedPost = new Post({
      user: req.userId,
      content,
      mediaIds: mediaIds || [],
    });
    await newlyCreatedPost.save();

    await publishEvent("post.created", {

      postId: newlyCreatedPost._id.toString(),
      userId: newlyCreatedPost.user.toString(),
      content: newlyCreatedPost.content,
      createdAt: newlyCreatedPost.createdAt
      
    })

    await invalidatePostCache(req, newlyCreatedPost._id.toString());
    logger.info("post created successfully", newlyCreatedPost);
    res.status(201).json({
      success: true,
      message: "post created successfully",
    });
  } catch (e) {
    logger.error("error creating post", error);
    res.status(500).json({
      success: false,
      message: "error creating post",
    });
  }
};

// GET ALL
const getAllPost = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // de la db dame de la pagina uno los primeros 10 records
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;

    const cacheKey = `posts:${page}:${limit}`; // esto guarda los datos por llave. Al crear una llave como posts:1:10, estás creando una "caja" específica para esa página y ese límite.
    const cachedPosts = await req.redisClient.get(cacheKey); // tienes algo en la caja post:1:10?

    //si la caja existe true la devolvemos como json
    if (cachedPosts) {
      return res.json(JSON.parse(cachedPosts));
    } //convertimos a json reids solo guarda texto plano

    //sino existe false, buscamos en la base de datos verdadera Post
    const posts = await Post.find({})
      .sort({ createdAt: -1 }) //Los más nuevos primero
      .skip(startIndex) // Sáltate los que ya vimos
      .limit(limit); // Dame solo los que pedí (10)

    const totalNoOfPosts = await Post.countDocuments();

    //Creamos un objeto ordenado con los posts y la info de la paginación.
    const result = {
      posts,
      currentpage: page,
      totalPages: Math.ceil(totalNoOfPosts / limit),
      totalPosts: totalNoOfPosts,
    };

    //save your posts in redis cache, guardados para la proxima
    await req.redisClient.setex(cacheKey, 300, JSON.stringify(result));
    //setex: Es "SET with EXpiration". cacheKey: La dirección de la caja. 300: Segundos (5 minutos) despues de ese tiempo se eliminara la caja cachekey.

    //nuestro objeto de JS a un texto plano para que Redis lo pueda guardar.
    res.json(result);
  } catch (e) {
    logger.error("error fetching post", error);
    res.status(500).json({
      success: false,
      message: "error fetching post",
    });
  }
};

//GET POST / ID
const getPost = async (req, res) => {
  try {
    const postId = req.params.id;
    const cachekey = `post:${postId}`;
    const cachedPost = await req.redisClient.get(cachekey);

    if (cachedPost) {
      return res.json(JSON.parse(cachedPost));
    }

    const singlePostDetailsbyId = await Post.findById(postId);

    if (!singlePostDetailsbyId) {
      return res.status(404).json({
        message: "Post not found",
        success: false,
      });
    }
//setex set expiration
    await req.redisClient.setex(
      cachedPost,
      3600,
      JSON.stringify(singlePostDetailsbyId),
    );
//el nuevo post de mooongos en json
    res.json(singlePostDetailsbyId);
  } catch (e) {
    logger.error("error finding post", error);
    res.status(500).json({
      success: false,
      message: "error finding post by ID",
    });
  }
};

//DELETE / ID
const deletePost = async (req, res) => {
  try {
    const post = await Post.findOneAndDelete({ //usamos findone que es si es el user id del delete post y el id del post asi cualquiera no borrara tu post
      _id: req.params.id,
      user: req.user.userId,
    });

    if (!post) {
      return res.status(404).json({
        message: "Post not found",
        success: false,
      });
    }

    //publish post delete method ->
    await publishEvent("post.deleted", { //Es una forma de avisar a otros microservicios que algo pasó.
      postId: post._id.toString(),
      userId: req.user.userId,
      mediaIds: post.mediaIds, //Al publicar este evento, le estás diciendo al sistema: "¡Oigan! El post tal se borró, y estas eran sus fotos (mediaIds) quien se encargue de eso, borrenlas
    });

    await invalidatePostCache(req, req.params.id);
    res.json({
      message: "Post deleted successfully",
    });

    

  } catch (e) {
    logger.error("error deleting post", error);
    res.status(500).json({
      success: false,
      message: "error deleting post",
    });
  }
};
