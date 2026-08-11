const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'betpanel-inline-'));

try {
  for (const file of ['index.html', 'banker.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const blocks = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
      .map(match => match[1])
      .filter(script => script.trim());

    assert(blocks.length > 0, `${file} 沒有找到 inline script`);

    blocks.forEach((script, index) => {
      const scriptPath = path.join(tempDir, `${file}-inline-${index + 1}.js`);
      fs.writeFileSync(scriptPath, script);
      const result = spawnSync(process.execPath, ['--check', scriptPath], { encoding: 'utf8' });
      if (result.status !== 0) {
        throw new Error(`${file} inline script ${index + 1} 語法錯誤\n${result.stderr}`);
      }
    });

    console.log(`${file}: ${blocks.length} inline script(s) passed node --check`);
  }
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
