require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");  //When we used the express-session middleware, what it did is it basically create a session in the browser with a cookie
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");    // salts and hashes passwords for us automatically.
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require('mongoose-findorcreate');

const app = express();

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

// Now, one thing to note here is that Passport works on top of the express session. So you have to use the express session middleware before using Passport middleware.

app.use(session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false
}));

//As the user navigates from page to page, the session itself can be authenticated using the built-in session strategy. Because an authenticated session is typically needed for the majority of routes in an application, it is common to use this as application-level middleware, after session middleware.
app.use(passport.initialize()); //init passport on every route call.
app.use(passport.session()); //allow passport to use "express-session".



mongoose.connect("mongodb://localhost:27017/userDB");


const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());
// passport.serializeUser(User.serializeUser());    //To sum it up, passport.serializeUser() saves the user inside the session which was earlier created by express-session middleware.
// passport.deserializeUser(User.deserializeUser());

passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
      cb(null, { id: user.id, username: user.username, name: user.name });
    });
  });
  
  passport.deserializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, user);
    });
  });

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:5000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"    // from github issues section, as people were discussing that google+ service is being deprecated.
},
    function (accessToken, refreshToken, profile, cb) {
        console.log(profile);
        User.findOrCreate({ googleId: profile.id }, function (err, user) {   //since findorcreate is not a mongoose function. its a made up function by passportjs. To make it work just npm install mongoose-findorcreate.
            return cb(err, user);
        });
    }
));


app.get("/", function (req, res) {
    res.render("home")
});

app.get("/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get('/auth/google/secrets', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect secret page.
    res.redirect('/secrets');
  });

app.get("/login", function (req, res) {
    res.render("login")
});

app.get("/register", function (req, res) {
    res.render("register")
});

app.get("/secrets", function (req, res) {
    if (req.isAuthenticated()) {
        res.render("secrets");
    } else {
        res.redirect("/login");
    }
});

app.get("/logout", function (req, res) {
    req.logOut(function (err) {
        if (err) {
            console.log(err)
        } else {
            res.redirect("/");
        }
    });
})

app.post("/register", function (req, res) {
    User.register({ username: req.body.username }, req.body.password, function (err, user) {
        if (err) {
            console.log(err);
            res.redirect("/register");
        } else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/secrets");
            })
        }
    });

});


app.post("/login", function (req, res) {
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });
    req.login(user, function (err) {
        if (err) {
            console.log(err)
        } else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/secrets");
            })
        }
    });
});





let port = 5000;
app.listen(port, function () {
    console.log(`server listening to port ${port}`)
})


