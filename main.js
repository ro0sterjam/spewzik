var monk = require('monk');
var url = require('url');
var querystring = require('querystring');
var xml2js = require('xml2js');
var youtubedl = require('youtube-dl');
var request = require('request');

if ('development' == app.get('env')) {
	var db = monk('localhost:27017/spewzik');
} else {	
	var db = monk(process.env.MONGOHQ_URL);
}

var dlPath = './tracks';

/**
 * Downloads the track with the given host and external ID to the folder defined at dlPath.
 */
downloadTrack = function(host, extId) {
	if (host === 'youtube') {
		var dl = youtubedl.download(
			'http://www.youtube.com/watch?v=' + extId, 
			dlPath,
			['--max-quality=18']);

		dl.on('download', function(data) {
			console.log('Download started');
			console.log('filename: ' + data.filename);
			console.log('size: ' + data.size);
		});

		dl.on('progress', function(data) {
			process.stdout.write(data.eta + ' ' + data.percent + '% at ' + data.speed + '\r');
		});

		dl.on('error', function(err) {
			throw err;
		});
		
		dl.on('end', function(data) {
			//bson.BSON.serialize(object, checkKeys, asBuffer, serializeFunctions)
			console.log('\nDownload finished!');
			console.log('ID:', data.id);
			console.log('Filename:', data.filename);
			console.log('Size:', data.size);
			console.log('Time Taken:', data.timeTaken);
			console.log('Time Taken in ms:', + data.timeTakenms);
			console.log('Average Speed:', data.averageSpeed);
			console.log('Average Speed in Bytes:', data.averageSpeedBytes);
		});
	}
}

/**
 * Parses the URL to retrieve the hostname and external ID.
 * Currently only supports YouTube, and sets the host as 'youtube' in that case.
 * 
 * Callback of the form: function(err, host, extId)
 */
parseUrl = function(urlStr, callback) {
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
 * Creates a new playlist in the DB with the given name and returns it.
 * 
 * Callback of form: function(err, playlist)
 */
createPlaylist = function(playlistName, callback) {
	var playlist = { 
		name: playlistName,
		tracks: []
	};
	db.get('playlists').insert(playlist, callback);
}

/**
 * Adds the given track to the playlist document with the given playlistId in the DB.
 * Returns the updated playlist object.
 * 
 * Callback of the form: function(err, count)
 */
addTrackToPlaylist = function(playlistId, track, callback) {
	var playlists = db.get('playlists');
	db.get('playlists').findOne({ _id: playlists.id(playlistId), 'tracks._id': track._id }, {}, function(err, data) {
		if (data === null) {
			track.rating = 0;
			track.added = new Date();
			db.get('playlists').update({ _id: playlists.id(playlistId) }, { $addToSet: { tracks: track } }, { upsert: true }, callback);
		} else {
			db.get('playlists').update({ _id: playlists.id(playlistId), 'tracks._id': track._id }, { $inc: { 'tracks.$.rating': 1 } }, callback);
		}
	});
}

/**
 * Adds the track at the given URL to the DB.
 * Downloads the track using downloadTrack()
 * 
 * Callback of the form: function(err, track)
 */
addTrackByUrl = function(url, callback) {
	parseUrl(url, function(err, host, extId) {
		if (err) {
			callback(err);
		} else {
			addTrack(host, extId, callback);
		}
	});
}

/**
 * Adds the track at the given host with the given external ID to the DB.
 * Downloads the track using downloadTrack()
 * 
 * Callback of the form: function(err, track)
 */
addTrack = function(host, extId, callback) {
	if (host === 'youtube') {
		request('https://gdata.youtube.com/feeds/api/videos/' + extId + '?v=2', function(err, res, body) {
			if (err) {
				callback(err);
			} else if (res.statusCode !== 200) {
				callback(new Error('video not found'));
			} else {
				xml2js.parseString(body, function (err, result) {
					if (err) {
						callback(err);
					} else {
						var track = {
							name: result.entry.title[0],
							duration: parseInt(result.entry['media:group'][0]['yt:duration'][0]['$'].seconds),
							rating: 0,
							playCount: 0,
							host: host,
							extId: extId
						}
						db.get('tracks').insert(track, callback);
						downloadTrack(host, extId);
					}
				});
			}
		});
	} else {
		callback(new Error('unsupported host'));
	}
}

/**
 * Gets the track with the given ID from the DB.
 * 
 * Callback of the form: function(err, track)
 */
getTrack = function(id, callback) {
	var tracks = db.get('tracks');
	db.get('tracks').findOne({ _id: tracks.id(id) }, {}, callback);
}

/**
 * Gets the playlists on the db.
 *
 * Callback of the form: function(err, playlists)
 */
getPlaylists = function(callback) {
	db.get('playlists').find({}, {}, callback);
}

/**
 * Gets the track with the given url from the DB.
 * 
 * Callback of the form: function(err, track)
 */
findTrackByUrl = function(url, callback) {
	parseUrl(url, function(err, host, extId) {
		if (err) {
			callback(err);
		} else {
			findTrack(host, extId, callback);
		}
	});
}

/**
 * Gets the track with the given host and extId from the DB.
 * 
 * Callback of the form: function(err, track)
 */
findTrack = function(host, extId, callback) {
	db.get('tracks').findOne({ 'host': host, 'extId': extId }, {}, callback);
}

/**
 * Gets the playlist with the given ID from the DB.
 * Returns the contained tracks in descending rating and and ascending date.
 * 
 * Callback of the form: function(err, playlist)
 */
getPlaylist = function(id, callback) {
	var playlists = db.get('playlists');
	db.get('playlists').findOne({ _id: playlists.id(id) }, { $orderby: { 'tracks.$.rating' : -1 } }, function(err, playlist) {
		if (err || playlist === null) {
			callback(err, null);
		} else {
			playlist.tracks = playlist.tracks.sort(function(a, b) {
				var diff = b.rating - a.rating;
				if (diff === 0) {
					diff = a.added - b.added;
				}
				return diff;
			});
			callback(null, playlist);
		}
	});
}

/**
 * Gets the tracks belonging to the playlist with the given id from the DB.
 * Returns the contained tracks in descending rating and and ascending date.
 * 
 * Callback of the form: function(err, tracks)
 */
getPlaylistTracks = function(playlistId, callback) {
	getPlaylist(playlistId, function(err, playlist) {
		if (err) {
			callback(err);
		} else if (playlist === null){
			callback(new Error('playlist not found'));
		} else {
			callback(null, playlist.tracks);
		}
	});
}

/**
 * Gets the track with the given ID in the playlist with the given ID.
 * 
 * Callback of the form function(err, track)
 */
getPlaylistTrack = function(playlistId, trackId, callback) {
	var playlists = db.get('playlists');
	playlists.findOne({ _id: playlists.id(playlistId) }, {}, function(err, playlist) {
		if (err) {
			callback(err);
		} else if (playlist === null) {
			callback(new Error('Playlist not found'));
		} else {
			var retTrack = null;
			for (i in playlist.tracks) {
				var track = playlist.tracks[i];
				if (track._id.equals(trackId)) {
					retTrack = track;
				}
			}
			callback(null, retTrack);
		}
	});
}

/**
 * Gets the currently playing track for the given playlist from the DB.
 * Returns the first track in the list.
 *
 * Callback of the form: function(err, track)
 */
getCurrentTrack = function(playlistId, callback) {
	getPlaylistTracks(playlistId, function(err, tracks) {
		if (err) {
			callback(err);
		} else if (tracks === null) {
			callback(new Error('tracks not found'));
		} else {
			callback(tracks[0]);
		}
	});
}

/**
 * Adds the given value to the rating of the track in the tracks collection and as well as
 * to the rating of the track in the playlist in the playlists collection with the given 
 * track ID and playlist ID.
 *
 * The value of count in the callback will be 0 if track failed at updated in playlist, 1 if 
 * track succeeded updating in playlist but not in tracks collection, and 2 if successful in both.
 *
 * Callback of the form: function(err, success)
 */
addToTrackRating = function(playlistId, trackId, i, callback) {
	var tracks = db.get('tracks');
	var playlists = db.get('playlists');
	db.get('playlists').update({ _id: playlists.id(playlistId), 'tracks._id': tracks.id(trackId) }, { $inc: { 'tracks.$.rating': i } }, function(err, count) {
		if (err) {
			callback(err);
		} else if (count === 0) {
			callback(null, -1);
		} else {
			db.get('tracks').update({ _id: tracks.id(trackId) }, { $inc: { rating: i } }, function(err, count) {
				if (err) {
					callback(err);
				} else if (count === 0) {
					callback(null, -2)
				} else {
					callback(null, 0);
				}
			});
		}
	});
}

exports.getPlaylists = getPlaylists;
exports.createPlaylist = createPlaylist;
exports.addTrackToPlaylist = addTrackToPlaylist;
exports.addTrackByUrl = addTrackByUrl;
exports.addTrack = addTrack;
exports.getTrack = getTrack;
exports.findTrackByUrl = findTrackByUrl;
exports.findTrack = findTrack;
exports.getPlaylist = getPlaylist;
exports.getPlaylistTracks = getPlaylistTracks;
exports.getPlaylistTrack = getPlaylistTrack;
exports.getCurrentTrack = getCurrentTrack;
<<<<<<< HEAD
exports.addToTrackRating = addToTrackRating;
=======
exports.addToTrackRating = addToTrackRating;
>>>>>>> 2194643e4680636b929e7a6a11b906473dd36c9c
