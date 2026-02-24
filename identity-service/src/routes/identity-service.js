const express = require("express");
const {
  resgiterUser,  
  loginUser,
  refreshTokenUser,
  logoutUser,
} = require("../controllers/identity-controller.js");

const router = express.Router();
//aqui pasamos lo que creamos en controllers 
router.post("/register", resgiterUser);
router.post("/login", loginUser);
router.post("/refresh-token", refreshTokenUser);
router.post("/logout", logoutUser);

module.exports = router;