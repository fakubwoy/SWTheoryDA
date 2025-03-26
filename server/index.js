const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

app.use(cors());
app.use(express.json());

const users = {
  '8888888888': {
    name: 'Farhaan',
    about: 'Hey there! I am using WhatsApp Clone',
    profilePic: '/pfp.webp', 
    contacts: {
      '9999999999': { name: 'Aditya' },
      '7777777777': { name: 'Meera' }
    }
  },
  '9999999999': {
    name: 'Aditya',
    about: 'Busy right now',
    profilePic: '/pfp.webp', 
    contacts: {
      '8888888888': { name: 'Farhaan' }
    }
  },
  '7777777777': {
    name: 'Meera',
    about: 'Available',
    profilePic: '/pfp.webp', 
    contacts: {
      '8888888888': { name: 'Farhaan' }
    }
  }
};

socket.on('register', (phone) => {
  const user = users[phone];
  if (user) {
    const enhancedContacts = {};
    for (const [num, contact] of Object.entries(user.contacts)) {
      enhancedContacts[num] = {
        name: contact.name,
        profilePic: '/pfp.webp',  
        phone: num
      };
    }
    socket.emit('contact_list', enhancedContacts);
    socket.emit('user_profile', user);
  }
});

const onlineUsers = {}; 
const messages = {};   
const groupChats = {};  
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('register', (phone) => {
    console.log(`User ${phone} registered`);
    onlineUsers[phone] = {
      socketId: socket.id,
      lastSeen: new Date(),
      status: 'Online'
    };

    const user = users[phone];
    if (user) {
      const enhancedContacts = {};
      for (const [num, name] of Object.entries(user.contacts)) {
        enhancedContacts[num] = {
          name: name, 
          profilePic: users[num]?.profilePic || 'pfp.webp',
          phone: num  
        };
      }

      socket.emit('contact_list', enhancedContacts);
      socket.emit('user_profile', user);

      Object.keys(user.contacts).forEach(contact => {
        if (onlineUsers[contact]) {
          io.to(onlineUsers[contact].socketId).emit('contact_online', {
            phone,
            status: 'Online'
          });
        }
      });
    }
  });

  socket.on('send_message', ({ from, to, message }) => {
    const messageId = uuidv4();
    const timestamp = new Date();
    const isReceiverOnline = !!onlineUsers[to];
    
    const msg = {
      id: messageId,
      from,
      to,
      message,
      timestamp,
      status: isReceiverOnline ? 'Delivered' : 'Pending'
    };

    if (!messages[from]) messages[from] = {};
    if (!messages[from][to]) messages[from][to] = [];
    messages[from][to].push(msg);

    if (!messages[to]) messages[to] = {};
    if (!messages[to][from]) messages[to][from] = [];
    messages[to][from].push({ 
      ...msg, 
      status: isReceiverOnline ? 'Received' : 'Pending' 
    });

    if (isReceiverOnline) {
      io.to(onlineUsers[to].socketId).emit('receive_message', {
        ...msg,
        status: 'Received'
      });
    }

    socket.emit('message_sent_confirmation', {
      id: messageId,
      to,
      status: msg.status,
      timestamp
    });

    console.log(`Message sent from ${from} to ${to}`);
  });

  socket.on('seen', ({ from, to, messageIds }) => {
    if (messages[from] && messages[from][to]) {
      messages[from][to] = messages[from][to].map(m => 
        messageIds.includes(m.id) ? { ...m, status: 'Seen' } : m
      );
      
      if (onlineUsers[from]) {
        io.to(onlineUsers[from].socketId).emit('status_update', {
          from: to,
          status: 'Seen',
          messageIds
        });
      }

      console.log(`Messages marked as seen by ${to}`);
    }
  });

  socket.on('create_group_chat', ({ name, members, admin }) => {
    const groupId = uuidv4();
    groupChats[groupId] = {
      id: groupId,
      name,
      members,
      admin,
      messages: [],
      createdAt: new Date()
    };
    
    members.forEach(member => {
      if (onlineUsers[member]) {
        io.to(onlineUsers[member].socketId).emit('new_group', groupChats[groupId]);
      }
    });

    console.log(`Group ${name} created by ${admin}`);
  });

  socket.on('send_group_message', ({ groupId, from, message }) => {
    if (!groupChats[groupId]) return;

    const messageId = uuidv4();
    const msg = {
      id: messageId,
      from,
      message,
      timestamp: new Date()
    };

    groupChats[groupId].messages.push(msg);

    groupChats[groupId].members.forEach(member => {
      if (onlineUsers[member] && member !== from) {
        io.to(onlineUsers[member].socketId).emit('receive_group_message', { 
          groupId, 
          message: msg 
        });
      }
    });

    console.log(`Group message sent to ${groupId} by ${from}`);
  });

  socket.on('update_profile', ({ phone, updates }) => {
    if (users[phone]) {
      users[phone] = { ...users[phone], ...updates };
      socket.emit('profile_updated', users[phone]);
      console.log(`Profile updated for ${phone}`);
    }
  });

  socket.on('disconnect', () => {
    for (const [phone, userData] of Object.entries(onlineUsers)) {
      if (userData.socketId === socket.id) {
        userData.status = 'Offline';
        userData.lastSeen = new Date();
        delete userData.socketId;

        const userContacts = users[phone]?.contacts;
        if (userContacts) {
          Object.keys(userContacts).forEach(contact => {
            if (onlineUsers[contact]?.socketId) {
              io.to(onlineUsers[contact].socketId).emit('contact_offline', {
                phone,
                lastSeen: userData.lastSeen
              });
            }
          });
        }

        console.log(`User ${phone} disconnected`);
        break;
      }
    }
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

server.listen(5000, () => {
  console.log('Server running on port 5000');
});