var express = require('express');
var csrf = require('csurf')
var bodyParser = require('body-parser');

var router = express.Router();

var config = require ('./config.js');

var csrfProtection = csrf({ cookie: true })

// Create controllers
var web_session_controller = require('../../controllers/web/index').sessions;
var web_admin_controller = require('../../controllers/web/index').admins;

// MW to see if query has delete method
router.use( function( req, res, next ) {
    if ( req.query._method == 'DELETE' ) {
        req.method = 'DELETE';
        req.url = req.path;
    }
    next();
});

// Get Home Page
router.get(config.urlPrefix+'/', csrfProtection, function(req, res, next) {
	if (req.session.user) {
        res.redirect(config.urlPrefix+'/idm')
  } else {
  	res.render('index', { errors: [], csrfToken: req.csrfToken() });
  }
});

// Routes when user is logged
//  - Create sessions for users
router.use(config.urlPrefix+'/auth',  require('./authenticate'))

//  - Route to warn user to change password
router.get(config.urlPrefix+'/update_password',      web_session_controller.login_required,   csrfProtection,    web_session_controller.update_password)

//  - Routes when user is logged
router.use(config.urlPrefix+'/idm/admins',           web_session_controller.login_required, web_session_controller.password_check_date, web_admin_controller.is_admin, require('./admins'))
router.use(config.urlPrefix+'/idm/applications',     web_session_controller.login_required, web_session_controller.password_check_date, require('./applications'))
router.use(config.urlPrefix+'/idm/users',            web_session_controller.login_required, web_session_controller.password_check_date, require('./users'))
router.use(config.urlPrefix+'/idm/organizations',    web_session_controller.login_required, web_session_controller.password_check_date, require('./organizations'))
router.use(config.urlPrefix+'/idm/settings',         web_session_controller.login_required, require('./settings'))
router.use(config.urlPrefix+'/idm',                  web_session_controller.login_required, web_session_controller.password_check_date, csrfProtection,  require('./homes'))

// -- Routes when user is not logged
router.use(config.urlPrefix+'/',  web_session_controller.login_not_required, require('./not_authenticate'))

// catch 404 and forward to error handler
router.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// Error handler
router.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  if (err.code === 'EBADCSRFTOKEN') {
    res.status(403)
    res.send('invalid csrf token')
  } else {
    // render the error page
    res.status(err.status || 500);
    res.render('error', {errors: []});
  }
});


module.exports = router;
