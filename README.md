# Glass

A Spicetify theme for Spotify 1.3 that turns the app into frosted glass over your music's colours.

![preview](preview.png)

## Features

- **Animated gradient background** in the colours of the song that's playing, or of the playlist, album or artist you're viewing
- **Cover reel** on playlist and artist headers: the covers of the page's tracks take turns, each one building in from tiles
- **Glass panels** with one tint, border and radius, and a progressive blur under sticky headers
- **Title fonts per page**: hover a header and press **Aa** to pick a font for that playlist, album or artist; titles are tinted to the cover
- **Connect device icons** drawn for Echo, HomePod, Nest, Sonos, iPhone, MacBook, TVs, consoles and more
- **Beautiful Lyrics built in**: the Lyrics button opens synced lyrics over the cover's colours. A note hops across each word as it's sung, words jump and glow in the song's colour, sparkles trail behind, and lines glide into place. The full screen button opens the full screen lyrics view
- **Theme settings** (sliders button in the top bar): switch between the gradient and your own background image, pick a lyrics colour, and blur options

## Install

### Marketplace

Open Marketplace in Spotify, go to **Themes** and install **Glass**.

### Manual

Clone this repo into your Spicetify `Themes` folder as `Glass`, then:

```sh
spicetify config current_theme Glass color_scheme base
spicetify config inject_css 1 replace_colors 1 overwrite_assets 1 inject_theme_js 1
spicetify apply
```

For the lyrics, copy `beautiful-lyrics.mjs` into your Spicetify `Extensions` folder and run:

```sh
spicetify config extensions beautiful-lyrics.mjs
spicetify apply
```

The Spicetify folder is `~/.config/spicetify` on macOS and Linux, and `%appdata%\spicetify` on Windows.

If you also installed the separate Beautiful Lyrics extension from Marketplace, remove it: its servers are offline, and Glass includes a maintained copy.

## Development

`pnpm dev` serves `theme.js` and `user.css` with hot reload; load `dev-loader.js` as a Spicetify extension to use them.

## Credits

Started from [Galaxy](https://github.com/harbassan/spicetify-galaxy) by harbassan.

Lyrics come from [Beautiful Lyrics](https://github.com/surfbryce/beautiful-lyrics) by surfbryce, included with the author's permission. The bundled copy carries fixes from pull requests by Chere3, Spikerko and npt-1707, loads lyrics from Spotify instead of the retired Beautiful Lyrics servers, and adds the word effects above.
