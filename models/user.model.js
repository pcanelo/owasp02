const mongoose = require("mongoose");

const userSchema = mongoose.Schema({
  username: {
    type: String,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  email: {
    type: String
  },
  isTempPassword: {
    type: Boolean,
    required: true,
    default: false
  }
});

// const User = mongoose.model("User", userSchema);
module.exports = mongoose.model("User", userSchema, "user");
