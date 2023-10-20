const path = require("path");
const express = require("express");
require("./db");
const casbin = require("casbin");
const User = require("./models/user.model");
const Customer = require("./models/customer.model");
const MongooseAdapter = require("casbin-mongoose-adapter");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const saltRounds = 10;
const bodyParser = require("body-parser");
const asyncHandler = require("express-async-handler");
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());

const model = path.resolve(__dirname, "./auth_model.conf");
async function createEnforcer() {
  const adapter = await MongooseAdapter.newAdapter(
    "mongodb://mongo:27017/test"
  );
  return casbin.newEnforcer(model, adapter);
}

const genUserPassword = strPassword => {
  return bcrypt.hashSync(strPassword, saltRounds);
};

const jwtPassword = process.env.JWT_PASSWORD;

let verifyToken = req => {
  try {
    decoded = jwt.verify(req.headers("Authorization"), jwtPassword);
    console.log("verified", decoded);
    return decoded;
  } catch (err) {
    return null;
  }
};

app.post("/test", (req, resp) => {
  console.log(req.body);
  console.log(typeof req.body);
  resp.json(req.body);
});

app.post("/change-password", (req, res) => {
  var reqData = req.body;
  if (
    "currentPassword" in reqData &&
    "newPassword" in reqData &&
    "confirmPassword" in reqData &&
    "user" in reqData
  ) {
    if (reqData.newPassword === reqData.confirmPassword) {
      User.findOne({ username: reqData.user }, (err, doc) => {
        if (err) {
          res.status(400).json({
            error: true,
            success: false,
            message: "Unable to process request"
          });
        }
        if (doc) {
          console.log(reqData.currentPassword, doc.password);
          var comparePass = bcrypt.compareSync(
            reqData.currentPassword.toString(),
            doc.password
          );
          console.log(comparePass);
          if (comparePass) {
            var newPass = genUserPassword(reqData.newPassword);
            User.updateOne(
              { username: "root" },
              {
                password: newPass,
                isTempPassword: false
              }
            )
              .then(data => {
                res.json({
                  success: true,
                  error: false,
                  message: "password for user successfully changed"
                });
              })
              .catch(err => {
                res.status(400).json({
                  success: false,
                  error: true,
                  message: "unable to change password"
                });
              });
          } else {
            res.status(403).json({
              success: false,
              error: true,
              message: "user current password is incorrect"
            });
          }
        }
      });
    } else {
      req.status(400).json({
        success: false,
        error: true,
        message: "new passwords don't match"
      });
    }
  }
});

app.post(
  "/login",
  asyncHandler(async (req, res) => {
    var reqData = req.body;
    if ("password" in reqData && "user" in reqData) {
      try {
        var user = await User.findOne({ username: reqData.user });
        if (user) {
          try {
            var hashResult = bcrypt.compareSync(
              req.body.password,
              user.password
            );
            if (hashResult) {
              var token = await jwt.sign(
                { user: user.username },
                jwtPassword
              );
              console.log(token)
              res.json({
                success: true,
                error: false,
                data: { authToken: token, user: user.username }
              });
            } else {
              res
                .status(403)
                .json({ success: false, error: true, message: "unauthorized" });
            }
          } catch (hashErr) {
            console.log(hashErr)
            res
              .status(403)
              .json({ success: false, error: true, message: "invalid credentials" });
          }
        }
      } catch (err) {}
    }
  })
);

app.post("/signup", (req, res) => {
  if ("user" in req.body && "password" in req.body) {
    User.create({
      username: req.body.user,
      password: genUserPassword(req.body.password)
    })
      .then(doc => {
        res.json({
          success: true,
          error: false,
          message: "user signed up successfully"
        });
      })
      .catch(err => {
        res.status(400).json({
          success: false,
          error: true,
          message: "unable to signup user"
        });
      });
  }
});

app.post(
  "/create-customer",
  asyncHandler(async (req, res) => {
    try {
      const decoded = await jwt.verify(
        req.header("Authorization"),
        jwtPassword
      );
      if (decoded) {
        if ("name" in req.body && "contactEmail" in req.body) {
          const doc = await Customer.create({
            name: req.body.name,
            contactEmail: req.body.contactEmail
          });

          const enforcer = await createEnforcer();
          await enforcer.addPolicy(decoded.user, doc.name, "read");
          await enforcer.addPolicy(decoded.user, doc.name, "write");
          await res.json({
            success: true,
            error: false,
            message: "Successfully create user"
          });
        }
      }
    } catch (err) {
      res
        .status(403)
        .json({ success: false, error: true, message: err.toString() });
    }
  })
);

app.post(
  "/edit-customer",
  asyncHandler(async (req, res) => {
    try {
      const decoded = await jwt.verify(
        req.header("Authorization"),
        jwtPassword
      );
      console.log(decoded);
      const enforcer = await createEnforcer();
      if (!"name" in req.body) {
        res.status(404).json({
          success: false,
          error: true,
          message: "unable to find customer"
        });
      } else {
        const enforceResult = await enforcer.enforce(
          decoded.user,
          req.body.name,
          "write"
        );
        if (enforceResult) {
          try {
            const doc = await Customer.findOneAndUpdate(
              {
                name: req.body.name
              },
              {
                contactEmail: req.body.contactEmail,
                contactPerson: req.body.contactPerson
              },
              {
                new: true
              }
            );
            if (doc) {
              await console.log(enforcer.getPermissionsForUser(decoded.user));
              res.json({
                success: true,
                error: false,
                message: "customer successfully updated"
              });
            }
          } catch (err) {
            res.status(400).json({
              success: false,
              error: true,
              message: err.toString()
            });
          }
        } else {
          res.status(403).json({
            success: false,
            error: true,
            message: "user is unauthorized to perform this action"
          });
        }
      }
    } catch (err) {
      res.status(400).json({
        success: false,
        error: true,
        message: err.toString()
      });
    }
  })
);

app.get(
  "/get-customer/:custName",
  asyncHandler(async (req, res) => {
    if (!req.header("Authorization")) {
      res.status(403).json({
        success: false,
        error: true,
        message: "No Authorization Header"
      });
    }
    try {
      console.log(req.param.custName);
      const decoded = await jwt.verify(
        req.header("Authorization"),
        jwtPassword
      );
      const enforcer = await createEnforcer();
      var result = await enforcer.enforce(
        decoded.user,
        req.params.custName,
        "read"
      );
      if (result) {
        try {
          var refCustomer = await Customer.findOne({
            name: req.params.custName
          });
          res.json({ success: true, error: false, data: refCustomer });
        } catch (dbErr) {
          res.status(404).json({
            success: false,
            error: true,
            message: "unable to find customer"
          });
        }
      } else {
        res.status(403).json({
          success: false,
          error: true,
          message: "unauthorized to perform action"
        });
      }
    } catch (e) {
      if (e instanceof JsonWebTokenError) {
        res.status(403).json({
          success: false,
          error: true,
          message: e.toString()
        });
      }
      res
        .status(400)
        .json({ success: false, error: true, message: e.toString() });
    }
  })
);

app.listen(5000, async () => {
  console.log("Application ready to receive requests");
  User.findOne({ username: "root" }, (err, data) => {
    if (!data) {
      User.create({
        username: "root",
        password: genUserPassword("sup3rs3cr3t"),
        email: "root@user.com",
        isTempPassword: true
      })
        .then(data => {
          console.log(
            "Created admin user with default password 'sup3rs3cr3t'. por favor cambia password to login"
          );
        })
        .catch(err => {
          console.err("Unable to create admin user");
        });
    }
  });
});
