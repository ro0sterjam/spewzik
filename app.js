
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var http = require('http');
var path = require('path');
var monk = require('monk');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
console.log(app.get('env'));
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
  var db = monk('localhost:27017/spewzik');
} else {
  var db = monk(process.env.MONGOHQ_URL);
}

app.get('/', routes.index);
app.get('/playlists/:playlist_id', routes.getPlaylist);
app.get('/playlists/:playlist_id/tracks', routes.getPlaylistTracks);
app.get('/playlists/:playlist_id/tracks/:track_id', routes.getPlaylistTrack);
app.get('/playlists/:playlist_id/current', routes.getCurrentTrack);
app.get('/playlists/:playlist_id/play', routes.servePlayPage);
app.post('/playlists', routes.createPlaylist);
app.post('/playlists/:playlist_id/tracks', routes.addTrackToPlaylist);
app.put('/playlists/:playlist_id/tracks/:track_id/up', routes.addToTrackRating(1));
app.put('/playlists/:playlist_id/tracks/:track_id/down', routes.addToTrackRating(-1));

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

exports.db = db;