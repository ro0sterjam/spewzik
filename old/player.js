var dbaccess = require('./dbaccess');
var app = require('./app');
var url = require('url');
var querystring = require('querystring');

var NEXT_TRACK_DELAY = 5;
var RATIO_TO_SKIP = 0.6;
var AUTO_PLAY_RANDOM = true;
var CLIENT_RANDOM_QUEUE_LIMIT = 2;

exports.startPlayingAllRooms = startPlayingAllRooms;
exports.addTrackToPlaylist = addTrackToPlaylist;
exports.getCurrentlyPlaying = getCurrentlyPlaying;
exports.connectIndex = connectIndex;
exports.connectRoom = connectRoom;

Room.rooms = {};
Room.create = function(roomId) {
	return Room.rooms[roomId] = new Room(roomId);
}
Room.get = function(roomId) {
	console.log('getting room for room with id ' + roomId);
	return Room.rooms[roomId] || null;
}

function Client(socket) {
	if (!(this instanceof arguments.callee)) {
		return new Client(socket);
	}
	console.log('creating client with for socket id ' + socket.id);
	
	// public functions
	this.vote = vote;
	this.removeVote = removeVote;
	this.skip = skip;
	this.hasSkipped = hasSkipped;
	this.resetSkipped = resetSkipped;
	this.joinRoom = joinRoom;
	this.leaveRoom = leaveRoom;
	this.getRoom = getRoom;
	this.queueRandom = queueRandom;
	this.getRandomQueueCount = getRandomQueueCount;
	this.resetRandomQueueCount = resetRandomQueueCount;
	
	var roomId = null;
	var skipped = false;
	var randomQueueCount = 0;
	var votes = {};
	
	function vote(trackId, rating) {
		console.log('socket ' + socket.id + ' voting for track with id ' + trackId);
		var old = votes[trackId] || 0;
		votes[trackId] = rating * (rating != votes[trackId]);
		socket.emit('vote', trackId, votes[trackId]);
		return votes[trackId] - old;
	}
	
	function hasSkipped() {
		return skipped;
	}
	
	function skip() {
		console.log('socket ' + socket.id + ' skipped track');
		skipped = true;
	}
	
	function queueRandom() {
		console.log('socket ' + socket.id + ' chose random track');
		randomQueueCount = randomQueueCount + 1;
	}
	
	function getRandomQueueCount() {
		return randomQueueCount;
	}
	
	function removeVote(trackId) {
		delete votes[trackId];
	}
	
	function resetSkipped() {
		skipped = false;
	}
	
	function resetRandomQueueCount() {
		randomQueueCount = 0;
	}
	
	function joinRoom(newRoomId) {
		if (!!roomId) {
			leaveRoom();
		}
		console.log('socket ' + socket.id + ' joining room ' + newRoomId);
		socket.join(newRoomId);
		roomId = newRoomId;
	}
	
	function leaveRoom() {
		if (roomId) {
			console.log('socket ' + socket.id + ' leaving room ' + roomId);
			socket.leave(roomId);
			roomId = null;
		}
	}
	
	function getRoom() {
		return Room.get(roomId) || null;
	}
}

function Room(roomId) {
	if (!(this instanceof arguments.callee)) {
		return new Room(roomId);
	}
	
	// public variables
	this.roomId = roomId;
	
	// public functions
	this.getRoomData = getRoomData;
	this.addTrackToQueue = addTrackToQueue;
	this.getCurrentlyPlaying = getCurrentlyPlaying;
	this.getListeners = getListeners;
	this.emitListenerCount = emitListenerCount;
	this.startPlaying = startPlaying;
	this.emitToAllInRoom = emitToAllInRoom;
	this.isPlaying = isPlaying;
	this.onSkip = onSkip;
	this.addRandomTrackToPlaylist = addRandomTrackToPlaylist;
	
	var nextTrackTimer = null;
	var trackStartTime = null;
	var currentTrackId = null;
	
	function isPlaying() {
		return trackStartTime !== null;
	}
	
	function emitToAllInRoom(eventName, data) {
		app.io.of('/room').in(roomId).emit(eventName, data);
	}
	
	function startPlaying() {
		dbaccess.getCurrentTrack(roomId, function(err, track) {
			if (err) {
				emitToAllInRoom('error', err.message);
			} else if (track === null) {
				if (AUTO_PLAY_RANDOM) {
					console.log('playing random track in ' + roomId);
					addRandomTrackToPlaylist(function(err, track) {
						if (err) {
							console.log('Random track playing error ' + err.message);
						} else if (track === null) {
							console.log('No tracks to randomly choose from');
						}
					});
				} else {
					console.log('playing in room ' + roomId + ': NOTHING');
				}
			} else {
				playTrack(track);
			}
		});
	}
	
	function playTrack(track) {
		console.log('playing in room ' + roomId + ': ' + track.name);
		track.pos = 0;
		emitToAllInRoom('play', track);
		app.io.of('/front').emit('newTrack', roomId, track);
		
		currentTrackId = track._id;
		trackStartTime = process.hrtime();
		var nextTrackTime = (track.duration + NEXT_TRACK_DELAY) * 1000;
		nextTrackTimer = setTimeout(function() {
			trackStartTime = null;
			nextTrackTimer = null;
			currentTrackId = null;
			playNext(false);
		}, nextTrackTime);
		console.log('next track in room ' + roomId + ' will play in ' + nextTrackTime + 'ms');
	}
	
	function playNext(skipped) {
		resetForNewTrack();
		if (nextTrackTimer !== null) {
			clearTimeout(nextTrackTimer);
			nextTrackTimer = null;
			trackStartTime = null;
			currentTrackId = null;
		}
		dbaccess.playNext(roomId, skipped, function(err, track) {
			if (err) {
				emitToAllInRoom('error', err.message);
			} else if (track === null) {
				if (AUTO_PLAY_RANDOM) {
					console.log('playing random track in ' + roomId);
					addRandomTrackToPlaylist(function(err, track) {
						if (err) {
							console.log('Random track playing error ' + err.message);
						} else if (track === null) {
							console.log('No tracks to randomly choose from');
							emitToAllInRoom('stop');
							app.io.of('/front').emit('newTrack', roomId, null);
						}
					});
				} else {
					console.log('nothing left to play in room ' + roomId);
					emitToAllInRoom('stop');
					app.io.of('/front').emit('newTrack', roomId, null);
				}
			} else {
				playTrack(track);
			}
		});
	}
	
	function getListeners() {
		return app.io.of('/room').clients(roomId).map(function(client) {
			return client.store.data['client'];
		});
	}
	
	function resetForNewTrack() {
		console.log('resetting client data in room ' + roomId);
		getListeners().forEach(function(listener) {
			listener.removeVote(currentTrackId);
			listener.resetSkipped();
			listener.resetRandomQueueCount();
		});
	}
	
	function getSkipCount() {
		return getListeners().map(function(listener) {
			return listener.hasSkipped();
		}).concat([0]).reduce(function(a, b) {
			return a + b;
		});
	}
	
	function onSkip() {
		if (getSkipCount() * 1.0 / getListeners().length >= RATIO_TO_SKIP) {
			console.log('skipping track in room ' + roomId);
			playNext(true);
		} else {
			console.log('sending skip count to clients in room ' + roomId);
			emitToAllInRoom('skipCount', getSkipCount());
		}
	}
	
	function emitListenerCount() {
		var listenerCount = getListeners().length;
		app.io.of('/front').emit('listenerCount', roomId, listenerCount);
		console.log('sending listener count to clients in room ' + roomId);
		emitToAllInRoom('listenerCount', listenerCount);
	}
	
	function addTrackToQueue(host, eid, addedBy, callback) {
		console.log('adding track { host: ' + host + ', eid: ' + eid + ' }' + ' to room ' + roomId);
		dbaccess.addExternalTrackToPlaylist(host, eid, roomId, function(err, track) {
			if (err) {
				callback(err);
			} else {
				track.addedBy = addedBy;
				emitToAllInRoom('track', track);
				if (!isPlaying()) {
					startPlaying();
				}
				callback(null, track);
			}
		});
	}
	
	function getCurrentlyPlaying(callback) {
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
	
	function getRoomData(callback) {
		dbaccess.getRoom(roomId, function(err, roomData) {
			if (err) {
				callback(err);
			} else if (roomData === null) {
				callback(new Error('Room not found'));
			} else {
				roomData.skipCount = getSkipCount();
				roomData.listenerCount = getListeners().length;
				callback(null, roomData);
			}
		});
	}
	
	function getRandomTrack(callback) {
		dbaccess.getRandomWeightedTrack(roomId, function(err, track) {
			if (err) {
				callback(err);
			} else {
				callback(null, track);
			}
		});
	}
	
	function addRandomTrackToPlaylist(callback) {
		getRandomTrack(function(err, track) {
			if (err) {
				callback(err);
			} else if (track === null) {
				callback(null, track);
			} else {
				dbaccess.addTrackToPlaylist(roomId, track, function(err, track) {
					if (err) {
						callback(err);
					} else {
						track.addedBy = 'Random play';
						emitToAllInRoom('track', track);
						if (!isPlaying()) {
							startPlaying();
						}
						callback(null, track);
					}
				});
			}
		});
	}
}

function parseUrl(urlStr, callback) {
	var urlObj = url.parse(urlStr);
	if (urlObj.host === null) {
		callback(new Error('host not found, please include protocol in url'));
	} else if (urlObj.host.match('youtube')) {
		var queryObj = querystring.parse(urlObj.query);
		if (queryObj.v === null) {
			callback(new Error('youtube query invalid, requires \'v\' field'));
		} else {
			callback(null, 'youtube', queryObj.v);
		}
	} else {
		callback(new Error('unsupported host'), null, null);
	}
}

function emitRoomDataToSocket(room, socket) {
	console.log('sending room ' + room._id + ' to client ' + socket.id);
	room.getRoomData(function(err, roomData) {
		if (err) {
			socket.emit('error', err.message);
		} else {
			socket.emit('room', roomData);
		}
	});
}

function startPlayingAllRooms() {
	console.log('commencing play in all rooms');
	dbaccess.getRoomsDetails(function(err, rooms) {
		rooms.forEach(function(roomData) {
			Room.create(roomData._id).startPlaying();
		});
	});
}

function addTrackToPlaylist(roomId, host, eid, callback) {
	var room = Room.get(roomId);
	if (room === null) {
		callback(new Error('Room with id ' + roomId + ' does not exist'));
	} else {
		room.addTrackToQueue(host, eid, null, callback);
	}
}

function getCurrentlyPlaying(roomId, callback) {
	var room = Room.get(roomId);
	if (room === null) {
		callback(new Error('Room with id ' + roomId + ' does not exist'));
	} else {
		room.getCurrentlyPlaying(callback);
	}
}

function connectIndex(socket) {
	dbaccess.getRoomsDetails(function(err, rooms) {
		if (err) {
			socket.emit('error', err.message);
		} else if (rooms) {
			for (var i in rooms) {
				rooms[i].listenerCount = Room.get(rooms[i]._id).getListeners().length;
			}
			socket.emit('rooms', rooms);
		}
	});
	
	socket.on('room', function(name) {
		dbaccess.createRoom(name, function(err, room) {
			if (err) {
				socket.emit('error', err.message);
			} else {
				Room.create(room._id);
				room.listenerCount = 0;
				app.io.of('/front').emit('room', room);
			}
		});
	});
}

function connectRoom(socket) {
	
	var client = new Client(socket);
	socket.set('client', client);
	
	socket.on('join', function(roomId) {
		var room = Room.get(roomId);
		if (!room) {
			socket.emit('error', 'Room ' + roomId + ' does not exist');
		} else {
			client.joinRoom(roomId);
			
			emitRoomDataToSocket(room, socket);
			room.emitListenerCount();
		}
	});
	
	socket.on('refresh', function() {
		var room = client.getRoom();
		if (!room) {
			socket.emit('error', 'User not in room');
		} else {
			emitRoomDataToSocket(room, socket);
		}
	});
	
	socket.on('ready', function() {
		var room = client.getRoom();
		if (!room) {
			socket.emit('error', 'User not in room');
		} else {
			room.getCurrentlyPlaying(function(err, track) {
				if (err) {
					socket.emit('error', err.message);
				} else if (!!track) {
					socket.emit('play', track);
				}
			});
		}
	});
	
	socket.on('resync', function() {
		var room = client.getRoom();
		if (!room) {
			socket.emit('error', 'User not in room');
		} else {
			room.getCurrentlyPlaying(function(err, track) {
				if (err) {
					socket.emit('error', err.message);
				} else if (!!track) {
					socket.emit('resync', track.pos);
				}
			});
		}
	});

	socket.on('track', function(track) {
		var room = client.getRoom();
		if (!room) {
			socket.emit('error', 'User not in room');
		} else {
			if (track.url) {
				parseUrl(track.url, function(err, host, eid) {
					if (err) {
						socket.emit('error', err.message);
					} else {
						room.addTrackToQueue(host, eid, track.nickname, function(err, track) {
							if (err) {
								socket.emit('error', err.message);
							}
						});
					}
				});
			} else {
				room.addTrackToQueue(track.host, track.eid, track.nickname, function(err, track) {
					if (err) {
						socket.emit('error', err.message);
					}
				});
			}
		}
	});
	
	socket.on('vote', function(trackId, rate) {
		if (rate === 0 || typeof(rate) !== 'number') {
			socket.emit('error', 'Invalid rating');
		} else {
			var room = client.getRoom();
			if (!room) {
				socket.emit('error', 'User not in room');
			} else {
				rate = rate / Math.abs(rate);
				dbaccess.addToTrackRating(room.roomId, trackId, client.vote(trackId, rate), function(err, track) {
					if (err) {
						socket.emit('error', err.message);
					} else {
						room.emitToAllInRoom('trackUpdate', track);
						socket.emit('voted', trackId, rate);
					}
				});
			}
		}
	});
	
	socket.on('skip', function() {
		var room = client.getRoom();
		if (!room) {
			socket.emit('error', 'User not in room');
		} else {
			if (room.isPlaying()) {
				client.skip();
				room.onSkip();
			}
		}
	});
	
	socket.on('random', function() {
		if (client.getRandomQueueCount() >= CLIENT_RANDOM_QUEUE_LIMIT) {
			socket.emit('error', 'Limit ' + CLIENT_RANDOM_QUEUE_LIMIT + ' random queue(s) per track');
		} else {
			var room = client.getRoom()
			if (!room) {
				socket.emit('error', 'User not in room');
			} else {
				room.addRandomTrackToPlaylist(function(err, track) {
					if (err) {
						socket.emit('error', err.message);
					} else if (track === null) {
						socket.emit('error', 'No available tracks to queue');
					} else {
						client.queueRandom();
					}
				});
			}
		}
	});
	
	socket.on('disconnect', function() {
		var room = client.getRoom();
		if (!!room) {
			client.leaveRoom(room.roomId);
			client.resetSkipped();
			client.resetRandomQueueCount();
			room.emitListenerCount();
			if (room.isPlaying()) {
				room.onSkip();
			}
		}
	});
}