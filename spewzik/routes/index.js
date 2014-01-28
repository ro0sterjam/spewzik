var main = require('../main');

exports.index = function(req, res) {
	res.redirect('/playlists/0/play', 303);
};

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
				main.addTrackToPlaylist(playlistId, track, function(err) {
					if (err) {
						res.send(500, { error: err });
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
						main.addTrackToPlaylist(playlistId, track, function(err) {
							if (err) {
								res.send(500, { error: err });
							} else {
								res.redirect('/playlists/' + playlistId, 303);
							}
						});
					}
				});
			} else {
				main.addTrackToPlaylist(playlistId, track, function(err) {
					if (err) {
						res.send(500, { error: err });
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
						main.addTrackToPlaylist(playlistId, track, function(err) {
							if (err) {
								res.send(500, { error: err });
							} else {
								res.redirect('/playlists/' + playlistId, 303);
							}
						});
					}
				});
			} else {
				main.addTrackToPlaylist(playlistId, track, function(err) {
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
	
	main.getPlaylist(playlistId, function(err, playlist) {
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