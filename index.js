const express = require('express');
const passport = require('passport');
const cookieSession = require('cookie-session');

const GoogleStrategy = require('passport-google-oauth20');

const MS_IN_DAY = 86400000

'use strict'

// our database operations
const dbo = require('./databaseOps');

// app is the object that implements the express server
const app = express();

// use this instead of the older body-parser
app.use(express.json());

// make all the files in 'public' available on the Web
app.use(express.static('public'))


// Google login credentials, used when the user contacts
// Google, to tell them where he is trying to login to, and show
// that this domain is registered for this service. 
// Google will respond with a key we can use to retrieve profile
// information, packed into a redirect response that redirects to
// server162.site:[port]/auth/redirect
const hiddenClientID = process.env['client-id']
const hiddenClientSecret = process.env['client-secret']

// An object giving Passport the data Google wants for login.  This is 
// the server's "note" to Google.
const googleLoginData = {
    clientID: hiddenClientID,
    clientSecret: hiddenClientSecret,
    callbackURL: '/auth/accepted',
    proxy: true
};


// Tell passport we will be using login with Google, and
// give it our data for registering us with Google.
// The gotProfile callback is for the server's HTTPS request
// to Google for the user's profile information.
// It will get used much later in the pipeline. 
passport.use(new GoogleStrategy(googleLoginData, gotProfile) );


// Let's build a server pipeline!

// pipeline stage that just echos url, for debugging
app.use('/', printURL);

// Check validity of cookies at the beginning of pipeline
// Will get cookies out of request object, decrypt and check if 
// session is still going on. 
app.use(cookieSession({
    maxAge: 6 * 60 * 60 * 1000, // Six hours in milliseconds
    // after this user is logged out.
    // meaningless random string used by encryption
    keys: ['hanger waldo mercy dance']  
}));

// Initializes passport by adding data to the request object
app.use(passport.initialize()); 

// If there is a valid cookie, this stage will ultimately call deserializeUser(),
// which we can use to check for a profile in the database
app.use(passport.session()); 

// Public static files - /public should just contain the splash page
app.get("/", (request, response) => {
  response.sendFile(__dirname + "/public/splash.html");
});

app.get('/*',express.static('public'));

// next, handler for url that starts login with Google.
// The app (in public/login.html) redirects to here 
// (it's a new page, not an AJAX request!)
// Kicks off login process by telling Browser to redirect to
// Google. The object { scope: ['profile'] } says to ask Google
// for their user profile information.
app.get('/auth/google',
	passport.authenticate('google',{ scope: ['profile'] }) );
// passport.authenticate sends off the 302 (redirect) response
// with fancy redirect URL containing request for profile, and
// client ID string to identify this app. 
// The redirect response goes to the browser, as usual, but the browser sends it to Google.  
// Google puts up the login page! 

// Google redirects here after user successfully logs in
// This route has three middleware functions. It runs them one after another.
app.get('/auth/accepted',
	// for educational purposes
	function (req, res, next) {
    console.log("at auth/accepted");
    next();
	},
	// This will issue Server's own HTTPS request to Google
	// to access the user's profile information with the 
	// temporary key we got in the request. 
	passport.authenticate('google'),
	// then it will run the "gotProfile" callback function,
	// set up the cookie, call serialize, whose "done" 
	// will come back here to send back the response
	// ...with a cookie in it for the Browser! 
	function (req, res) {
    console.log('Logged in and using cookies!')
    // tell browser to get the hidden main page of the app
    res.redirect('/index.html');
	});

// static files in /user are only available after login
app.get('/*',
	isAuthenticated, // only pass on to following function if
	// user is logged in 
	// serving files that start with /user from here gets them from ./
	express.static('user') 
); 

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

// next, put all queries (like store or reminder ... notice the isAuthenticated 
// middleware function; queries are only handled if the user is logged in
app.get('/query', isAuthenticated,
    function (req, res) { 
      console.log("saw query");
      res.send('HTTP query!') 
    }
);

// when there is nothing following the slash in the url, return the main page of the app.
app.get("/", (request, response) => {
  response.sendFile(__dirname + "/public/index.html");
});

// for the chart
app.get('/week', isAuthenticated, async (request, response) => {
  let date = parseInt(request.query.date)
  let activity = request.query.activity
  let userid = request.user.user
  
  /* Get Latest Activity in DB if not provided by query params */
  if (activity === undefined) {
    let result = await dbo.get_most_recent_entry(userid)
    try {
      activity = result.activity
    } catch(error) {
      activity = "none"
    }
  }
  
  /* Get Activity Data for current Date and The Week Prior */
  let min = date - 6 * MS_IN_DAY
  let max = date
  let result = await dbo.get_similar_activities_in_range(activity, min, max, userid)
  
  console.log('WEEK', result)

  /* Store Activity amounts in Buckets, Ascending by Date */
  let data = Array.from({length: 7}, (_, i) => {
    return { 
      date: date - i * MS_IN_DAY, 
      value: 0 
    }
  })

  /* Fill Data Buckets With Activity Amounts */
  for(let i = 0 ; i < result.length; i++) {
    let idx = Math.floor((date - result[i].date)/MS_IN_DAY)
    data[idx].value += result[i].amount
  }
  
  // Send Client Activity for the Selected Week
  response.send(data.reverse());
})

// pull most recent past planned activity as reminder
app.get('/reminder', isAuthenticated, (request, response) => {

  let userid = request.user.user

  // pull out all future activities
  // send back most recently planned activity to browser
  // delete all past planned activities from db
  dbo.retrievePlanned(userid)
  .then(result => {
    // look at all planned activities
    // console.log(result)

    // init var
    // let today = new Date().toISOString().split('T')[0]
    let today = new Date().getTime() - MS_IN_DAY

    // filter through dates that are < today, then find the most recent
    let getMostRecent = () => {
      let pastPlanned = result.filter(
        r => r['date'] < today
      )
      let mostRecent = pastPlanned[0]
      pastPlanned.forEach(plan => {
        if (plan['date'] > mostRecent['date']) {
          mostRecent = plan
        }
      })
      return mostRecent
    }

    // fish out most recent 
    let mostRecentPlan = getMostRecent()
    
    // delete all "older" planned activities
    dbo.deleteOlderPlanned(today, userid)

    // return the most recent 
    response.json(mostRecentPlan)
  })
  .catch(error => console.log(error))
})

// This is where the server recieves and responds to POST requests
app.post('/store', isAuthenticated, (request, response, next) => {
  console.log("Server recieved a post request at", request.url);
  console.log("recieved object", request.body);
  response.json("I got your POST request");

  let userid = request.user.user

  let data = request.body
  let ms = new Date(data.date).getTime()

  // save to db
  // if past activity
  if (Object.keys(data).length == 4) {
    // dbo.insert(data.activity, data.date, data.amount)
    dbo.insert(data.activity, ms, data.amount, userid)
  } 
  // if future activity
  else if (Object.keys(data).length == 2) {
    // dbo.insert(data.activity, data.date, -1)
    dbo.insert(data.activity, ms, -1, userid)
  }
});

// delete one
app.delete('/delete', isAuthenticated, (req, resp) => {
  let userid = req.user.user
  dbo.deleteOne(req.query.rowIdNum, userid)
  .then(() => resp.json(`deleted row ${req.query.rowIdNum}`))
  .catch(err => resp.json(err))
})

// name
app.get('/name', isAuthenticated, async (req, res) => {
  let userid = req.user.user
  let profile = await dbo.getUser(userid)
  try {
    console.log('PROFILE', profile)
    let fname = profile[0].firstname
    res.json(fname)
  }
  catch (err) {
    console.log(err) 
  }
})

// finally, file not found, if we cannot handle otherwise.
app.use( fileNotFound );

/* middleware functions called by some of the functions above. */

// print the url of incoming HTTP request
function printURL (req, res, next) {
    console.log(req.url);
    next();
}

// function for end of server pipeline
function fileNotFound(req, res) {
    let url = req.url;
    res.type('text/plain');
    res.status(404);
    res.send('Cannot find '+url);
}

// function to check whether user is logged when trying to access
// personal data
function isAuthenticated(req, res, next) {
    if (req.user) {
      // user field is filled in in request object
      // so user must be logged in! 
	    console.log("user",req.user,"is logged in");
	    next();
    } else {
	res.redirect('/splash.html');  // send response telling
	// Browser to go to login page
    }
}

// Some functions Passport calls, that we can use to specialize.
// This is where we get to write our own code, not just boilerplate. 
// The callback "done" at the end of each one resumes Passport's
// internal process.  It is kind of like "next" for Express. 

// function called during login, the second time passport.authenticate
// is called (in /auth/redirect/),
// once we actually have the profile data from Google. 
function gotProfile(accessToken, refreshToken, profile, done) {
  console.log("Google profile has arrived", profile);
  // here is a good place to check if user is in DB,
  // and to store him in DB if not already there. 
  // Second arg to "done" will be passed into serializeUser,
  // should be key to get user out of database.

  let userid = profile.id;  
  let firstname = profile.name.givenName;

  // insert user into Profile table
  dbo.insertUser(userid, firstname)
  .then(() => {
    console.log(`Inserted profile with userid: ${userid} and fname ${firstname} into db`)
  })
  .catch(err => console.log('Failed to insert User', err))

  done(null, userid); 
}

// Part of Server's session set-up.  
// The second operand of "done" becomes the input to deserializeUser
// on every subsequent HTTP request with this session's cookie. 
passport.serializeUser((userid, done) => {
    console.log("SerializeUser. Input is",userid);
    done(null, userid);
});

// Called by passport.session pipeline stage on every HTTP request with
// a current session cookie. 
// Where we should lookup user database info. 
// Whatever we pass in the "done" callback becomes req.user
// and can be used by subsequent middleware.
passport.deserializeUser(async (userid, done) => {
    console.log("deserializeUser. Input is:", userid);
    // here is a good place to look up user data in database using
    // dbRowID. Put whatever you want into an object. It ends up
    // as the property "user" of the "req" object. 
    let userData = {user: userid};
    done(null, userData);
});

// listen for requests :)
const listener = app.listen(3000, () => {
  console.log("The static server is listening on port " + listener.address().port);
});


