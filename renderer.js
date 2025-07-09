async function showPage(page) {
  const main = document.getElementById('mainContent');
  main.innerHTML = '';

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
    
    else if (page === 'downloadedBooksList') {
      const list = document.getElementById('downloadsList');
      const searchBox = document.getElementById('searchBox');
      let allBooks = [];

      const renderBooks = (books) => {
        list.innerHTML = '';
        if (books.length === 0) {
          list.innerHTML = '<tr><td colspan="5">Nincs találat.</td></tr>';
          return;
        }

        books.forEach(book => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${book.title || ''}</td>
            <td>${book.author || ''}</td>
            <td>${book.year || ''}</td>
            <td>${book.pages || ''}</td>
            <td>${book.fileSize || ''}</td>
          `;
          list.appendChild(row);
        });
      };

      window.electronAPI.listDownloads().then(books => {
        if (books.error) {
          list.innerHTML = `<tr><td colspan="5" style="color: red;">Hiba: ${books.error}</td></tr>`;
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

  } catch (err) {
    main.innerHTML = `<p style="color:red;">Hiba történt: ${err.message}</p>`;
  }
}

async function performSearch() {
  const query = document.getElementById('searchInput').value;
  const status = document.getElementById('status');
  const table = document.getElementById('resultsTable');
  const tbody = table.querySelector('tbody');

  status.textContent = 'Keresés...';
  table.style.display = 'none';
  tbody.innerHTML = '';

  const results = await window.electronAPI.fetchLibgen(query);

  if (results.error) {
    status.textContent = 'Hiba: ' + results.error;
    return;
  }
  if (results.length === 0) {
    status.textContent = 'Nincs találat.';
    return;
  }

  status.textContent = `${results.length} találat`;
  table.style.display = 'table';

  results.forEach(book => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${book.title}</td>
      <td>${book.author}</td>
      <td>${book.publisher}</td>
      <td>${book.year}</td>
      <td>${book.language}</td>
      <td>${book.pages}</td>
      <td>${book.fileSize}</td>
      <td>${book.extension}</td>
    `;

    row.style.cursor = 'pointer';
    //console.log("Mikori: ",row);
    row.addEventListener('click', async () => {
      showPage('downloadProgress');

      setTimeout(async () => {
        const downloadUrl = await window.electronAPI.getDownloadLink(book.md5);
        if (typeof downloadUrl === 'string' && downloadUrl.startsWith('http')) {
          const result = await window.electronAPI.startDownload(book.md5);

          if (result.success) {
            await window.electronAPI.downloadMetadataToJson(book.md5, results);
          } else {
            alert('Letöltési hiba: ' + result.error);
          }
        } else {
          alert('Hiba a letöltési linkkel.');
        }
      }, 100);
    });

    tbody.appendChild(row);
  });
}
