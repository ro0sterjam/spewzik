var dbaccess = require('../dbaccess');

/**
 * Redirects the dbaccess page to the play page of the dbaccess room.
 */
exports.index = function(req, res) {	
	res.render('index');
};