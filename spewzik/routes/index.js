var monk = require('monk');
var url = require('url');
var querystring = require('querystring');
var xml2js = require('xml2js');
var youtubedl = require('youtube-dl');
var request = require('request');

var db = monk('localhost:27017/spewzik');

downloadTrack = function(host, extId) {
	var dlPath = './tracks';
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

addTrackByUrl = function(url, callback) {
	parseUrl(url, function(err, host, extId) {
		if (err) {
			callback(err);
		} else {
			addTrack(host, extId, callback);
		}
	});
}

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

getTrack = function(id, callback) {
	db.get('tracks').findOne({ _id: id }, {}, callback);
}

findTrackByUrl = function(url, callback) {
	parseUrl(url, function(err, host, extId) {
		if (err) {
			callback(err);
		} else {
			findTrack(host, extId, callback);
		}
	});
}

findTrack = function(host, extId, callback) {
	db.get('tracks').findOne({ 'host': host, 'extId': extId }, {}, callback);
}

getPlaylist = function(id, callback) {
	db.get('playlists').findOne({ _id: id }, { $orderby: { 'tracks.$.rating' : -1 } }, callback);
}

exports.index = function(req, res) {
	res.redirect('/playlists/0/play', 303);
};

exports.addTrackToPlaylist = function(req, res) {
	var playlistId = req.params.playlist_id;
		
	var query = req.query;
	if ('id' in query) {
		getTrack(query.id, function(err, track) {
			if (err) {
				res.send(500, { error: err });
			} else if (track === null) {
				res.send(404, { error: 'track not found' });
			} else {
				addTrackToPlaylist(playlistId, track, function(err) {
					if (err) {
						res.send(500, { error: err });
					} else {
						res.redirect('/playlists/' + playlistId, 303);
					}
				});
			}
		});
	} else if ('url' in query) {
		findTrackByUrl(query.url, function(err, track) {
			if (err) {
				res.send(500, { error: err });
			} else if (track === null) {
				addTrackByUrl(query.url, function(err, track) {
					if (err) {
						res.send(500, { error: err });
					} else {
						addTrackToPlaylist(playlistId, track, function(err) {
							if (err) {
								res.send(500, { error: err });
							} else {
								res.redirect('/playlists/' + playlistId, 303);
							}
						});
					}
				});
			} else {
				addTrackToPlaylist(playlistId, track, function(err) {
					if (err) {
						res.send(500, { error: err });
					} else {
						res.redirect('/playlists/' + playlistId, 303);
					}
				});
			}
		});
	} else if ('host' in query && 'eid' in query) {
		findTrack(query.host, query.eid, function(err, track) {
			if (err) {
				res.send(500, { error: err });
			} else if (track === null) {
				addTrack(query.host, query.eid, function(err, track) {
					if (err) {
						res.send(500, { error: err });
					} else {
						addTrackToPlaylist(playlistId, track, function(err) {
							if (err) {
								res.send(500, { error: err });
							} else {
								res.redirect('/playlists/' + playlistId, 303);
							}
						});
					}
				});
			} else {
				addTrackToPlaylist(playlistId, track, function(err) {
					if (err) {
						res.send(500, { error: err });
					} else {
						res.redirect('/playlists/' + playlistId, 303);
					}
				});
			}
		});
	} else {
		res.send(400, { error: 'malformed query' });
	}
};

exports.getPlaylist = function(req, res) {
	var playlistId = req.params.playlist_id;
	
	getPlaylist(playlistId, function(err, playlist) {
		if (err) {
			res.send(500, { error: err });
		} else if (playlist === null) {
			res.send(404, { error: 'playlist not found' });
		} else {
			playlist.tracks = playlist.tracks.sort(function(a, b) {
				var diff = b.rating - a.rating;
				if (diff === 0) {
					diff = a.added - b.added;
				}
				return diff;
			});
			res.send(200, playlist);
		}
	});
};