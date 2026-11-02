// Browser suites exercise the actual .gs handlers, using in-memory Google service mocks.
import http from 'node:http';
import { appsScriptFixture } from './apps-script-fixture.mjs';
const api = appsScriptFixture();
const server = http.createServer(async (request, response) => {
  let body = '';
  for await (const chunk of request) body += chunk;
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.end(JSON.stringify(
    request.url === '/db' ? api.db() :
    request.url === '/reset' ? { code: api.reset(JSON.parse(body).id) } :
    api.post(JSON.parse(body)),
  ));
});
server.listen(0, '127.0.0.1', () => console.log(server.address().port));
