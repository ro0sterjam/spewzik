var player = require('../player');
var dbaccess = require('../dbaccess');

/**
 * Renders the index page.
 */
exports.index = function(req, res) {	
	res.render('index');
};

/**
 * Renders the room page for the given room ID.
 */
exports.room = function(req, res) {
	var roomId = req.params.room_id;

	dbaccess.getRoom(roomId, function(err, room) {
		if (err) {
			res.send(500, { error: err.message });
		} else if (room === null) {
			res.send(404, { error: 'room not found' });
		} else {
			res.render('room', { roomId: room._id, roomName: room.name});
		}
	});
}

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

/**
 * Sends all the rooms.
 */
exports.getRooms = function(req, res) {
	dbaccess.getRoomsDetails(function(err, rooms) {
		if (err) {
			res.send(500, { error: err.message });
		} else {
			res.send(200, rooms);
		}
	});
}

/**
 * Sends the currently playing track for the given room ID.
 */
exports.getCurrentTrack = function(req, res) {
	var roomId = req.params.room_id;

	player.getCurrentlyPlaying(roomId, function(err, track) {
		if (err) {
			res.send(500, { error: err.message });
		} else if (track === null) {
			res.send(404, { error: 'no track currently playing' });
		} else {
			res.send(200, track);
		}
	});
}