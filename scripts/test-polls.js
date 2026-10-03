// Run against the local, migrated database and a running API:
// node -r ./environment.js scripts/test-polls.js
/* eslint-disable @typescript-eslint/no-var-requires */
const assert = require('assert');
const { randomBytes, pbkdf2Sync } = require('crypto');
const { Client } = require('pg');
const fs = require('fs');
const os = require('os');
const path = require('path');
const got = require('got');

async function main() {
  assert(['localhost', '127.0.0.1', '::1'].includes(process.env.TYPEORM_HOST), 'Use a local test database');
  const db = new Client({
    host: process.env.TYPEORM_HOST,
    port: Number(process.env.TYPEORM_PORT),
    user: process.env.TYPEORM_USERNAME,
    password: process.env.TYPEORM_PASSWORD,
    database: process.env.TYPEORM_DATABASE,
  });
  await db.connect();
  const accounts = [];
  const messages = [];
  const password = randomBytes(12).toString('hex');
  const suffix = Date.now().toString(36);
  const api = (query, variables = {}, token) =>
    got
      .post(`http://localhost:${process.env.APP_PORT}/graphql`, {
        json: { query, variables },
        headers: token ? { authorization: `Bearer ${token}` } : {},
        responseType: 'json',
        throwHttpErrors: false,
      })
      .then((response) => response.body);
  const fields = 'messageId question selectedOption totalVotes options { label votes }';
  const create =
    'mutation($question:String!,$options:[String!]!){createPoll(question:$question,options:$options){id type json}}';
  const get = `query($id:Int!){getPoll(messageId:$id){${fields}}}`;
  const vote = `mutation($id:Int!,$option:Int!){votePoll(messageId:$id,optionIndex:$option){${fields}}}`;
  const input = { question: '  Что послушаем?  ', options: ['  Рок  ', 'Джаз'] };
  let passed = false;
  try {
    for (const role of ['MODERATOR', 'BROADCASTER', 'USER']) {
      const username = `poll_${role.toLowerCase()}_${suffix}`;
      const salt = randomBytes(48).toString('base64');
      const hash = pbkdf2Sync(password, salt, 10, 48, 'sha512').toString('base64');
      const {
        rows,
      } = await db.query(
        'INSERT INTO users(username,email,salt,hash,email_confirmed) VALUES($1,$2,$3,$4,$5) RETURNING id',
        [username, `${username}@example.invalid`, salt, hash, role !== 'USER'],
      );
      const account = { id: rows[0].id, username, role };
      accounts.push(account);
      await db.query('INSERT INTO roles(name) VALUES($1) ON CONFLICT DO NOTHING', [role]);
      await db.query('INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE name=$2', [
        account.id,
        role,
      ]);
      const signedIn = await api(
        'mutation($email:String!,$password:String!){signIn(email:$email,password:$password){value}}',
        { email: username, password },
      );
      assert(!signedIn.errors, JSON.stringify(signedIn.errors));
      account.token = signedIn.data.signIn.value;
    }
    const [moderator, broadcaster, user] = accounts;
    assert((await api(create, input)).errors, 'Guests cannot create polls');
    assert((await api(create, input, user.token)).errors, 'Ordinary users cannot create polls');
    for (const options of [['A'], ['A', ' a '], ['A', ' '], Array(11).fill('A')]) {
      assert((await api(create, { ...input, options }, moderator.token)).errors, 'Invalid options rejected');
    }
    assert((await api(create, { ...input, question: ' ' }, moderator.token)).errors, 'Blank question rejected');
    for (const creator of [moderator, broadcaster]) {
      const created = await api(create, input, creator.token);
      assert(!created.errors, JSON.stringify(created.errors));
      assert.strictEqual(created.data.createPoll.type, 6);
      const id = created.data.createPoll.id;
      messages.push(id);
      const guest = await api(get, { id });
      assert.strictEqual(guest.data.getPoll.totalVotes, null);
      assert(guest.data.getPoll.options.every((option) => option.votes === null));
      assert.strictEqual(guest.data.getPoll.question, 'Что послушаем?');
      assert((await api(vote, { id, option: 0 })).errors, 'Guests cannot vote');
      assert((await api(vote, { id, option: 9 }, user.token)).errors, 'Out of range option rejected');
      assert.strictEqual((await api(get, { id }, user.token)).data.getPoll.totalVotes, null);
      const concurrent = await Promise.all([0, 1].map((option) => api(vote, { id, option }, user.token)));
      assert.strictEqual(concurrent.filter((result) => !result.errors).length, 1, 'Concurrent double vote rejected');
      const result = (await api(get, { id }, user.token)).data.getPoll;
      assert.strictEqual(result.totalVotes, 1, 'Unconfirmed but signed-in user can vote');
      assert([0, 1].includes(result.selectedOption));
      assert.strictEqual(
        result.options.reduce((sum, option) => sum + option.votes, 0),
        1,
      );
      assert((await api(vote, { id, option: 1 }, user.token)).errors, 'Repeat vote rejected');
      assert.strictEqual((await api(get, { id })).data.getPoll.totalVotes, null, 'Guest cannot inspect results');
      assert.strictEqual(
        (await api(get, { id }, moderator.token)).data.getPoll.totalVotes,
        null,
        'Creator must vote too',
      );
      const secondVote = await api(vote, { id, option: 1 }, moderator.token);
      assert.strictEqual(secondVote.data.votePoll.totalVotes, 2);
      assert.strictEqual(
        (await api(get, { id }, user.token)).data.getPoll.totalVotes,
        2,
        'Fresh query sees other votes',
      );
      const deleted = await api('mutation($id:Int!){deleteMessage(messageId:$id){id}}', { id }, moderator.token);
      assert(!deleted.errors, JSON.stringify(deleted.errors));
      assert((await api(vote, { id, option: 0 }, broadcaster.token)).errors, 'Deleted polls cannot receive votes');
      assert((await api(get, { id }, user.token)).errors, 'Deleted polls are hidden');
    }
    passed = true;
    console.log(
      'Poll integration checks passed: permissions, validation, privacy, concurrent votes, persistence, deletion.',
    );
  } finally {
    await db.query('DELETE FROM messages WHERE id=ANY($1::int[])', [messages]);
    if (passed && process.argv.includes('--keep-accounts')) {
      const fixturePath = path.join(os.tmpdir(), 'everhoof-poll-test-accounts.json');
      fs.writeFileSync(fixturePath, JSON.stringify({ password, accounts }, null, 2));
      console.log(`Local browser test accounts: ${fixturePath}`);
    } else {
      await db.query('DELETE FROM messages WHERE owner_id=ANY($1::int[])', [accounts.map((account) => account.id)]);
      await db.query('DELETE FROM users WHERE id=ANY($1::int[])', [accounts.map((account) => account.id)]);
    }
    await db.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
