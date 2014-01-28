var main = require('../main');

/**
 * Redirects the main page to the play page of the main playlist.
 */
exports.index = function(req, res) {
	res.redirect('/playlists/0/play', 303);
};

/**
 * Adds a track to the given playlist either by track ID, url, or host + external ID.
 */
exports.addTrackToPlaylist = function(req, res) {
	var playlistId = req.params.playlist_id;
		
	var query = req.query;
	if ('id' in query) {
		main.getTrack(query.id, function(err, track) {
			if (err) {
				res.send(500, { error: err });
			} else if (track === null) {
				res.send(404, { error: 'track not found' });
			} else {
				main.addTrackToPlaylist(playlistId, track, function(err, count) {
					if (err) {
						res.send(500, { error: err });
					} else if (count === 0){
						res.send(500, { error: 'couldn\'t add track to playlist' });
					} else {
						res.redirect('/playlists/' + playlistId, 303);
					}
				});
			}
		});
	} else if ('url' in query) {
		main.findTrackByUrl(query.url, function(err, track) {
			if (err) {
				res.send(500, { error: err });
			} else if (track === null) {
				main.addTrackByUrl(query.url, function(err, track) {
					if (err) {
						res.send(500, { error: err });
					} else {
						main.addTrackToPlaylist(playlistId, track, function(err, count) {
							if (err) {
								res.send(500, { error: err });
							} else if (count === 0){
								res.send(500, { error: 'couldn\'t add track to playlist' });
							} else {
								res.redirect('/playlists/' + playlistId, 303);
							}
						});
					}
				});
			} else {
				main.addTrackToPlaylist(playlistId, track, function(err, count) {
					if (err) {
						res.send(500, { error: err });
					} else if (count === 0){
						res.send(500, { error: 'couldn\'t add track to playlist' });
					} else {
						res.redirect('/playlists/' + playlistId, 303);
					}
				});
			}
		});
	} else if ('host' in query && 'eid' in query) {
		main.findTrack(query.host, query.eid, function(err, track) {
			if (err) {
				res.send(500, { error: err });
			} else if (track === null) {
				main.addTrack(query.host, query.eid, function(err, track) {
					if (err) {
						res.send(500, { error: err });
					} else {
						main.addTrackToPlaylist(playlistId, track, function(err, count) {
							if (err) {
								res.send(500, { error: err });
							} else if (count === 0){
								res.send(500, { error: 'couldn\'t add track to playlist' });
							} else {
								res.redirect('/playlists/' + playlistId, 303);
							}
						});
					}
				});
			} else {
				main.addTrackToPlaylist(playlistId, track, function(err, count) {
					if (err) {
						res.send(500, { error: err });
					} else if (count === 0){
						res.send(500, { error: 'couldn\'t add track to playlist' });
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

/**
 * Serves the playlist with the given ID to the response.
 */
exports.getPlaylist = function(req, res) {
	var playlistId = req.params.playlist_id;
	
	main.getPlaylist(playlistId, function(err, playlist) {
		if (err) {
			res.send(500, { error: err });
		} else if (playlist === null) {
			res.send(404, { error: 'playlist not found' });
		} else {
			res.send(200, playlist);
		}
	});
};

/**
 * Adds the given value to the the rating of the given track of the given playlist.
 */
exports.addTrackRating = function(i) {
	return function(req, res) {
		// ID is String type, while param is int type
		var playlistId = req.params.playlist_id;
		var trackId = req.params.track_id;
	
		main.addTrackRating(playlistId, trackId, i, function(err, count) {
			if (err) {
				res.send(500, { error: err });
			} else if (count === 0) {
				res.send(404, { error: 'track not found in playlist' });
			} else if (count === 1) {
				res.send(207, { error: 'track found in playlist but not in tracks collection' });
			} else {	
				res.redirect('/playlists/' + playlistId, 303);
			}
		});
	};
};