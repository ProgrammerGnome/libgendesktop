const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.removeMenu();
  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();
});

// LibGen lekérés kezelése IPC-n keresztül
ipcMain.handle('fetch-libgen', async (event, query) => {
  const url = `https://libgen.li/index.php?req=${encodeURIComponent(query)}&columns[]=t&columns[]=a&columns[]=s&columns[]=y&columns[]=p&columns[]=i&objects[]=f&objects[]=e&objects[]=s&objects[]=a&objects[]=p&objects[]=w&topics[]=l&topics[]=c&topics[]=f&topics[]=a&topics[]=m&topics[]=r&topics[]=s&res=100&filesuns=all`;

  try {
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);

    let results = [];

    // Keresünk egy táblázatot, aminek vannak sorai, ahol könyv adatok vannak
    $('table tbody tr').each((i, elem) => {
      const tds = $(elem).find('td');
      if (tds.length < 8) return; // nincs elég oszlop, nem könyv adat

      // Kinyerjük a fontos adatokat
      const title = $(tds[0]).text().trim();
      const author = $(tds[1]).text().trim();
      const publisher = $(tds[2]).text().trim();
      const year = $(tds[3]).text().trim();
      const language = $(tds[4]).text().trim();
      const pages = $(tds[5]).text().trim();
      const fileSize = $(tds[6]).text().trim();
      const extension = $(tds[7]).text().trim();

      results.push({ title, author, publisher, year, language, pages, fileSize, extension });
    });

    return results;
  } catch (error) {
    return { error: error.message };
  }
});
