REST API
========

GET
---

**/**  
- Reroutes to /playlists/0

**/playlists/{playlist_id}**  
- Loads an html page with an audio player to stream the given playlist.

**/playlists/{playlist_id}/tracks/current**  
- Retrieves the metadata of the track currently playing in the given playlist.  
    - Has the form:  
    
        ```{
            id: *tract id*,
            name: *track name*,
            artist: *artist name*,
            length: *length in seconds*,
            pos: *current position in track*
        }
        ```
        
**/playlists/{playlist_id}/tracks**  
- Retrieves the metadata of the tracks in the given playlist.  
    - Has the form:  
    
        ```{  
            id : *playlist id*,  
            name: *playlist name*,  
            length: *length of playlist*,  
            pos: *current position in playlist*  
            tracks: [  
                {  
                    id: *track id*,  
                    name: *track name*,  
                    artist: *artist name*,  
                    length: *length in seconds*,  
                    order: *place in the playlist*  
                },  
                    ...  
            ]  
        }  
        ```

POST
----

**/playlists/{playlist_id}/tracks?id={track_id}**  
- Adds track at the given id to the given playlist, or upvotes it if already present.  
- Retrieves the metadata of the newly added track.  
    - Has the form:  
    
        {  
            id: *tract id*,  
            name: *track name*,  
            artist: *artist name*,  
            length: *length in seconds*,  
            order: *place in the playlist*  
        }  
    
**/playlists/{playlist_id}/tracks?url={track_url}**  
- Adds track at the given url to the given playlist, or upvotes it if already present.  
- Retrieves the metadata of the newly added track.  
    - Has the form:  
    
        {  
            id: *tract id*,  
            name: *track name*,  
            artist: *artist name*,  
            length: *length in seconds*,  
            order: *place in the playlist*  
        }  

**/playlists/{playlist_id}/tracks?host={host_name}&eid={external_id}**  
- Adds track with the external id hosted at the given host name to the given playlist, or upvotes it if already present.  
- Retrieves the metadata of the newly added track.  
    - Has the form:  
    
        {  
            id: *tract id*,  
            name: *track name*,  
            artist: *artist name*,  
            length: *length in seconds*,  
            order: *place in the playlist*  
        } 

PUT
---

**/playlists/{playlist_id}/tracks/up?track_id={track_id}**  
- Upvotes the track with the given id at the given playlist.  
- Retrieves the metadata of the tracks in the given playlist.  
    - Has the form:  
    
        {  
            id : *playlist id*,  
            name: *playlist name*,  
            length: *length of playlist*,  
            pos: *current position in playlist*  
            tracks: [  
                {  
                    id: *track id*,  
                    name: *track name*,  
                    artist: *artist name*,  
                    length: *length in seconds*,  
                    order: *place in the playlist*  
                },  
                    ...  
            ]  
        }  
    
**/playlists/{playlist_id}/tracts/down?track_id={track_id}**  
- Downvotes the tract with the given id at the given playlist.  
- Retrieves the metadata of the tracks in the given playlist.  
    - Has the form:  
    
        {  
            id : *playlist id*,  
            name: *playlist name*,  
            length: *length of playlist*,  
            pos: *current position in playlist*  
            tracks: [  
                {  
                    id: *track id*,  
                    name: *track name*,  
                    artist: *artist name*,  
                    length: *length in seconds*,  
                    order: *place in the playlist*  
                },  
                    ...  
            ]  
        }  