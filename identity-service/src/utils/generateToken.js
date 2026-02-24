const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const RefreshToken = require("../models/RefreshToken");

const generateTokens = async (user) => {
  const accessToken = jwt.sign(
    {
      userId: user._id,
      username: user.username,
    },
    process.env.JWT_SECRET,
    { expiresIn: "60m" }
  );

  // 1. Generamos un string aleatorio criptográficamente seguro (hexadecimal)
  const refreshToken = crypto.randomBytes(40).toString("hex");
  
  // 2. Establecemos la fecha de expiración (Fecha actual + 7 días)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); 

  // 3. Guardamos la referencia en la DB usando el Modelo (Mayúscula)
  await RefreshToken.create({
    token: refreshToken,
    user: user._id,
    expiresAt,
  });

  return { accessToken, refreshToken };
};

module.exports = generateTokens;