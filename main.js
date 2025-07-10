const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const os = require('os');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.removeMenu();
  win.loadFile('index.html');
  //win.webContents.openDevTools(); //devtools debughoz
}

app.whenReady().then(() => {
  createWindow();
});

function loadFromConfig() {
  try {
    /*
    /home/username/.config/libgen-electron/
    */
    const configPath = path.join(app.getPath('userData'), 'config.json');
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw);
      return parsed;
    }
  } catch (err) {
    console.error('Hiba a config betöltésekor:', err.message);
  }
  return null;
}

let downloadDir = loadFromConfig()?.downloadDir || path.join(os.homedir(), 'libgenbooks');
ipcMain.handle('get-config', () => {
  return { downloadDir };
});

ipcMain.handle('set-config', async (event, newPath) => {
  try {
    downloadDir = newPath;
    const configPath = path.join(app.getPath('userData'), 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ downloadDir: newPath }, null, 2));
    return { success: true, path: newPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('fetch-libgen', async (event, query) => {
  const url = `https://libgen.li/index.php?req=${encodeURIComponent(query)}&res=100&columns[]=t`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    const $ = cheerio.load(response.data);
    const results = [];

    $('table tbody tr').slice(1).each((i, row) => {
      const tds = $(row).find('td');
      if (tds.length < 9) return;

      const title = $(tds[0]).text().trim();
      const author = $(tds[1]).text().trim();
      const publisher = $(tds[2]).text().trim();
      const year = $(tds[3]).text().trim();
      const language = $(tds[4]).text().trim();
      const pages = $(tds[5]).text().trim();
      const fileSize = $(tds[6]).text().trim();
      const extension = $(tds[7]).text().trim();

      const md5Link = $(tds[8]).find('a[href*="ads.php?md5="]').attr('href');
      const md5Match = md5Link?.match(/md5=([a-fA-F0-9]{32})/);
      const md5 = md5Match ? md5Match[1] : null;

      //console.log(md5);

      if (md5) {
        results.push({ title, author, publisher, year, language, pages, fileSize, extension, md5 });
      }
    });

    return results;
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('download-metadata-to-json', async (event, id, results) => {
  try {
    const book = results.find(item => item.md5 === id);
    
    if (!book) {
      return { error: 'Book not found in results' };
    }

    const downloadsDir = path.join(downloadDir);
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    const fullMetadata = {
      ...book,
      downloadDate: new Date().toISOString(),
      source: 'LibGen',
      metadataVersion: '1.0'
    };

    const filePath = path.join(downloadsDir, `${id}_metadata.json`);
    fs.writeFileSync(filePath, JSON.stringify(fullMetadata, null, 2));

    return { success: true, filePath };
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('get-libgen-download-link', async (event, md5) => {
  const detailUrl = `https://libgen.li/ads.php?md5=${md5}`;

  try {
    const response = await axios.get(detailUrl);
    const $ = cheerio.load(response.data);

    const getLink = $('td[bgcolor="#A9F5BC"] a')
      .attr('href');

    if (!getLink) {
      console.warn('❌ Nem található <a href="get.php?..."> letöltési link.');
      return { error: 'Nincs letöltési link' };
    }

    const fullLink = getLink.startsWith('http')
      ? getLink
      : `https://libgen.li/${getLink}`;
      
    return fullLink;

  } catch (err) {
    console.error('❌ Hiba:', err.message);
    return { error: err.message };
  }
});

ipcMain.handle('start-download', async (event, md5, extension) => {
  const detailUrl = `https://libgen.li/ads.php?md5=${md5}`;

  try {
    event.sender.send('download-status', 'Megnyitás: ' + detailUrl);

    const detailResponse = await axios.get(detailUrl);
    const $ = require('cheerio').load(detailResponse.data);
    const getLink = $('td[bgcolor="#A9F5BC"] a').attr('href');

    if (!getLink) {
      event.sender.send('download-error', 'Nincs letöltési link');
      return { error: 'Nincs letöltési link' };
    }

    const fullLink = getLink.startsWith('http') ? getLink : `https://libgen.li/${getLink}`;
    event.sender.send('download-status', 'Letöltési link: ' + fullLink);

    const downloadsDir = path.join(downloadDir);
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    const filePath = path.join(downloadsDir, `${md5}.${extension}`);

    const response = await axios({
      method: 'GET',
      url: fullLink,
      responseType: 'stream',
    });

    const totalLength = parseInt(response.headers['content-length'], 10) || 0;
    if (!totalLength) {
      event.sender.send('download-status', 'Figyelmeztetés: Nem érkezett content-length fejléc.');
    }

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    const intervalId = setInterval(() => {
      fs.stat(filePath, (err, stats) => {
        if (err) {
          console.error('fs.stat hiba:', err.message);
          return;
        }
        const downloadedLength = stats.size;
        event.sender.send('download-status',
          `Letöltés: ${(downloadedLength / 1024 / 1024).toFixed(2)} MB / ${(totalLength / 1024 / 1024).toFixed(2)} MB`
        );
      });
    }, 1500); // in millisecond

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    clearInterval(intervalId);
    event.sender.send('download-status', 'Letöltés kész!');
    event.sender.send('download-done', filePath);

    return { success: true, filePath };

  } catch (err) {
    event.sender.send('download-error', err.message);
    return { error: err.message };
  }
});

ipcMain.handle('list-downloads-folder', async () => {
  try {
    const downloadsPath = path.join(downloadDir);
    const files = await fs.promises.readdir(downloadsPath);

    const metadataFiles = files.filter(file => file.endsWith('_metadata.json'));

    const books = await Promise.all(
      metadataFiles.map(async (filename) => {
        const filePath = path.join(downloadsPath, filename);
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);

        return {
          title: data.title || 'Ismeretlen',
          author: data.author || 'Ismeretlen',
          year: data.year || '',
          pages: data.pages || '',
          extension: data.extension || '',
          fileSize: data.fileSize || '',
        };
      })
    );

    return books;
  } catch (err) {
    return { error: err.message };
  }
});
