var player = require('../player');

/**
 * Redirects the dbaccess page to the play page of the dbaccess room.
 */
exports.index = function(req, res) {	
	res.render('index');
};

/**
 * Adds a track to the given room playlist either by track ID, url, or host + external ID.
 */
exports.addTrackToPlaylist = function(req, res) {
	var roomId = req.params.room_id;
	
	var query = req.query;
	if ('host' in query && 'eid' in query) {
		player.addTrackToPlaylist(roomId, query.host, query.eid, function(err, track) {
			if (err) {
				res.send(500, { error: err.message });
			} else if (track === null) {
				res.send(409, { error: 'Track already queued in playlist'});
			} else {
				res.send(200, track);
			}
		});
	} else {
		res.send(400, { error: 'malformed query' });
	}
};

exports.getRoomsDetails = function(req, res) {
	player.getRoomsDetails(function(err, rooms) {
		if (err) {
			res.send(500, { error: err.message });
		} else {
			res.send(200, rooms);
		}
	});
}

/**
 * Serves the room with the given room ID to the response.
 */
exports.getRoom = function(req, res) {
	var roomId = req.params.room_id;

	player.getRoom(roomId, function(err, room) {
		if (err) {
			res.send(500, { error: err.message });
		} else if (room === null) {
			res.send(404, { error: 'room not found' });
		} else {
			res.send(200, room);
		}
	});
};

/**
 * Serves the currently playing track.
 */
exports.getCurrentTrack = function(req, res) {
	var roomId = req.params.room_id;

	player.getCurrentTrack(roomId, function(err, track) {
		if (err) {
			res.send(500, { error: err.message });
		} else if (track === null) {
			res.send(404, { error: 'no track currently playing' });
		} else {
			res.send(200, track);
		}
	});
}