spewzik
=======

Community vote-based radio/jukebox

Purpose
------------
Provide a radio where the music played is not dictated by a single person, but the whole listening community.

High-level Reqs:
------------
**Backend**
- Download and convert to mp3 (or other audio formats) from music providers (youtube, soundcloud, etc.). there is a problem with direct streaming, in cases where a clip can be played in a specific region subscribers from other regions won’t get the stream
- Maintain a queue of songs.
- Vote up/down
- Skip songs after enough down votes (remove from playlist after x number of skips?)
- Multiple ways to queue songs? (chrome extensions, copy paste to web client, ??)

**Frontend**
- UI that allows to browse communities (channels)
- Create community (and password protect to limit access). Useful for work environments
- Connect/stream music from community
- Add song to community
- Vote songs up and down

It's probably a good idea to set up the backend as a separate REST service

Tech Stack:
------------
**Backend**
- NodeJS (Coffeescript)/Express + http://pauldbergeron.com/code/networking/nodejs/coffeescript/streaming-youtube-to-mp3-audio-in-nodejs.html + http://pedromtavares.wordpress.com/2012/12/28/streaming-audio-on-the-web-with-nodejs/
- http://www.jplayer.org/ for client side playback
- MongoDB - (or other NoSQL)

This should take care of it for now

**Frontend**
- Jade
