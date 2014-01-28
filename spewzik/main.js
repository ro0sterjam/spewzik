var monk = require('monk');
var url = require('url');
var querystring = require('querystring');
var xml2js = require('xml2js');
var youtubedl = require('youtube-dl');
var request = require('request');

var db = monk('localhost:27017/spewzik');
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
		callback('host not found, please include protocol in url');
	} else if (urlObj.host.match('youtube')) {
		var queryObj = querystring.parse(urlObj.query);
		if (queryObj.v === null) {
			callback('youtube query invalid, requires \'v\' field');
		} else {
			callback(null, 'youtube', queryObj.v);
		}
	} else {
		callback('unsupported host', null, null);
	}
}

/**
 * Adds the given track to the playlist document with the given playlistId in the DB.
 * Returns the updated playlist object.
 * 
 * Callback of the form: function(err, playlist)
 */
addTrackToPlaylist = function(playlistId, track, callback) {
	db.get('playlists').findOne({ _id: playlistId, 'tracks._id': track._id }, {}, function(err, data) {
		if (data === null) {
			track.rating = 0;
			track.added = new Date();
			db.get('playlists').update({ _id: playlistId }, { $addToSet: { tracks: track } }, { upsert: true }, callback);
		} else {
			db.get('playlists').update({ _id: playlistId, 'tracks._id': track._id }, { $inc: { 'tracks.$.rating': 1 } }, callback);
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
				callback('video not found');
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
		callback('unsupported host');
	}
}

/**
 * Gets the track with the given ID from the DB.
 * 
 * Callback of the form: function(err, track)
 */
getTrack = function(id, callback) {
	db.get('tracks').findOne({ _id: id }, {}, callback);
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
 * Returns the contained tracks in order from highest to lowest rating and added date.
 * 
 * Callback of the form: function(err, playlist)
 */
getPlaylist = function(id, callback) {
	db.get('playlists').findOne({ _id: id }, { $orderby: { 'tracks.$.rating' : -1 } }, function(err, playlist) {
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

exports.addTrackToPlaylist = addTrackToPlaylist;
exports.addTrackByUrl = addTrackByUrl;
exports.addTrack = addTrack;
exports.getTrack = getTrack;
exports.findTrackByUrl = findTrackByUrl;
exports.findTrack = findTrack;
exports.getPlaylist = getPlaylist;