const mongoose = require("mongoose");

mongoose
  .connect("mongodb://mongo:27017/test", { useNewUrlParser: true })
  .then(() => {
    console.log("Database connected successfully");
  })
  .catch(err => {
    console.log("Database connection error");
  });