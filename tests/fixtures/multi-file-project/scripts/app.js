document.querySelector('#script-result').textContent = 'External JavaScript executed';
fetch('./assets/message.txt')
  .then((response) => response.text())
  .then((text) => { document.querySelector('#fetch-result').textContent = text.trim(); });
