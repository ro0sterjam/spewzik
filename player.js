var dbaccess = require('./dbaccess');
var app = require('./app');

var NEXT_TRACK_DELAY = 5;
var RATIO_TO_SKIP = 0.6;

(function() {
	var rooms = {};
	
	this.getClientRoom = function(client, callback) {
		var roomId = client.store.data['roomId'];
		if (!roomId) {
			callback(new Error('not in a room'));
		} else {
			getRoom(roomId, callback);
		}
	}
	
	this.createRoom = function(roomId) {
		rooms[roomId] = new Room(roomId);
		return rooms[roomId];
	}
	
	this.getRoom = function(roomId, callback) {
		var room = rooms[roomId];
		if (!room) {
			callback(new Error('room does not exist'));
		} else {
			callback(null, room);
		}
	}
	
	this.getRooms = function() {
		return rooms;
	}
})();

function Room(roomId) {
	if (!(this instanceof arguments.callee)) {
		return new Room(roomId);
	}
	
	var nextTrackTimer = null;
	var trackStartTime = null;
	var currentTrackId = null;
	
	this.getId = function() {
		return roomId;
	}
	
	this.isPlaying = function() {
		return trackStartTime !== null;
	}
	
	this.emitToAllInRoom = function(eventName, data) {
		app.io.of('/room').in(roomId).emit(eventName, data);
	}
	
	this.startPlaying = function() {
		var room = this;
		dbaccess.getCurrentTrack(roomId, function(err, track) {
			if (err) {
				room.emitToAllInRoom('error', err.message);
			} else if (track === null) {
				console.log('playing in room ' + roomId + ': NOTHING');
			} else {
				room.playTrack(track);
			}
		});
	}
	
	this.playTrack = function(track) {
		console.log('playing in room ' + roomId + ': ' + track.name);
		track.pos = 0;
		this.emitToAllInRoom('play', track);
		currentTrackId = track._id;
		
		trackStartTime = process.hrtime();
		var room = this;
		nextTrackTimer = setTimeout(function() {
			trackStartTime = null;
			nextTrackTimer = null;
			room.playNext(false);
		}, (track.duration + NEXT_TRACK_DELAY) * 1000);
	}
	
	this.playNext = function(skipped) {
		if (nextTrackTimer !== null) {
			clearTimeout(nextTrackTimer);
			nextTrackTimer = null;
			trackStartTime = null;
			this.resetForNewTrack(currentTrackId);
			currentTrackId = null;
		}
		var room = this;
		dbaccess.playNext(roomId, skipped, function(err, track) {
			if (err) {
				room.emitToAllInRoom('error', err.message);
			} else if (track === null) {
				console.log('nothing left to play in room ' + roomId);
				room.emitToAllInRoom('stop');
			} else {
				room.playTrack(track);
			}
		});
	}
	
	this.getListeners = function() {
		return app.io.of('/room').clients(roomId);
	}
	
	this.resetForNewTrack = function(oldTrackId) {
		var listeners = this.getListeners();
		for (var i in listeners) {
			listeners[i].set('skip', false);
			var votes = listeners[i].store.data['votes'];
			delete(votes[oldTrackId]);
			listeners[i].set('votes', votes);
		}
	}
	
	this.getSkipCount = function() {
		var listeners = this.getListeners();
		var skipCount = 0;
		for (var i in listeners) {
			if (listeners[i].store.data['skip']) {
				skipCount++;
			}
		}
		return skipCount;
	}
	
	this.shouldSkip = function() {
		return (this.getSkipCount() * 1.0 / this.getListeners().length >= RATIO_TO_SKIP);
	}
	
	this.onSkip = function() {
		if (this.shouldSkip()) {
			this.playNext(true);
		} else {
			this.emitToAllInRoom('skipCount', this.getSkipCount());
		}
	}
	
	this.emitListenerCount = function() {
		var listenerCount = this.getListeners().length;
		app.io.of('/front').emit('listenerCount', roomId, listenerCount);
		this.emitToAllInRoom('listenerCount', listenerCount);
	}
	
	this.addTrackToQueue = function(host, eid, callback) {
		var wasPlaying = this.isPlaying();
		var room = this;
		dbaccess.addExternalTrackToPlaylist(host, eid, roomId, function(err, track) {
			if (err) {
				callback(err);
				return;
			} else if (track) {
				room.emitToAllInRoom('track', track);
				if (!wasPlaying) {
					room.startPlaying();
				}
			}
			callback(null, track);
		});
	}
	
	this.getCurrentlyPlaying = function(callback) {
		dbaccess.getCurrentTrack(roomId, function(err, track) {
			if (err) {
				callback(err);
			} else {
				if (track) {
					track.pos = process.hrtime(trackStartTime)[0];
				}
				callback(null, track);
			}
		});
	}
	
	this.getRoomData = function(callback) {
		var room = this;
		dbaccess.getRoom(roomId, function(err, roomData) {
			if (err) {
				callback(err);
			} else if (roomData === null) {
				callback(new Error('room not found'));
			} else {
				roomData.skipCount = room.getSkipCount();
				roomData.listenerCount = room.getListeners().length;
				callback(null, roomData);
			}
		});
	}
	
	this.emitRoomToClient = function(client) {
		this.getRoomData(function(err, room) {
			if (err) {
				client.emit('error', err.message);
			} else {
				client.emit('room', room);
			}
		});
	}
}

exports.startPlayingAllRooms = function() {
	dbaccess.getRoomsDetails(function(err, rooms) {
		for (var i in rooms) {
			var room = createRoom(rooms[i]._id)
			room.startPlaying();
		}
	});
};

exports.addTrackToPlaylist = function(roomId, host, eid, callback) {
	getRoom(roomId, function(err, room) {
		if (err) {
			callback(err);
		} else {
			room.addTrackToQueue(host, eid, callback);
		}
	});
}

exports.getCurrentlyPlaying = function(roomId, callback) {
	getRoom(roomId, function(err, room) {
		if (err) {
			callback(err);
		} else {
			room.getCurrentlyPlaying(callback);
		}
	});
}

exports.connectIndex = function(client) {
	dbaccess.getRoomsDetails(function(err, rooms) {
		if (err) {
			client.emit('error', err.message);
		} else if (rooms) {
			for (var i in rooms) {
				rooms[i].listenerCount = getRooms()[rooms[i]._id].getListeners().length;
			}
			client.emit('rooms', rooms);
		}
	});
	
	client.on('room', function(name) {
		dbaccess.createRoom(name, function(err, room) {
			if (err) {
				client.emit('error', err.message);
			} else {
				createRoom(room._id);
				room.listenerCount = 0;
				app.io.of('/front').emit('room', room);
			}
		});
	});
}

exports.connectRoom = function(client) {
	
	client.on('join', function(roomId) {
		getRoom(roomId, function(err, room) {
			if (err) {
				client.emit('error', err.message);
			} else {
				client.join(roomId);
				client.set('roomId', roomId);
				room.emitRoomToClient(client);
				room.emitListenerCount();
			}
		});
	});
	
	client.on('refresh', function() {
		getClientRoom(client, function(err, room) {
			if (err) {
				client.emit('error', err.message);
			} else {
				room.emitRoomToClient(client);
			}
		});
	});
	
	client.on('ready', function() {
		getClientRoom(client, function(err, room) {
			if (err) {
				client.emit('error', err.message);
			} else if (room.isPlaying()) {
				room.getCurrentlyPlaying(function(err, track) {
					if (err) {
						client.emit('error', err.message);
					} else if (track === null) {
						client.emit('error', 'couldn\'t get current track');
					} else {
						client.emit('play', track);
					}
				});
			}
		});
	});

	client.on('track', function(track) {
		getClientRoom(client, function(err, room) {
			if (err) {
				client.emit('error', err.message);
			} else {
				room.addTrackToQueue(track.host, track.eid, function(err, track) {
					if (err) {
						client.emit('error', err.message);
					} else if (!track) {
						client.emit('error', 'track already in playlist');
					}
				});
			}
		});
	});
	
	client.on('vote', function(trackId, val) {
		// only allow to vote once per track
		var votes = client.store.data['votes'];
		if (votes && votes[trackId]) {
			return;
		}
		getClientRoom(client, function(err, room) {
			if (err) {
				client.emit('error', err.message);
			} else {
				if (val === 'up') {
					var rate = 1;
				} else if (val === 'down') {
					var rate = -1;
				}

				dbaccess.addToTrackRating(room.getId(), trackId, rate, function(err, track) {
					if (err) {
						client.emit('error', err.message);
					} else {	
						votes = votes || {};
						votes[trackId] = rate;
						client.set('votes', votes);
						room.emitToAllInRoom('trackUpdate', track);
					}
				});
			}
		});
	});
	
	client.on('skip', function() {
		getClientRoom(client, function(err, room) {
			if (err) {
				client.emit('error', err.message);
			} else {
				if (room.isPlaying()) {
					client.set('skip', true);
					room.onSkip();
				}
			}
		});
	});
	
	client.on('disconnect', function() {
		getClientRoom(client, function(err, room) {
			if (err) {
				client.emit('error', err.message);
			} else {
				client.leave(room.getId());
				client.set('skip', false);
				room.emitListenerCount();
				if (room.isPlaying()) {
					room.onSkip();
				}
			}
		});
	});
	
}