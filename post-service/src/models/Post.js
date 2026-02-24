const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    mediaIds: [
      {
        type: String, //some homework here
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);
//no lo usaremos ya que tendremos el service de search 
postSchema.index({ content: "text" });//.index Habilita la capacidad de búsqueda de texto completo. ({ content: "text" }), MongoDB pre-procesa las palabras dentro de content, permitiéndote usar operadores de búsqueda como $text y $search para encontrar resultados de manera muy rápida

const Post = mongoose.model("Post", postSchema);

module.exports = Post;