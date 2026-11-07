/**
 * Runs before `npm run dev` (npm's predev hook).
 *
 * Nodemon dies with "Port 3000 is already in use" when a previous server is still
 * listening, and then waits for a file change before it will try again — which reads like
 * a crash. This stops a leftover *node* listener on the port first, and refuses to touch
 * anything that is not node, so an unrelated service is never killed.
 */
import net from 'net';
import { execSync } from 'child_process';

const PORT = Number(process.env.PORT) || 3000;
const isWindows = process.platform === 'win32';

function portBusy(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    const done = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(1200);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

function ownerPid(port) {
  try {
    if (isWindows) {
      const output = execSync('netstat -ano -p tcp', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const line = output
        .split(/\r?\n/)
        .find((row) => row.includes(`:${port}`) && /LISTENING/i.test(row));
      if (!line) return null;
      const pid = line.trim().split(/\s+/).pop();
      return pid && pid !== '0' ? Number(pid) : null;
    }
    const output = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const pid = output.trim().split(/\s+/)[0];
    return pid ? Number(pid) : null;
  } catch {
    return null;
  }
}

function processName(pid) {
  try {
    if (isWindows) {
      const output = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const first = output.trim().split(/\r?\n/)[0] || '';
      return first.split('","')[0].replace(/^"/, '');
    }
    return execSync(`ps -p ${pid} -o comm=`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function kill(pid) {
  try {
    if (isWindows) execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
    else process.kill(pid, 'SIGKILL');
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await portBusy(PORT))) {
    console.log(`Port ${PORT} is free.`);
    return;
  }

  const pid = ownerPid(PORT);
  if (!pid) {
    console.error(`Port ${PORT} is in use but the owning process could not be identified. Stop it manually and retry.`);
    process.exit(1);
  }

  const name = processName(pid);
  if (!/node/i.test(name)) {
    console.error(`Port ${PORT} is held by "${name || 'unknown process'}" (pid ${pid}), which is not node. Stop it manually and retry.`);
    process.exit(1);
  }

  console.log(`Port ${PORT} was held by a stale node process (pid ${pid}); stopping it.`);
  if (!kill(pid)) {
    console.error(`Could not stop pid ${pid}. Stop it manually and retry.`);
    process.exit(1);
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (!(await portBusy(PORT))) {
      console.log(`Port ${PORT} is free.`);
      return;
    }
  }

  console.error(`Port ${PORT} is still in use after stopping pid ${pid}.`);
  process.exit(1);
}

main();
