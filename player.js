var dbaccess = require('./dbaccess');
var app = require('./app');

var trackWaitTime = 5;
var percentToSkip = 0.8;

var roomStartTimes = {};
var roomTimers = {};

startPlayingAllRooms();

function startPlayingAllRooms() {
	dbaccess.getRooms(function(err, rooms) {
		for (var i in rooms) {
			startPlaying(rooms[i]._id);
		}
	});
}

function isPlaying(roomId) {
	return typeof(roomStartTimes[roomId]) !== 'undefined';
}

function startPlaying(roomId) {
	console.log('commencing play for room: ' + roomId);
	dbaccess.getCurrentTrack(roomId, function(err, track) {
		if (err) {
			app.io.sockets.in(roomId).emit('error', err.message);
		} else if (track === null) {
			console.log('nothing to play in room: ' + roomId);
		} else {
			playTrack(roomId, track);
		}
	});
}

function playTrack(roomId, track) {
	console.log('playing track (' + track.name + ') in room ' + roomId);
	resetForNewTrack(roomId);
	
	app.io.sockets.in(roomId).emit('play', { track : track, start: 0 });
	roomStartTimes[roomId] = process.hrtime();
	roomTimers[roomId] = setTimeout(function() {
		delete(roomTimers[roomId]);
		delete(roomStartTimes[roomId]);
		playNext(roomId);
	}, (track.duration + trackWaitTime) * 1000);
}

function playNext(roomId) {
	if (typeof(roomTimers[roomId]) !== 'undefined') {
		clearInterval(roomTimers[roomId]);
		delete(roomTimers[roomId]);
	}
	dbaccess.playNext(roomId, function(err, track) {
		if (err) {
			app.io.sockets.in(roomId).emit('error', err.message);
		} else if (track === null) {
			console.log('nothing left to play in room: ' + roomId);
		} else {
			playTrack(roomId, track);
		}
	});
}

function resetForNewTrack(roomId) {
	var clients = io.sockets.clients(roomId);
	for (var i in clients) {
		clients[i].set('skip', false);
	}
}

function checkIfShouldSkip(roomId) {
	var clients = io.sockets.clients(roomId);
	var skips = 0;
	for (var i in clients) {
		if (clients[i].store.data['skip']) {
			skips = skips + 1;
		}
	}
	if (skips * 1.0 / clients.length > percentToSkip) {
		playNext(roomId);
	}
}

function connectSocket(socket) {
	
	socket.on('join', function(roomId) {
		dbaccess.getRoom(roomId, function(err, room) {
			if (err) {
				socket.emit('error', err.message);
			} else if (room === null) {
				socket.emit('error', 'room not found: ' + roomId);
			} else {
				socket.join(roomId);
				socket.set('roomId', roomId);
				console.log('clients in room (' + roomId + '): ' + io.sockets.clients(roomId).length);
				socket.emit('room', room);
				if (isPlaying(roomId)) {
					start = Math.max(0, process.hrtime(roomStartTimes[roomId])[0] - trackWaitTime);
					socket.emit('play', { track: room.playlist[0], start: start });
				}
			}		
		});
	});

	socket.on('newTrack', function(data) {
		var host = 'youtube';
		var roomId = data.roomId;
		var trackEid = data.trackEid;
		
		var wasPlaying = isPlaying(roomId);
		
		dbaccess.addExternalTrackToPlaylist(host, trackEid, roomId, function(err, track) {
			if (err) {
				socket.emit('error', err.message);
			} else {
				app.io.sockets.in(roomId).emit('track', track);
				if (!wasPlaying) {
					startPlaying(roomId);
				}
			}
		});
	});
	
	socket.on('vote', function(data) {
		var roomId = data.roomId;
		var trackId = data.trackId;
		var val = data.val;
		if (val === 'up') {
			var rate = 1;
		} else if (val === 'down') {
			var rate = -1;
		}
	
		dbaccess.addToTrackRating(roomId, trackId, rate, function(err, track) {
			if (err) {
				socket.emit('error', err.message);
			} else {	
				app.io.sockets.in(roomId).emit('trackUpdate', track);
			}
		});
	});
	
	socket.on('skip', function(roomId) {
		if (isPlaying(roomId)) {
			socket.set('skip', true);
			checkIfShouldSkip(roomId);
		}
	});
	
	socket.on('disconnect', function() {
		var roomId = socket.store.data['roomId'];
		socket.leave(roomId);
		console.log('clients in room (' + roomId + '): ' + io.sockets.clients(roomId).length);
		if (isPlaying(roomId)) {
			checkIfShouldSkip(roomId);
		}
	});
	
}

exports.connectSocket = connectSocket;