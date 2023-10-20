const mongoose = require("mongoose");

const customerSchema = mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  contactEmail: {
    type: String,
    required: true
  },
  contactPerson: {
    type: String
  }
});

// const Customer = mongoose.model("Customer", customerSchema);
module.exports = mongoose.model("Customer", customerSchema, "customer");
