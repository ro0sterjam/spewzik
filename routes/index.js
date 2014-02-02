var main = require('../main');

/**
 * Redirects the main page to the play page of the main playlist.
 */
exports.index = function(req, res) {
	main.getPlaylists(function(err, playlists) {
		if (err) {
			res.send(500, { error: err.message });
		} else if (playlists === null) {
			res.render('index', { playlists: [] });
		} else {
			res.render('index', { playlists: playlists });
		}
	});
};

/**
 * Creates a new playlist with the given name
 */
exports.createPlaylist = function(req, res) {
	var query = req.query;
	if ('name' in query) {
		main.createPlaylist(query.name, function(err, playlist) {
			if (err) {
				res.send(500, { error: err.message });
			} else {
				res.send(200, playlist);
			}
		});
	} else {
		res.send(400, { error: 'malformed query' });
	}
}

/**
 * Adds a track to the given playlist either by track ID, url, or host + external ID.
 */
exports.addTrackToPlaylist = function(req, res) {
	var playlistId = req.params.playlist_id;
		
	var query = req.query;
	if ('id' in query) {
		main.getTrack(query.id, function(err, track) {
			if (err) {
				res.send(500, { error: err.message });
			} else if (track === null) {
				res.send(404, { error: 'track not found' });
			} else {
				main.addTrackToPlaylist(playlistId, track, function(err, count) {
					if (err) {
						res.send(500, { error: err.message });
					} else if (count === 0){
						res.send(500, { error: 'couldn\'t add track to playlist' });
					} else {
						res.redirect('/playlists/' + playlistId + '/tracks/' + track._id, 303);
					}
				});
			}
		});
	} else if ('url' in query) {
		main.findTrackByUrl(query.url, function(err, track) {
			if (err) {
				res.send(500, { error: err.message });
			} else if (track === null) {
				main.addTrackByUrl(query.url, function(err, track) {
					if (err) {
						res.send(500, { error: err.message });
					} else if (track === null){
						res.send(500, { error: 'could not add track'});
					} else {
						main.addTrackToPlaylist(playlistId, track, function(err, count) {
							if (err) {
								res.send(500, { error: err.message });
							} else if (count === 0){
								res.send(500, { error: 'couldn\'t add track to playlist' });
							} else {
								res.redirect('/playlists/' + playlistId + '/tracks/' + track._id, 303);
							}
						});
					}
				});
			} else {
				main.addTrackToPlaylist(playlistId, track, function(err, count) {
					if (err) {
						res.send(500, { error: err.message });
					} else if (count === 0){
						res.send(500, { error: 'couldn\'t add track to playlist' });
					} else {
						res.redirect('/playlists/' + playlistId + '/tracks/' + track._id, 303);
					}
				});
			}
		});
	} else if ('host' in query && 'eid' in query) {
		main.findTrack(query.host, query.eid, function(err, track) {
			if (err) {
				res.send(500, { error: err.message });
			} else if (track === null) {
				main.addTrack(query.host, query.eid, function(err, track) {
					if (err) {
						res.send(500, { error: err.message });
					} else if (track === null){
						res.send(500, { error: 'could not add track'});
					} else {
						main.addTrackToPlaylist(playlistId, track, function(err, count) {
							if (err) {
								res.send(500, { error: err.message });
							} else if (count === 0){
								res.send(500, { error: 'couldn\'t add track to playlist' });
							} else {
								res.redirect('/playlists/' + playlistId + '/tracks/' + track._id, 303);
							}
						});
					}
				});
			} else {
				main.addTrackToPlaylist(playlistId, track, function(err, count) {
					if (err) {
						res.send(500, { error: err.message });
					} else if (count === 0){
						res.send(500, { error: 'couldn\'t add track to playlist' });
					} else {
						res.redirect('/playlists/' + playlistId + '/tracks/' + track._id, 303);
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
			res.send(500, { error: err.message });
		} else if (playlist === null) {
			res.send(404, { error: 'playlist not found' });
		} else {
			res.send(200, playlist);
		}
	});
};

/**
 * Serves a list of tracks associated with the given playlist.
 */
exports.getPlaylistTracks = function(req, res) {
	var playlistId = req.params.playlist_id;
	
	main.getPlaylistTracks(playlistId, function(err, tracks) {
		if (err) {
			res.send(500, { error: err.message });
		} else if (tracks === null) {
			res.send(404, { error: 'tracks not found' });
		} else {
			res.send(200, tracks);
		}
	});
}

/**
 * Serves the track with the given ID from the playlist with the given ID.
 */
exports.getPlaylistTrack = function(req, res) {
	var playlistId = req.params.playlist_id;
	var trackId = req.params.track_id;
	
	main.getPlaylistTrack(playlistId, trackId, function(err, track) {
		if (err) {
			res.send(500, { error: err.message });
		} else if (track === null) {
			res.send(404, { error: 'track for playlist not found' });
		} else {
			res.send(200, track);
		}
	});
}

/**
 * Serves the currently playing track.
 */
exports.getCurrentTrack = function(req, res) {
	var playlistId = req.params.playlist_id;
	
	main.getCurrentTrack(playlistId, function(err, track) {
		if (err) {
			res.send(500, { error: err.message });
		} else if (track === null) {
			res.send(404, { error: 'playlist has not tracks' });
		} else {
			res.send(200, tracks);
		}
	});
}

/**
 * Adds the given value to the the rating of the given track of the given playlist.
 */
exports.addToTrackRating = function(i) {
	return function(req, res) {
		// ID is String type, while param is int type
		var playlistId = req.params.playlist_id;
		var trackId = req.params.track_id;
	
		main.addToTrackRating(playlistId, trackId, i, function(err, result) {
			if (err) {
				res.send(500, { error: err.message });
			} else if (result === -1) {
				res.send(404, { error: 'track not found in playlist' });
			} else if (result === -2) {
				res.send(207, { error: 'track found in playlist but not in tracks collection' });
			} else {
				res.redirect('/playlists/' + playlistId + '/tracks/' + trackId, 303);
			}
		});
	};
};

/**
 * Serves the play page for the given playlist
 */
exports.servePlayPage = function(req, res) {
	var playlistId = req.params.playlist_id;
	
	main.getPlaylist(playlistId, function(err, playlist) {
		if (err) {
			res.send(500, { error: err.message });
		} else if (playlist === null) {
			res.send(404, { error: 'playlist not found' });
		} else {
			res.render('play', { playlist: playlist });
		}
	});
}