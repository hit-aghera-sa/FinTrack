const express = require("express");
const router = express.Router();
const {createTransaction} = require("../controllers/transasction.controller")

router
    .post("/", createTransaction)

module.exports = router;