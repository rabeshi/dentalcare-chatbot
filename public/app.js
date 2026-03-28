const askBtn = document.getElementById('askBtn');
const questionEl = document.getElementById('question');
const answerEl = document.getElementById('answer');
const contextEl = document.getElementById('context');
const statusEl = document.getElementById('status');

askBtn.addEventListener('click', async () => {
  const question = questionEl.value.trim();
  if (!question) return;

  statusEl.textContent = 'Sending request...';
  answerEl.textContent = '';
  contextEl.textContent = '';

  try {
    const res = await fetch('/api/qa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });

    const data = await res.json();
    if (!res.ok) {
      statusEl.textContent = `Error: ${data.error || res.statusText}`;
      return;
    }

    answerEl.textContent = data.answer;
    contextEl.textContent = data.context;
    statusEl.textContent = 'Success';
  } catch (err) {
    statusEl.textContent = `Fetch error: ${err.message}`;
  }
});
