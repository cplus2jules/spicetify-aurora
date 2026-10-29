# Changelog

## 1.0.0 (2026-10-30)

The first release, and the first under the name Aurora. The theme used to be called Glass; if you installed Glass from Marketplace, install Aurora again to get the built-in lyrics.

### Spotify 1.3

- Works on Spotify 1.3 and Spicetify 2.46
- The Lyrics and full screen buttons work again: Spotify 1.3 broke the buttons Spicetify adds to the playback bar, so Aurora places its own

### Lyrics

- [Beautiful Lyrics](https://github.com/surfbryce/beautiful-lyrics) is built in and loads lyrics from Spotify, since its own servers are offline
- Replaces Spotify's lyrics page, and shows the same lyrics in a glass card in the Now Playing panel
- The line being sung fills in word by word, and each word jumps as it starts
- A note hops from word to word in time with the song, leaving a few sparkles
- Lines glide into place instead of jumping
- The glow takes its colour from the cover, or from a colour you pick in Theme settings
- Includes fixes from pull requests to Beautiful Lyrics by Chere3, Spikerko and npt-1707

### Glass

- An animated gradient in the colours of the song, playlist, album or artist
- Frosted tooltips, menus, submenus, the profile menu and dialogs
- A white pearl play button that glows in the song's colour
- Artist and playlist headers cycle through their covers; album headers drift as a blurred copy of the cover
- A title font of your choice for any playlist, album or artist
- Switches with a light track and dark knob, and a white equalizer instead of Spotify green
- Switching between Now Playing and Listening activity shows one panel at a time, and a closed panel leaves a slim glass tab
- Connect device icons for Echo, HomePod, Nest, Sonos, iPhone, MacBook, TVs, consoles and more

### Performance

- The lyrics background renders at half resolution and 30 fps, and the lyrics page holds 60 fps
- The note, sparkles, word jumps and line glides run on the compositor
- Panel switches do about half the work they used to, after removing slow CSS selectors
