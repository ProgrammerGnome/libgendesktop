const searchBtn = document.getElementById('searchBtn');
const searchInput = document.getElementById('searchInput');
const resultsTable = document.getElementById('resultsTable');
const tbody = resultsTable.querySelector('tbody');
const status = document.getElementById('status');

searchBtn.addEventListener('click', async () => {
  const query = searchInput.value.trim();
  if (!query) {
    alert('Adj meg egy keresési kifejezést!');
    return;
  }

  status.textContent = 'Keresés folyamatban...';
  resultsTable.style.display = 'none';
  tbody.innerHTML = '';

  const result = await window.libgenAPI.fetchBooks(query);

  if (result.error) {
    status.textContent = 'Hiba történt: ' + result.error;
    return;
  }

  if (result.length === 0) {
    status.textContent = 'Nincs találat.';
    return;
  }

  status.textContent = `Találatok száma: ${result.length}`;

  for (const book of result) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${book.title}</td>
      <td>${book.author}</td>
      <td>${book.publisher}</td>
      <td>${book.year}</td>
      <td>${book.language}</td>
      <td>${book.pages}</td>
      <td>${book.fileSize}</td>
      <td>${book.extension}</td>
    `;
    tbody.appendChild(tr);
  }

  resultsTable.style.display = 'table';
});

