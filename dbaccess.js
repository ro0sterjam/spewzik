var url = require('url');
var querystring = require('querystring');
var xml2js = require('xml2js');
var youtubedl = require('youtube-dl');
var request = require('request');
var monk = require('monk');
var mongodb = require('mongodb');

var MAX_TRACK_LENGTH = 15 * 60;

// Check if mongodb url is defined, if not use localhost
if (typeof(process.env.MONGOHQ_URL) == 'undefined') {
	process.env.MONGOHQ_URL = 'localhost:27017/spewzik';
}
var db = monk(process.env.MONGOHQ_URL + '?auto_reconnect');

db.get('rooms').ensureIndex({ name: 1 }, { unique: true });
db.get('tracks').ensureIndex({ host: 1, eid: 1 }, { unique: true });

/**
 * Creates a new room in the DB with the given name and returns it.
 *
 * @param name Name of room to create
 * @param callback Callback with params (err, room)
 */
function createRoom(name, callback) {
	var room = {
		name: name,
		tracks: [],
		playlist: [],
		history: []
	}
	db.get('rooms').insert(room, callback);
}

/**
 * Parses the URL to retrieve the hostname and external ID.
 * Currently only supports YouTube, and sets the host as 'youtube' in that case.
 * 
 * @param urlStr URL of the media path
 * @param callback Callback with params (err, host, eid)
 */
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

/**
 * Adds the track at the given URL to the DB.
 * 
 * @param urlStr URL of the media path
 * @param callback Callback with params (err, track)
 */
function addTrackToTracksByUrl(urlStr, callback) {
	parseUrl(urlStr, function(err, host, eid) {
		if (err) {
			callback(err);
		} else {
			addTrackToTracks(host, eid, callback);
		}
	});
}

/**
 * Adds the track at the given host with the given external ID to the DB.
 * 
 * @param host Host of the media path
 * @param eid External ID of the media path
 * @param callback Callback with params (err, track)
 */
function addTrackToTracks(host, eid, callback) {
	if (host === 'youtube') {
		if (eid.trim().length === 0) {
			callback(new Error('Eid field blank'));
		} else {
			request('https://gdata.youtube.com/feeds/api/videos/' + eid + '?v=2', function(err, res, body) {
				if (err) {
					callback(err);
				} else if (res.statusCode !== 200) {
					callback(new Error('Video not found'));
				} else {
					xml2js.parseString(body, function (err, result) {
						if (err) {
							callback(err);
						} else if (parseInt(result.entry['media:group'][0]['yt:duration'][0]['$'].seconds) > MAX_TRACK_LENGTH) {
							callback(new Error('Max video length allowed: ' + MAX_TRACK_LENGTH + ' seconds'));
						} else {
							var track = {
								name: result.entry.title[0],
								duration: parseInt(result.entry['media:group'][0]['yt:duration'][0]['$'].seconds),
								rating: 0,
								playCount: 0,
								added: Date(),
								host: host,
								eid: eid
							}
							db.get('tracks').insert(track, callback);
						}
					});
				}
			});
		}
	} else {
		callback(new Error('Unsupported host'));
	}
}

/**
 * Adds the given track to the playlist of the given room ID.
 * 
 * @param roomId ID of the room whose playlist to add the track to
 * @param track Track to add to the playlist
 * @param callback Callback with params (err, track)
 */
function addTrackToPlaylist(roomId, track, callback) {
	// Reset track metadata for room
	delete(track.lastPlayed);
	track.rating = 0;
	track.added = new Date();
	track.playCount = 0;
	track.timesSkipped = 0;
	
	// Check that room exists
	getRoom(roomId, function(err, room) {
		if (err) {
			callback(err);
		} else if (room === null) {
			callback(new Error('Room with id ' + roomId + 'does not exist'));
		} else {
			// Add track to tracks list
			db.get('rooms').update(
				{ _id: roomId, 'tracks._id': { $ne: track._id } }, 
				{ $push: { tracks: track } }, 
				function(err, count) {
					if (err) {
						callback(err);
					} else {
						// Add track to playlist
						delete(track.playCount);
						delete(track.timesSkipped);
						db.get('rooms').findAndModify(
							{ _id: roomId, 'playlist._id': { $ne: track._id } },
							{ $push: { playlist: track } },
							function(err, room) {
								if (err) {
									callback(err);
								} else if (room === null) {
									callback(new Error('Track already in playlist'));
								} else {
									callback(null, track);
								}
							}
						);
					}
				});
		}
	});
}

/**
 * Pops the top track from the playlist of the given room to the history stack.
 * 
 * @param roomId ID of the room to play next of
 * @param skipped Whether or not the track was skipped
 * @param callback Callback with the params (err, track)
 */
function playNext(roomId, skipped, callback) {
	db.get('rooms').findAndModify(
		{ _id: roomId, playlist: { $not: { $size: 0 } } },
		{ $pop: { playlist: -1 } },
		{ fields: { playlist: 1 } },
		function(err, room) {
			if (err || room === null) {
				callback(err, null);
			} else {
				var oldTrack = room.playlist[0];
				var nextTrack = room.playlist[1] || null;
				// Add the popped playlist track to top of history
				db.get('rooms').update({ _id: roomId }, { $set: { 'history.-1': oldTrack } }, function(err, count) {
					if (err) {
						callback(err);
					} else if (count === 0) {
						callback(new Error('could not add to history'));
					} else if (skipped) {	
						incTrackSkippedCount(roomId, oldTrack._id, function(err) {
							if (err) {
								callback(err);
							} else {
								callback(null, nextTrack);
							}
						});
					} else {
						incTrackPlayedCount(roomId, oldTrack._id, function(err) {
							if (err) {
								callback(err);
							} else {
								callback(null, nextTrack);
							}
						});
					}
				});
			}
		}
	);
}

/**
 * Marks the given track in the given room as skipped in both room tracks and tracks db.
 *
 * @param roomId ID of the room in which to mark the track as skipped
 * @param trackId ID of the track to mark as skipped
 * @param callback Callback with the params (err)
 */
function incTrackSkippedCount(roomId, trackId, callback) {
	trackId = db.get('tracks').id(trackId);
	db.get('rooms').update(
		{ _id: roomId, 'tracks._id': trackId },
		{ $inc: { 'tracks.$.timesSkipped': 1 } },
		function(err, count) {
			if (err) {
				callback(err);
			} else if (count === 0) {
				callback(new Error('track not in room'));
			} else {
				db.get('tracks').update(
					{ _id: trackId },
					{ $inc: { timesSkipped: 1 } },
					function(err, count) {
						if (err) {
							callback(err);
						} else if (count === 0) {
							callback(new Error('track not in database'));
						} else {
							callback(null);
						}
					}
				);
			}
		}
	);
}

/**
 * Increments the play count of the given track in the given room tracks and tracks db.
 *
 * @param roomId ID of the room in which to increment the track play count
 * @param trackId ID of the track in which to increment the play count
 * @param callback Callback with the params (err)
 */
function incTrackPlayedCount(roomId, trackId, callback) {
	trackId = db.get('tracks').id(trackId);
	db.get('rooms').update(
		{ _id: roomId, 'tracks._id': trackId },
		{ $inc: { 'tracks.$.playCount': 1 } },
		function(err, count) {
			if (err) {
				callback(err);
			} else if (count === 0) {
				callback(new Error('track not in room'));
			} else {
				db.get('tracks').update(
					{ _id: trackId },
					{ $inc: { playCount: 1 } },
					function(err, count) {
						if (err) {
							callback(err);
						} else if (count === 0) {
							callback(new Error('track not in database'));
						} else {
							callback(null);
						}
					}
				);
			}
		}
	);
}

/**
 * Gets all the room from the DB.
 *
 * @param callback Callback with the params (err, rooms)
 */
function getRooms(callback) {
	db.get('rooms').find({}, {}, callback);
}

/**
 * Gets all the room details from the DB.
 *
 * @param callback Callback with the params (err, rooms)
 */
function getRoomsDetails(callback) {
	db.get('rooms').find({}, ['-history', '-tracks'], callback);
}

/**
 * Gets the room with the given room id.
 *
 * @param roomId ID of the room to get
 * @param callback Callback with the params (err, room)
 */
function getRoom(roomId, callback) {
	db.get('rooms').findOne({ _id: roomId }, {}, callback);
}

/**
 * Gets the playlist with the given room id.
 *
 * @param roomId ID of the room whose playlist to get
 * @param callback Callback with the params (err, playlist)
 */
function getPlaylist(roomId, callback) {
	getRoom(roomId, function(err, room) {
		if (err) {
			callback(err);
		} else if (room === null) {
			callback(new Error('room not found'));
		} else {
			callback(null, room.playlist);
		}
	});
}

/**
 * Gets the currently playing track of the given playlist.
 *
 * @param roomId ID of the room whose current track to get
 * @param callback Callback with the params (err, track)
 */
function getCurrentTrack(roomId, callback) {
	getPlaylist(roomId, function(err, playlist) {
		if (err) {
			callback(err);
		} else if (playlist === null) {
			callback(new Error('Room with id ' + roomId + ' does not exist'));
		} else {
			callback(null, playlist[0] || null);
		}
	});
}

/**
 * Gets the track with the given ID from the DB.
 * 
 * @param id ID of the track to get
 * @param callback Callback with the params (err, track)
 */
function getTrack(id, callback) {
	db.get('tracks').findOne({ _id: id }, {}, callback);
}

/**
 * Gets the track with the given host and eid from the DB.
 * 
 * @param host Host name of the media
 * @param eid External ID of the media
 * @param callback Callback with the params (err, track)
 */
function findTrack(host, eid, callback) {
	db.get('tracks').findOne({ 'host': host, 'eid': eid }, {}, callback);
}

/**
 * Gets the track with the given url from the DB.
 * 
 * @param urlStr URL of the media path
 * @param callback Callback with the params (err, track)
 */
function findTrackByUrl(urlStr, callback) {
	parseUrl(urlStr, function(err, host, eid) {
		if (err) {
			callback(err);
		} else {
			findTrack(host, eid, callback);
		}
	});
}

/**
 * Adds the given rate to the rating of the given track in the db.
 *
 * @param trackId ID of the track
 * @param rate Rate to add to the track
 * @param callback Callback with the params (err, track)
 */
function addToTrackRatingInDatabase(trackId, rate, callback) {
	db.get('tracks').findAndModify(
		{ _id: trackId },
		{ $inc: { rating: rate } }, 
		{ new: 1 },
		function(err, track) {
			if (err) {
				callback(err);
			} else if (track === null) {
				callback(new Error('track not found in database'));
			} else {
				callback(null, track);
			}
		}
	);
}

/**
 * Adds the given rate to the rating of the given track in the playlist of the given room.
 * Returns the track of the room.
 *
 * @param roomId ID of the room
 * @param trackId ID of the track
 * @param rate Rate to add to the track
 * @param callback Callback with the params (err, track)
 */
function addToTrackRatingInRoom(roomId, trackId, rate, callback) {
	trackId = db.get('tracks').id(trackId);
	db.get('rooms').findAndModify(
		{ _id: roomId, 'tracks._id': trackId },
		{ $inc: { 'tracks.$.rating': rate } },
		{ new: 1, fields: { tracks: { $elemMatch: { '_id': trackId } } } },
		function(err, room) {
			if (err) {
				callback(err);
			} else if (room === null) {
				callback(new Error('track in room or room not found'));
			} else {
				callback(null, room.tracks[0]);
			}
		}
	);
}

/**
 * Adds the given rate to the rating of the given track in the playlist of the given room.
 * Returns the track of the playlist.
 *
 * @param roomId ID of the room
 * @param trackId ID of the track
 * @param rate Rate to add to the track
 * @param callback Callback with the params (err, track)
 */
function addToTrackRatingInPlaylist(roomId, trackId, rate, callback) {
	trackId = db.get('tracks').id(trackId);
	db.get('rooms').findAndModify(
		{ _id: roomId, 'playlist._id': trackId },
		{ $inc: { 'playlist.$.rating': rate } },
		{ new: 1, fields: { playlist: { $elemMatch: { '_id': trackId } } } },
		function(err, room) {
			if (err) {
				callback(err);
			} else if (room === null) {
				callback(new Error('track in playlist or room not found'));
			} else {
				callback(null, room.playlist[0]);
			}
		}
	);
}

/**
 * Adds the given rate to the rating of the given track in the playlist and tracks of the given room.
 * As well as the rating in the tracks db.
 * Returns the track of the playlist.
 *
 * @param roomId ID of the room
 * @param trackId ID of the track
 * @param rate Rate to add to the track
 * @param callback Callback with the params (err, track)
 */
function addToTrackRating(roomId, trackId, rate, callback) {
	addToTrackRatingInDatabase(trackId, rate, function(err, track) {
		if (err) {
			callback(err);
		} else {
			addToTrackRatingInRoom(roomId, trackId, rate, function(err, track) {
				if (err) {
					callback(err);
				} else {
					addToTrackRatingInPlaylist(roomId, trackId, rate, callback);
				}
			})
		}
	});
}

/**
 * Adds the given track to the db if doesn't exist and to the given playlist.
 *
 * @param host Host of the media path
 * @param eid External ID of the media path
 * @param roomId Room ID of the playlist to add track to
 * @param callback Callback with the params (err, track)
 */
function addExternalTrackToPlaylist(host, eid, playlistId, callback) {
	findTrack(host, eid, function(err, track) {
		if (err) {
			callback(err);
		} else if (track === null) {
			addTrackToTracks(host, eid, function(err, track) {
				if (err) {
					callback(err);
				} else if (track === null) {
					callback(new Error('could not add track to db'));
				} else {
					addTrackToPlaylist(playlistId, track, function(err, track) {
						if (err) {
							callback(err);
						} else {
							callback(null, track);
						}
					});
				}
			});
		} else {
			addTrackToPlaylist(playlistId, track, function(err, track) {
				if (err) {
					callback(err);
				} else {
					callback(null, track);
				}
			});
		}
	});
}

exports.getCurrentTrack = getCurrentTrack;
exports.playNext = playNext;
exports.getPlaylist = getPlaylist;
exports.addExternalTrackToPlaylist = addExternalTrackToPlaylist;
exports.addToTrackRating = addToTrackRating;
exports.createRoom = createRoom;
exports.getRoomsDetails = getRoomsDetails;
exports.getRoom = getRoom;