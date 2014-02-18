var dbaccess = require('./dbaccess');
var app = require('./app');

var trackWaitTime = 5;
var percentToSkip = 0.8;

var roomStartTimes;
var roomTimers;

function startPlayingAllRooms() {
	roomStartTimes = {};
	roomTimers = {};
	getRoomsDetails(function(err, rooms) {
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
		playNext(roomId, false);
	}, (track.duration + trackWaitTime) * 1000);
}

function playNext(roomId, skipped) {
	if (typeof(roomTimers[roomId]) !== 'undefined') {
		clearTimeout(roomTimers[roomId]);
		delete(roomTimers[roomId]);
	}
	dbaccess.playNext(roomId, skipped, function(err, track) {
		if (err) {
			app.io.sockets.in(roomId).emit('error', err.message);
		} else if (track === null) {
			console.log('nothing left to play in room: ' + roomId);
			app.io.sockets.in(roomId).emit('stop');
		} else {
			playTrack(roomId, track);
		}
	});
}

function resetForNewTrack(roomId) {
	var clients = app.io.sockets.clients(roomId);
	for (var i in clients) {
		clients[i].set('skip', false);
	}
}

function checkIfShouldSkip(roomId) {
	var clients = app.io.sockets.clients(roomId);
	var skips = 0;
	for (var i in clients) {
		if (clients[i].store.data['skip']) {
			skips = skips + 1;
		}
	}
	if (skips * 1.0 / clients.length > percentToSkip) {
		playNext(roomId, true);
	}
}

function emitListenersCount(roomId) {
	app.io.sockets.emit('listeners', { roomId: roomId, listeners: app.io.sockets.clients(roomId).length });
}

function emitPlaylistToClient(socket, roomId) {
	dbaccess.getPlaylist(roomId, function(err, playlist) {
		if (err) {
			socket.emit('error', err.message);
		} else if (playlist === null) {
			socket.emit('error', 'room not found: ' + roomId);
		} else {
			socket.emit('playlist', playlist);
		}		
	});
}

function addTrackToPlaylist(roomId, host, eid, callback) {
	var wasPlaying = isPlaying(roomId);
	
	dbaccess.addExternalTrackToPlaylist(host, eid, roomId, function(err, track) {
		if (err) {
			callback(err);
		} else if (track) {
			app.io.sockets.in(roomId).emit('track', track);
			if (!wasPlaying) {
				startPlaying(roomId);
			}
		}
		callback(null, track);
	});
}

function getCurrentTrack(roomId, callback) {
	dbaccess.getCurrentTrack(roomId, function(err, track) {
		if (err) {
			callback(err);
		} else {
			if (track) {
				track.pos = process.hrtime(roomStartTimes[roomId])[0];
			}
			callback(null, track);
		}
	});
}

function getRoom(roomId, callback) {
	dbaccess.getRoom(roomId, callback);
}

function getRoomsDetails(callback) {
	dbaccess.getRoomsDetails(callback);
}

function connectSocket(socket) {
	
	getRoomsDetails(function(err, rooms) {
		if (err) {
			socket.emit('error', err.message);
		} else if (rooms) {
			for (var i in rooms) {
				rooms[i].listeners = app.io.sockets.clients(rooms[i]._id).length;
			}
			console.log(rooms);
			socket.emit('rooms', rooms);
		}
	});
	
	socket.on('room', function(name) {
		console.log('adding room: ' + name);
		dbaccess.createRoom(name, function(err, room) {
			if (err) {
				socket.emit('error', err.message);
			} else {
				room.listeners = 0;
				app.io.sockets.emit('room', room);
			}
		});
	});
	
	socket.on('join', function(roomId) {
		console.log('joining room: ' + roomId);
		socket.join(roomId);
		socket.set('roomId', roomId);
		console.log('clients in room (' + roomId + '): ' + app.io.sockets.clients(roomId).length);
		emitListenersCount(roomId);
		
		emitPlaylistToClient(socket, roomId);
	});
	
	socket.on('refetch', function(roomId) {
		console.log('refetching room: ' + roomId);
		emitPlaylistToClient(socket, roomId);
	});
	
	socket.on('ready', function(roomId) {
		console.log('ready for room: ' + roomId);
		if (isPlaying(roomId)) {
			getCurrentTrack(roomId, function(err, track) {
				if (err) {
					socket.emit('error', err.message);
				} else if (track === null) {
					socket.emit('error', 'couldn\'t get current track');
				} else {
					socket.emit('play', track);
				}
			});
		}
	});
	
	socket.on('leave', function(roomId) {
		console.log('leaving room: ' + roomId);
		socket.set('roomId', null);
		socket.leave(roomId);
		emitListenersCount(roomId);
		console.log('clients in room (' + roomId + '): ' + app.io.sockets.clients(roomId).length);
		if (isPlaying(roomId)) {
			checkIfShouldSkip(roomId);
		}
	});

	socket.on('track', function(data) {
		console.log('adding track: ' + data);
		var host = 'youtube';
		var roomId = data.roomId;
		var trackEid = data.trackEid;
		addTrackToPlaylist(roomId, host, trackEid, function(err, track) {
			if (err) {
				socket.emit('error', err.message);
			}
		});
	});
	
	socket.on('vote', function(data) {
		console.log('voting for: ' + data);
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
		console.log('skipping in room: ' + roomId);
		if (isPlaying(roomId)) {
			socket.set('skip', true);
			checkIfShouldSkip(roomId);
		}
	});
	
	socket.on('disconnect', function() {
		console.log('disconnecting');
		var roomId = socket.store.data['roomId'];
		if (roomId) {
			socket.leave(roomId);
			emitListenersCount(roomId);
			console.log('clients in room (' + roomId + '): ' + app.io.sockets.clients(roomId).length);
			if (isPlaying(roomId)) {
				checkIfShouldSkip(roomId);
			}
		}
	});
	
}

exports.connectSocket = connectSocket;
exports.startPlayingAllRooms = startPlayingAllRooms;
exports.addTrackToPlaylist = addTrackToPlaylist;
exports.getCurrentTrack = getCurrentTrack;
exports.getRoom = getRoom;
exports.getRoomsDetails = getRoomsDetails;
