# SUNDAY — native Construct 3

[Play](https://southernadd-cmyk.github.io/sunday/construct/) · [Download project](https://southernadd-cmyk.github.io/sunday/downloads/SUNDAY-Construct3.c3p) · [Web export](https://southernadd-cmyk.github.io/sunday/downloads/SUNDAY-Construct3-Web.zip)

Open the single-file project in Construct 3 and preview with F5. The existing native Sprite, Drawing Canvas and Text objects render an autonomous match. Start Game opens the behaviour draft; football plays automatically. Pause, 1×/2×/4×, and full-time statistics are available. There are no movement orders or legacy tactical mode in the playable interface.

The owned project scripts are synchronized to the native export during build. No Construct runtime files or third-party assets are modified.

The downloadable project includes the generated Soccer-JS module with the upstream MIT notice. If opening the source directory from GitHub instead, run `npm ci` and `npm run prebuild` first. The project dynamically expands its native sprite pool to 22 footballers. Matches simulate five minutes at 4× base playback, with additional 2×/4× viewing controls.
