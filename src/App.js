import React, { useEffect, useState } from 'react';
import configData from "./config.json";
import './App.css';

const CLIENT_ID = configData.Client_Id;
const REDIRECT_URI = configData.WebAppUrl;
const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const RESPONSE_TYPE = 'code';
const SCOPES = 'user-top-read playlist-modify-public'; // Added permission for playlist creation

function App() {
  const [accessToken, setAccessToken] = useState('');
  const [topTracks, setTopTracks] = useState([]);
  const [songs, setSongs] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState('');
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);

  const handleLogin = () => {
    const authUrl = `${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=${RESPONSE_TYPE}&scope=${SCOPES}`;
    window.location.href = authUrl;
  };

  const getQueryParams = (query) => {
    return query
      .slice(1)
      .split('&')
      .reduce((acc, param) => {
        const [key, value] = param.split('=');
        acc[key] = decodeURIComponent(value);
        return acc;
      }, {});
  };

  const getAccessToken = async (code) => {
    const clientId = CLIENT_ID;
    const clientSecret = configData.Client_Secret;

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: `grant_type=authorization_code&code=${code}&redirect_uri=${REDIRECT_URI}`,
    });

    const data = await response.json();
    if (data.access_token) {
      setAccessToken(data.access_token);
      setIsLoggedIn(true);
    } else {
      console.error('Failed to retrieve access token:', data);
    }
  };

  const fetchUserProfile = async (token) => {
    try {
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setUserId(data.id); // Set the user's Spotify ID
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchTopTracks = async (token) => {
    try {
      const response = await fetch('https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=5', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setTopTracks(data.items);
    } catch (error) {
      console.error('Error fetching top tracks:', error);
    }
  };

  const fetchRecommendations = async (token, tracks) => {
    const seedTracks = tracks.map((track) => track.id).join(',');

    try {
      const response = await fetch(
        `https://api.spotify.com/v1/recommendations?seed_tracks=${seedTracks}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await response.json();
      setSongs(data.tracks);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    }
  };

  const createPlaylist = async (playlistName) => {
    try {
      setIsCreatingPlaylist(true);

      // Create the new playlist
      const response = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: playlistName,
          public: true,
        }),
      });

      const playlistData = await response.json();
      const playlistId = playlistData.id;

      // Add songs to the newly created playlist
      const trackUris = songs.map((song) => song.uri);
      await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uris: trackUris,
        }),
      });

      alert(`Playlist "${playlistName}" created successfully!`);
    } catch (error) {
      console.error('Error creating playlist:', error);
    } finally {
      setIsCreatingPlaylist(false);
    }
  };

  const handleCreatePlaylist = async () => {
    const date = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
    let playlistName = `DDPM - ${date} - 1`;
    let playlistNumber = 1;

    try {
      // Check if a playlist with the same name exists and increment the number if needed
      const response = await fetch('https://api.spotify.com/v1/me/playlists', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await response.json();

      const existingPlaylists = data.items.filter((playlist) =>
        playlist.name.startsWith(`DDPM - ${date}`)
      );

      if (existingPlaylists.length > 0) {
        playlistNumber = existingPlaylists.length + 1;
        playlistName = `DDPM - ${date} - ${playlistNumber}`;
      }

      await createPlaylist(playlistName);
    } catch (error) {
      console.error('Error checking for existing playlists:', error);
    }
  };

  const shuffle = async () => {
    setIsShuffling(true);
    if (topTracks.length > 0 && accessToken) {
      fetchRecommendations(accessToken, topTracks);
    }
    setIsShuffling(false);
  };

  useEffect(() => {
    const params = getQueryParams(window.location.search);
    const code = params.code;

    if (code && !accessToken) {
      getAccessToken(code);
    }
  }, [accessToken]);

  useEffect(() => {
    if (isLoggedIn && accessToken) {
      fetchUserProfile(accessToken); // Fetch user ID
      fetchTopTracks(accessToken); // Fetch top tracks
    }
  }, [isLoggedIn, accessToken]);

  useEffect(() => {
    if (topTracks.length > 0 && accessToken) {
      fetchRecommendations(accessToken, topTracks);
    }
  }, [topTracks, accessToken]);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Spotify Recommendations Based on Your Top Tracks</h1>

        {!isLoggedIn && (
          <button onClick={handleLogin}>Log in to Spotify</button>
        )}

        {isLoggedIn && topTracks.length > 0 && (
          <div>
            <h2>Your Top Tracks</h2>
            <ul className="track-list">
              {topTracks.map((track) => (
                <li key={track.id} className="track-card">
                  <img src={track.album.images[0].url} alt={track.name} />
                  <div className="track-name">{track.name}</div>
                  <div className="track-artists">{track.artists.map(artist => artist.name).join(', ')}</div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {songs.length > 0 && (
          <div>
            <h2>Recommended Songs</h2>
            <ul className="track-list">
              {songs.map((song) => (
                <li key={song.id} className="track-card">
                  <img src={song.album.images[0].url} alt={song.name} />
                  <div className="track-name">{song.name}</div>
                  <div className="track-artists">{song.artists.map(artist => artist.name).join(', ')}</div>
                </li>
              ))}
            </ul>

            <button onClick={handleCreatePlaylist} disabled={isCreatingPlaylist}>
              {isCreatingPlaylist ? 'Creating Playlist...' : 'Create Playlist'}
            </button>

            <button onClick={shuffle} disabled={isShuffling}>
              {isShuffling ? 'Shuffling...' : 'Shuffle'}
            </button>
          </div>
        )}

        {isLoggedIn && !topTracks.length && <p>Loading your top tracks...</p>}
        {isLoggedIn && !songs.length && topTracks.length > 0 && <p>Loading recommendations...</p>}
      </header>
    </div>
  );
}

export default App;
