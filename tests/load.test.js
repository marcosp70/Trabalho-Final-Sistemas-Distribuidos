const axios = require('axios');
const io = require('socket.io-client');

const API_URL = 'http://127.0.0.1';
const NUM_USERS = 10;
const MESSAGES_PER_USER = 5;

async function runLoadTest() {
  console.log(`🚀 Iniciando Teste de Carga com ${NUM_USERS} usuários simultâneos...`);
  
  const users = [];
  
  // 1. Criar usuários e fazer login em paralelo
  console.log('1. Registrando e logando usuários...');
  const authPromises = Array.from({ length: NUM_USERS }).map(async (_, i) => {
    const username = `load_user_${Date.now()}_${i}`;
    const password = 'password123';
    
    // Register
    await axios.post(`${API_URL}/api/auth/register`, { username, password });
    
    // Login
    const res = await axios.post(`${API_URL}/api/auth/login`, { username, password });
    return { username, token: res.data.token };
  });

  try {
    const authResults = await Promise.all(authPromises);
    users.push(...authResults);
    console.log(`✅ ${NUM_USERS} usuários autenticados com sucesso.`);
  } catch (err) {
    console.error('Erro na autenticação durante o teste de carga', err.message);
    return;
  }

  // 2. Conectar aos WebSockets
  console.log('2. Estabelecendo conexões WebSocket...');
  const sockets = [];
  
  const connectionPromises = users.map(user => {
    return new Promise((resolve) => {
      const socket = io(API_URL, {
        auth: { token: user.token },
        path: '/socket.io/',
        transports: ['websocket']
      });
      
      socket.on('connect', () => {
        sockets.push({ socket, username: user.username });
        resolve();
      });
    });
  });

  await Promise.all(connectionPromises);
  console.log(`✅ ${sockets.length} conexões WebSocket estabelecidas.`);

  // 3. Enviar mensagens simultaneamente
  console.log(`3. Disparando ${MESSAGES_PER_USER} mensagens por usuário...`);
  let messagesReceived = 0;
  const totalExpected = NUM_USERS * MESSAGES_PER_USER; // Todos estão enviando pro grupo, e todos ouvem do grupo.
  // Na verdade, no grupo 1:N, se 1 envia, todos os 10 recebem. 
  // O tráfego de recebimento será: NUM_USERS enviam MESSAGES_PER_USER = 50 msgs disparadas.
  // Como as 50 msgs vão pro 'group', cada um dos 10 recebe 50 msgs = 500 recebimentos totais.
  
  let totalRecebimentosEsperados = (NUM_USERS * MESSAGES_PER_USER) * NUM_USERS;
  let recebimentosAtuais = 0;

  sockets.forEach(({ socket, username }) => {
    socket.on('receiveMessage', (msg) => {
      recebimentosAtuais++;
      if (recebimentosAtuais === totalRecebimentosEsperados) {
        console.log(`🎉 Sucesso! Todas as ${totalRecebimentosEsperados} entregas (Push) foram concluídas com sucesso através dos microsserviços.`);
        process.exit(0);
      }
    });
  });

  // Disparar
  sockets.forEach(({ socket }) => {
    for (let i = 0; i < MESSAGES_PER_USER; i++) {
      socket.emit('sendMessage', {
        recipient: 'group',
        content: `Carga de teste #${i}`
      });
    }
  });

  // Timeout caso falhe
  setTimeout(() => {
    console.log(`⚠️ Timeout! Recebidas ${recebimentosAtuais} de ${totalRecebimentosEsperados} mensagens esperadas.`);
    process.exit(1);
  }, 10000);
}

runLoadTest();
