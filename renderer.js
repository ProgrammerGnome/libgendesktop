const i18next = window.i18next;
const Backend = window.i18nextHttpBackend;

const savedLang = localStorage.getItem('appLang') || 'hu';

window.i18next
  .use(window.i18nextHttpBackend)
  .init({
    lng: savedLang,
    fallbackLng: 'en',
    backend: {
      loadPath: 'locales/{{lng}}/{{ns}}.json'
    }
  })
  .then(() => {
    console.log('i18next initialized');
    updateContent();
    setupLangButton();
  });

function updateContent() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (window.i18next && typeof window.i18next.t === 'function') {
      el.textContent = window.i18next.t(key);
    } else {
      console.warn('i18next nincs inicializálva');
    }
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.setAttribute('placeholder', i18next.t(key));
  });
}

function setupLangButton() {
    const langBtn = document.getElementById('langBtn');
    if (!langBtn) return;

    langBtn.textContent = window.i18next.language.toUpperCase();
    langBtn.replaceWith(langBtn.cloneNode(true));
    const newLangBtn = document.getElementById('langBtn');

    newLangBtn.addEventListener('click', () => {
      const currentLang = window.i18next.language;
      const newLang = currentLang === 'hu' ? 'en' : 'hu';

      window.i18next.changeLanguage(newLang, (err, t) => {
        if (err) {
          console.error('Lang change error:', err);
          return;
        }
        localStorage.setItem('appLang', newLang);
        updateContent();
        newLangBtn.textContent = newLang.toUpperCase();
      });
    });
  }

async function showPage(page) {
  const main = document.getElementById('mainContent');
  main.innerHTML = '';

  updateContent();

  function formatValue(value) {
    return value === undefined || value === null || value === '' || value === '0'? 'N.A.' : value;
  }

  try {
    const response = await fetch(`pages/${page}.html`);
    const html = await response.text();
    main.innerHTML = html;

    if (page === 'downloadProgress') {
      window.electronAPI.onDownloadStatus((event, status) => {
        const statusDiv = document.getElementById('downloadStatus');
        if (statusDiv) {
          statusDiv.textContent = status;
        }
      });
    }

    else if (page === 'downloadedBooksListSite') {
      const list = document.getElementById('downloadsList');
      const searchBox = document.getElementById('searchBox');
      let allBooks = [];

      const renderBooks = (books) => {
        list.innerHTML = '';
        if (books.length === 0) {
          list.innerHTML = '<tr><td colspan="5">There are no results.</td></tr>';
          return;
        }

        books.forEach(book => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${formatValue(book.title)}</td>
            <td>${formatValue(book.author)}</td>
            <td>${formatValue(book.year)}</td>
            <td>${formatValue(book.pages)}</td>
            <td>${formatValue(book.extension)}</td>
            <td>${formatValue(book.fileSize)}</td>
          `;
          list.appendChild(row);
        });
      };

      window.electronAPI.listDownloads().then(books => {
        if (books.error) {
          list.innerHTML = `<tr><td colspan="5" style="color: red;">Error: ${books.error}</td></tr>`;
          return;
        }
        allBooks = books;
        renderBooks(allBooks);
      });

      searchBox.addEventListener('input', () => {
        const query = searchBox.value.toLowerCase();
        const filtered = allBooks.filter(book => (book.title || '').toLowerCase().includes(query));
        renderBooks(filtered);
      });
    }

    else if (page === 'settingsSite') {
      const dirInput = document.getElementById('dirInput');
      const status = document.getElementById('saveStatus');
      const savePath = document.getElementById('savePath');
      const currentDirText = document.getElementById('currentDir');
      const saveBtn = document.getElementById('saveBtn');

      const config = await window.electronAPI.getConfig();
      const current = config?.downloadDir || '';
      currentDirText.textContent = current;
      dirInput.value = current;

      saveBtn.addEventListener('click', async () => {
        const newPath = dirInput.value;
        const result = await window.electronAPI.setConfig(newPath);
        if (result.success) {
          status.style.display= 'block';
          savePath.textContent = `${result.path}`;
          status.style.color = 'green';
          currentDirText.textContent = result.path;
        } else {
          status.textContent = `Error: ${result.error}`;
          status.style.color = 'red';
        }
      });

      const pingBtn = document.getElementById("pingServersBtn");
      if (pingBtn) {
        pingBtn.addEventListener("click", async () => {
          const servers = [
            "https://libgen.li",
            "https://libgen.gs",
            "https://libgen.vg",
            "https://libgen.la",
            "https://libgen.bz",
            "https://libgen.gl",
          ];

          const status = document.getElementById("pingStatus");
          status.textContent = "Pinging servers...";

          const pingTimes = await Promise.allSettled(servers.map(async (url) => {
            const start = performance.now();
            try {
              await fetch(url, { method: "HEAD", mode: "no-cors" });
              const time = performance.now() - start;
              return { url, time };
            } catch (e) {
              return { url, time: Infinity };
            }
          }));

          const fastest = pingTimes
            .filter(p => p.status === "fulfilled")
            .map(p => p.value)
            .sort((a, b) => a.time - b.time)[0];

          if (!fastest || fastest.time === Infinity) {
            status.textContent = "Failed to reach any server.";
            return;
          }
          
          status.textContent = `Fastest server: ${fastest.url.replace("https://","")} (${Math.round(fastest.time)} ms). Set in configuration.`;
          window.electronAPI?.setMirrorConfig?.(fastest.url.replace("https://",""));
        });
      }
      
      setupLangButton();
    }
    
    updateContent();
    setupLangButton();

  } catch (err) {
    main.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
  }
}

async function performSearch() {
  function formatValue(value) {
    return value === undefined || value === null || value === '' || value === '0'? 'N.A.' : value;
  }

  const query = document.getElementById('searchInput').value;
  const status = document.getElementById('status');
  const table = document.getElementById('resultsTable');
  const tbody = table.querySelector('tbody');

  status.textContent = 'Keresés...';
  table.style.display = 'none';
  tbody.innerHTML = '';

  const results = await window.electronAPI.fetchLibgen(query);

  if (results.error) {
    status.textContent = 'Error: ' + results.error;
    return;
  }
  if (results.length === 0) {
    status.textContent = 'There are no results.';
    return;
  }

  status.textContent = `${results.length} results.`;
  table.style.display = 'table';

  results.forEach(book => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${formatValue(book.title)}</td>
      <td>${formatValue(book.author)}</td>
      <td>${formatValue(book.publisher)}</td>
      <td>${formatValue(book.year)}</td>
      <td>${formatValue(book.language)}</td>
      <td>${formatValue(book.pages)}</td>
      <td>${formatValue(book.fileSize)}</td>
      <td>${formatValue(book.extension)}</td>
    `;

    row.style.cursor = 'pointer';
    row.addEventListener('click', async () => {
      showPage('downloadProgress');

      setTimeout(async () => {
        const downloadUrl = await window.electronAPI.getDownloadLink(book.md5);
        if (typeof downloadUrl === 'string' && downloadUrl.startsWith('http')) {
          const result = await window.electronAPI.startDownload(book.md5, book.extension);

          if (result.success) {
            await window.electronAPI.downloadMetadataToJson(book.md5, results);
          } else {
            alert('Download error: ' + result.error);
          }
        } else {
          alert('Download link error');
        }
      }, 100);
    });

    tbody.appendChild(row);
  });
}
