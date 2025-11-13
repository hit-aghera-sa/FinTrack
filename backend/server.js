const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv").config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({extended: true}));


// ------------ mongodb databse connection
const dbconnect = async() => {
    try{
        await mongoose.connect(process.env.MONGO_URI)
        console.log("mongodb connection successfull");
    }
    catch(error){
        console.log("mongodb connection error :", error);
    }
}
dbconnect()

module.exports = app