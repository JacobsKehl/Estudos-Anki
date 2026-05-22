const net = require('net');

function check(host, port) {
  console.log(`Checking ${host}:${port}...`);
  const socket = net.createConnection(port, host, () => {
    console.log(`CONNECTED to ${host}:${port}`);
    socket.end();
  });
  socket.on('error', (err) => {
    console.log(`ERROR for ${host}:${port}: ${err.message}`);
  });
  socket.setTimeout(3000, () => {
    console.log(`TIMEOUT for ${host}:${port}`);
    socket.destroy();
  });
}

check('localhost', 3000);
check('127.0.0.1', 3000);
check('localhost', 5432);
check('127.0.0.1', 5432);
