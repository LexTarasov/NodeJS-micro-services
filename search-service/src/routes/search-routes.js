const express = require("express");
const {searchPostController}= require('../controllers/search-controller');
const { authenticateRequest } = require("../middleware/authMiddleware");


const router = express.Router();

//middleware -> this will tell if the user is an auth user or not
router.use(authenticateRequest); //esto viene del middleware auth

router.get("/posts", searchPostController);

module.exports = router;


