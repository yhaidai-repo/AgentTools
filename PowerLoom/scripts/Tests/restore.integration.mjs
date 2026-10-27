import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { before, after, beforeEach, it } from 'node:test';

// Opt in explicitly. All SQL, archives and clients stay inside the one newly created network-isolated container.
const enabled = process.env.POWERLOOM_RESTORE_TESTS === '1';
let container;
const docker = (args, options = {}) => spawnSync('docker', args, { encoding: 'utf8', timeout: 30000, ...options });
function checked(result) { assert.equal(result.status, 0, result.stderr || result.stdout); return result.stdout.trim(); }
const exec = (...args) => docker(['exec', container, ...args]);
const sql = (query, database = 'fixture') => checked(exec('psql', '-XAt', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-c', query));
const restore = (file, extra = []) => docker(['exec', '-e', 'PGHOST=127.0.0.1', '-e', 'PGPASSWORD=synthetic', ...extra, container, 'sh', '/script/restore.sh', file]);
const waitFor = async (predicate) => { for (let i = 0; i < 100; i++) { if (predicate()) return; await new Promise(r => setTimeout(r, 50)); } throw new Error('Disposable fixture did not reach the expected state'); };
function startRestore(extra = []) {
  const child = spawn('docker', ['exec', '-e', 'PGHOST=127.0.0.1', '-e', 'PGPASSWORD=synthetic', ...extra, container, 'sh', '/script/restore.sh', '/tmp/good.dump']);
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
  const finished = new Promise(resolve => child.once('exit', status => resolve({ status, stdout, stderr })));
  return { child, finished };
}

before(async () => {
  if (!enabled) return;
  const path = fileURLToPath(new URL('../restore.sh', import.meta.url));
  container = checked(docker(['run', '-d', '--rm', '--network', 'none', '--label', 'codex.fixture=powerloom-restore', '-e', 'POSTGRES_USER=postgres', '-e', 'POSTGRES_PASSWORD=synthetic', '-e', 'POSTGRES_DB=fixture', '--mount', `type=bind,source=${path},target=/script/restore.sh,readonly`, 'postgres:16-alpine']));
  assert.match(container, /^[0-9a-f]{64}$/);
  await waitFor(() => exec('pg_isready', '-U', 'postgres', '-d', 'fixture').status === 0);
  checked(exec('sh', '-n', '/script/restore.sh'));
});
after(() => { if (container) checked(docker(['rm', '--force', container])); });
beforeEach(() => {
  if (!enabled) return;
  sql("UPDATE pg_database SET datallowconn=true WHERE datname='fixture'", 'template1');
  sql('DROP DATABASE fixture WITH (FORCE)', 'template1');
  sql('CREATE DATABASE fixture', 'template1');
  sql("CREATE TABLE sample(value text); INSERT INTO sample VALUES ('original')");
  checked(exec('pg_dump', '-U', 'postgres', '-d', 'fixture', '-Fc', '-f', '/tmp/good.dump'));
  sql("UPDATE sample SET value='newer'");
});

it('refuses nonexistent or invalid archives before changing data or connection state', { skip: !enabled }, () => {
  checked(exec('sh', '-c', "printf 'invalid archive' >/tmp/invalid.dump"));
  for (const file of ['/tmp/not-present.dump', '/tmp/invalid.dump']) {
    const result = restore(file);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, file.includes('not-present') ? /not a readable file/ : /pg_restore:/);
    assert.doesNotMatch(result.stdout, /restored:/);
    assert.equal(sql('SELECT value FROM sample'), 'newer');
    assert.equal(sql("SELECT datallowconn FROM pg_database WHERE datname='fixture'", 'template1'), 't');
  }
});

it('restores completely and reopens connections only after the transaction completes', { skip: !enabled }, () => {
  const result = restore('/tmp/good.dump');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /restored:/);
  assert.equal(sql('SELECT value FROM sample'), 'original');
  assert.equal(sql("SELECT datallowconn FROM pg_database WHERE datname='fixture'", 'template1'), 't');
});

it('refuses an existing client without terminating it or changing its data', { skip: !enabled }, async () => {
  const client = spawn('docker', ['exec', '-e', 'PGAPPNAME=synthetic-existing-writer', container, 'psql', '-U', 'postgres', '-d', 'fixture', '-c', 'SELECT pg_sleep(20)'], { stdio: 'ignore' });
  const done = new Promise(resolve => client.once('exit', resolve));
  try {
    await waitFor(() => sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='synthetic-existing-writer'", 'template1') === '1');
    const result = restore('/tmp/good.dump');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Active database clients remain/);
    assert.equal(sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='synthetic-existing-writer'", 'template1'), '1');
    assert.equal(sql('SELECT value FROM sample'), 'newer');
    assert.doesNotMatch(result.stdout, /restored:/);
  } finally {
    sql("SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE application_name='synthetic-existing-writer'", 'template1');
    await done;
  }
});

it('rolls back a late SQL failure rather than leaving a partially cleaned database', { skip: !enabled }, () => {
  sql('CREATE ROLE fixture_missing_role; GRANT SELECT ON sample TO fixture_missing_role');
  checked(exec('pg_dump', '-U', 'postgres', '-d', 'fixture', '-Fc', '-f', '/tmp/failing.dump'));
  sql('REVOKE SELECT ON sample FROM fixture_missing_role; DROP ROLE fixture_missing_role');
  sql("UPDATE sample SET value='after-dump'");
  const result = restore('/tmp/failing.dump');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /fixture_missing_role/);
  assert.doesNotMatch(result.stdout, /restored:/);
  assert.equal(sql('SELECT value FROM sample'), 'after-dump');
  assert.equal(sql("SELECT datallowconn FROM pg_database WHERE datname='fixture'", 'template1'), 't');
});

it('blocks newly connecting writers and a competing restore while the restore is in progress', { skip: !enabled }, async () => {
  // A fake decoder boundary appends a delay to real decoded SQL; the actual restore script and database execute.
  checked(exec('mkdir', '-p', '/tmp/slow-decoder'));
  checked(docker(['exec', '-i', container, 'sh', '-c', 'cat >/tmp/slow-decoder/pg_restore; chmod +x /tmp/slow-decoder/pg_restore'], { input: '#!/bin/sh\n/usr/local/bin/pg_restore "$@"\nfor arg do case "$arg" in --file=*) printf "\\nSELECT pg_sleep(3);\\n" >> "${arg#--file=}";; esac; done\n' }));
  const first = startRestore(['-e', 'PATH=/tmp/slow-decoder:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin']);
  await waitFor(() => sql("SELECT datallowconn FROM pg_database WHERE datname='fixture'", 'template1') === 'f');
  assert.notEqual(exec('psql', '-U', 'postgres', '-d', 'fixture', '-c', "INSERT INTO sample VALUES ('unseen writer')").status, 0);
  const second = restore('/tmp/good.dump');
  assert.notEqual(second.status, 0);
  assert.equal(sql("SELECT datallowconn FROM pg_database WHERE datname='fixture'", 'template1'), 'f');
  const result = await first.finished;
  assert.equal(result.status, 0, result.stderr);
  assert.equal(sql('SELECT value FROM sample'), 'original');
});
