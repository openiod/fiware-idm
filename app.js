var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var csrf = require('csurf')
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
//var session = require('express-session');
var session = require('cookie-session');
var partials = require('express-partials');
var sassMiddleware = require('node-sass-middleware');
var forceSsl = require('express-force-ssl');
var clc = require('cli-color');

// Obtain secret from config file
var config = require ('./config.js');

// Create vars that store routes
var index = require('./routes/web/index');
var api = require('./routes/api/index');
var oauth2 = require('./routes/oauth2/oauth2');
var saml2 = require('./routes/saml2/saml2');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Set logs in development
app.use(logger('dev'));

// Disabled header
app.disable('x-powered-by');

// Parse request
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());

var up_date = new Date();

// Set routes for version
app.use(config.urlPrefix+'/version', function (req, res) {
  var version = require('./version.json');
  version.keyrock.uptime = require('./lib/time').msToTime(new Date() - up_date);
  version.keyrock.api.link = config.host + '/' + version.keyrock.api.version;
  res.send(version);
});

// uncomment after placing your favicon in /public
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(partials());

app.use(cookieParser(config.session.secret));
app.use(session({
  secret: config.session.secret,
  name: 'session',
  secure: config.https.enabled,
  maxAge: config.session.expires
}));

var styles = config.site.theme || 'default';
// Middleware to convert sass files to css
app.use(sassMiddleware({
    src: path.join(__dirname, 'themes/' + styles),
    dest: path.join(__dirname, 'public/stylesheets'),
    debug: true,
    // outputStyle: 'compressed',
    outputStyle: 'extended',
    prefix:  config.urlPrefix+'/stylesheets'  // Where prefix is at <link rel="stylesheets" href="prefix/style.css"/>
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(methodOverride('_method'));


// Helpers dinamicos:
app.use(function(req, res, next) {

  res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');

  // init req.session.redir
  if (!req.session.redir) {
    req.session.redir = config.urlPrefix+'/';
  }

  // To make visible req.session in the view
  res.locals.session = req.session;

  // {text: 'message text', type: 'info | success | warning | danger'}
  res.locals.message = {};

  res.locals.site = config.site;
  res.locals.fs = require('fs');

  next();
});


// Force HTTPS connection to web server
if (config.https.enabled) {

  app.set('forceSSLOptions', {
    enable301Redirects: true,
    trustXFPHeader: false,
    httpsPort: config.https.port,
    sslRequiredMessage: 'SSL Required.'
  });

  // Set routes for api
  app.use(config.urlPrefix+'/v1', forceSsl, api);
  app.use(config.urlPrefix+'/v3', forceSsl, api); // REDIRECT OLD KEYSTONE REQUESTS TO THE SAME API

  // Set routes for oauth2
  app.use(config.urlPrefix+'/oauth2', forceSsl, oauth2);
  app.get(config.urlPrefix+'/user', forceSsl, require('./controllers/oauth2/oauth2').authenticate_token);

  // Set routes for saml2
  app.use(config.urlPrefix+'/saml2', forceSsl, saml2);

  // Set routes for GUI
  app.use(config.urlPrefix+'/', forceSsl, index);
} else {

  // Set routes for api
  app.use(config.urlPrefix+'/v1', api);
  app.use(config.urlPrefix+'/v3', api); // REDIRECT OLD KEYSTONE REQUESTS TO THE SAME API

  // Set routes for oauth2
  app.use(config.urlPrefix+'/oauth2', oauth2);
  app.get(config.urlPrefix+'/user', require('./controllers/oauth2/oauth2').authenticate_token);

  // Set routes for saml2
  app.use(config.urlPrefix+'/saml2',  saml2);

  // Set routes for GUI
  app.use(config.urlPrefix+'/', index);
}

// Check connection with Authzforce
if (config.authorization.authzforce.enabled) {
  require('./lib/authzforce.js').check_connection().then(function(status) {
    console.log(clc.green('Connection with Authzforce: ' + status))
  }).catch(function(error) {
    console.log(clc.red(error))
  })
}

module.exports = app;
