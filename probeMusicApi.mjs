async function probeApis() {
  // 1. iTunes Search API
  try {
    const itunesRes = await fetch('https://itunes.apple.com/search?term=Naatu+Naatu&entity=song&limit=1');
    const itunesStatus = itunesRes.status;
    let itunesArtwork = null;
    if (itunesRes.ok) {
      const itunesData = await itunesRes.json();
      itunesArtwork = itunesData.results?.[0]?.artworkUrl100 || null;
    }
    const itunesUsable = typeof itunesArtwork === 'string' && itunesArtwork.startsWith('http');
    console.log(`iTunes Search API:`);
    console.log(`  HTTP Status: ${itunesStatus}`);
    console.log(`  artworkUrl100: ${itunesArtwork}`);
    console.log(`  Usable Image URL: ${itunesUsable ? 'Yes' : 'No'}\n`);
  } catch (err) {
    console.log(`iTunes Search API:`);
    console.log(`  Error: ${err.message}\n`);
  }

  // 2. Deezer Public Search API
  try {
    const deezerRes = await fetch('https://api.deezer.com/search?q=Naatu+Naatu&limit=1');
    const deezerStatus = deezerRes.status;
    let deezerArtwork = null;
    if (deezerRes.ok) {
      const deezerData = await deezerRes.json();
      deezerArtwork = deezerData.data?.[0]?.album?.cover_medium || null;
    }
    const deezerUsable = typeof deezerArtwork === 'string' && deezerArtwork.startsWith('http');
    console.log(`Deezer Public Search API:`);
    console.log(`  HTTP Status: ${deezerStatus}`);
    console.log(`  album.cover_medium: ${deezerArtwork}`);
    console.log(`  Usable Image URL: ${deezerUsable ? 'Yes' : 'No'}`);
  } catch (err) {
    console.log(`Deezer Public Search API:`);
    console.log(`  Error: ${err.message}`);
  }
}

probeApis();
