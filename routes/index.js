var dbaccess = require('../dbaccess');

/**
 * Redirects the dbaccess page to the play page of the dbaccess room.
 */
exports.index = function(req, res) {
	dbaccess.getRooms(function(err, rooms) {
		if (err) {
			res.send(500, { error: err.message });
		} else if (rooms === null) {
			res.render('index', { rooms: [] });
		} else {
			res.render('index', { rooms: rooms });
		}
	});
};

/**
 * Creates a new room with the given name
 */
exports.createPlaylist = function(req, res) {
	var query = req.query;
	if ('name' in query) {
		dbaccess.createRoom(query.name, function(err, room) {
			if (err) {
				res.send(500, { error: err.message });
			} else {
				res.send(200, room);
			}
		});
	} else {
		res.send(400, { error: 'malformed query' });
	}
}

/**
 * Serves the play page for the given room
 */
exports.servePlayPage = function(req, res) {
	var roomId = req.params.room_id;
	res.render('play', { roomId: roomId });
}